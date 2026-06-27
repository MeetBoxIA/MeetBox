# PLAN — Fixes de Autenticación y Desktop Deep-link (listo para producción)

> Generado por auditoría de código. **No se ha modificado nada todavía.** Este
> documento describe causa raíz, hipótesis verificadas y los cambios exactos a
> aplicar en la fase de ejecución.

---

## Resumen ejecutivo

| # | Problema | Causa raíz | Severidad |
|---|----------|------------|-----------|
| 1 | "Recupera contraseña" no envía email a cuentas creadas con Gmail | El endpoint exige `password_hash` y las cuentas Google puras no tienen → corta en silencio | 🔴 Alta |
| 2 | "Revisar acciones en el dashboard" abre ventana nueva y a veces pide login | `shell.openExternal()` abre el navegador **por defecto** del SO, que puede no ser donde el usuario tiene sesión | 🟠 Media |
| 3 | **(Hallazgo extra)** Tokens de reset / OTP / rate-limit viven en memoria (`Map` global) | En producción serverless (Vercel) `forgot` y `reset` pueden caer en instancias distintas → "enlace no válido" intermitente | 🔴 Alta (bloqueante para prod) |

Los tres están relacionados con el mismo flujo y deben arreglarse juntos para que
quede "listo para producción".

---

## Bug #1 — Email de recuperación nunca llega (cuentas Gmail puras)

### Traza del flujo (verificada en código)

1. UI → `POST /api/auth/password/forgot` con el email.
2. [`src/app/api/auth/password/forgot/route.ts:63-70`](src/app/api/auth/password/forgot/route.ts#L63-L70):

   ```ts
   const { data: user } = await db
     .from("users")
     .select("id, password_hash")
     .eq("email", email)
     .maybeSingle();

   // No user / no password → return the same generic 200 (anti-enumeration)
   if (!user?.password_hash) return genericOk();   // ⬅️ AQUÍ SE CORTA
   ```

3. Cuando una cuenta se crea **directamente con Google**, el callback de NextAuth
   la inserta así — [`auth.ts:91-94`](auth.ts#L91-L94):

   ```ts
   await db.from("users")
     .insert({ email, name, avatar_url, provider: "google" });
   // ⬆️ NO se escribe password_hash → queda NULL
   ```

4. Resultado: `user.password_hash` es `NULL` → la condición `if (!user?.password_hash)`
   devuelve el `genericOk()` (200 "éxito") **sin generar token ni enviar email**.
   La UI muestra "enviado correctamente" pero nunca sale ningún correo.

### Por qué SÍ funciona en cuentas manuales (o manual + Google linkeado)

Esas cuentas se registraron con email+password → tienen `password_hash` poblado →
pasan la condición → se envía el email. Esto coincide exactamente con el reporte.

### Confirmación de que NO es el proveedor de email

- El mismo helper [`src/lib/email.ts`](src/lib/email.ts) (Brevo → Resend → SMTP)
  es el que usa el flujo manual, que sí entrega. Si el SMTP/Brevo fallara, también
  fallaría para cuentas manuales. → El proveedor de email **no es la causa**.

### Decisión de producto (alineada con lo pedido)

El requisito es: *"si se crea una cuenta ya sea manualmente o con Gmail, la
recuperación de contraseña e inicio de sesión (manual o Gmail) funcionen"*. Una
cuenta Google pura no tiene contraseña, así que "recuperar" = **establecer
contraseña por primera vez**. Tras hacerlo, el usuario podrá entrar también con
email+password (el login manual ya admite cualquier cuenta con `password_hash`,
ver [`auth.ts:55-65`](auth.ts#L55-L65)).

### Fix #1.1 — `forgot/route.ts`: enviar a cualquier cuenta existente

Cambiar la consulta y la condición de corte para que el email se genere si **el
usuario existe** (con o sin password). Sigue siendo anti-enumeración: a un email
inexistente se le responde el mismo `genericOk()`.

```ts
// Solo necesitamos saber si la cuenta existe; ya no exigimos password_hash.
const { data: user } = await db
  .from("users")
  .select("id")
  .eq("email", email)
  .maybeSingle();

// Sin cuenta → mismo 200 genérico (anti-enumeración).
if (!user) return genericOk();
```

(El resto del handler — token, `saveResetToken`, `sendEmail` — queda igual.)

### Fix #1.2 — `reset/route.ts`: permitir fijar password aunque sea NULL

[`src/app/api/auth/password/reset/route.ts:49-57`](src/app/api/auth/password/reset/route.ts#L49-L57) hoy rechaza con 404 si no hay `password_hash`. Cambiar a:

```ts
const { data: user } = await db
  .from("users")
  .select("id")
  .eq("email", normalizedEmail)
  .maybeSingle();

if (!user) {
  return NextResponse.json({ error: "Cuenta no encontrada." }, { status: 404 });
}
// Continúa: se hace hash y UPDATE de password_hash (set o reset, da igual).
```

> Nota: no se toca `provider`. Una cuenta Google que fije password queda como
> `provider='google'` **con** `password_hash` → puede entrar por Google **y** por
> email. Es exactamente el comportamiento deseado y ya soportado por `auth.ts`.

### Validación Bug #1
- Crear cuenta solo con Google → "Olvidé contraseña" → **llega el email** → fijar
  password → login manual funciona → login Google sigue funcionando.
- Cuenta manual → recuperación sigue funcionando (no regresión).
- Email inexistente → responde 200 genérico, no se envía nada (anti-enumeración intacto).

---

## Bug #3 — Stores en memoria (bloqueante de producción) ⚠️

> Se arregla junto al #1 porque **sin esto el #1 seguirá fallando de forma
> intermitente en producción**, incluso para cuentas manuales.

### Problema

`reset-token-store`, `otp-store` y `rate-limit` usan un `Map` en memoria del
proceso ([`src/lib/reset-token-store.ts:19-22`](src/lib/reset-token-store.ts#L19-L22), [`src/lib/rate-limit.ts:12-14`](src/lib/rate-limit.ts#L12-L14)).

En Vercel/serverless cada request puede ejecutarse en una **instancia distinta** o
tras un cold start. El token guardado en `/forgot` puede no existir cuando llega
`/reset` → "El enlace no es válido". También se pierde en cada redeploy.

### Fix #3.1 — Persistir tokens de reset en Supabase

Crear tabla + migración `supabase/password_reset_tokens_migration.sql`:

```sql
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  email      TEXT        PRIMARY KEY,
  token      TEXT        NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used       BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies
    WHERE tablename='password_reset_tokens' AND policyname='service_role_only') THEN
    CREATE POLICY "service_role_only" ON password_reset_tokens USING (true) WITH CHECK (true);
  END IF;
END $$;
```

Reescribir `reset-token-store.ts` para usar Supabase (service role), manteniendo la
**misma firma** (`saveResetToken`, `checkResetToken`, `consumeResetToken`) para no
tocar a los callers. `save` hace `upsert` por `email` (PK), `check` compara token +
`expires_at` + `used`, `consume` borra (o marca `used=true`).

> Decisión a confirmar en ejecución: dejar `otp-store` y `rate-limit` en memoria
> por ahora (OTP es de vida corta y mismo flujo; rate-limit degradado no es crítico)
> **o** migrarlos igual. Recomendación: migrar al menos `otp-store` por consistencia,
> dejar `rate-limit` en memoria (aceptable como best-effort). Esto se decide al ejecutar.

### Validación Bug #3
- `forgot` → reiniciar el server (`npm run build && npm start`) → `reset` con el
  enlace → **funciona** (el token sobrevive porque está en DB).

---

## Bug #2 — "Revisar acciones" abre ventana nueva / pide login

### Traza del flujo (verificada)

1. Renderer: botón → [`desktop/.../App.tsx:629-632`](desktop/src/renderer/src/App.tsx#L629-L632) → `onOpenDashboard()` → `window.electronAPI.openDashboard(jobSessionId)`.
2. Preload: [`desktop/src/preload/index.ts:42`](desktop/src/preload/index.ts#L42) → IPC `open-dashboard`.
3. Main: [`desktop/src/main/index.ts:258-264`](desktop/src/main/index.ts#L258-L264):

   ```ts
   ipcMain.on('open-dashboard', (_e, sessionId?: string) => {
     const url = `${base}?section=meetaction&session=...`
     shell.openExternal(url)   // ⬅️ abre el navegador POR DEFECTO del SO
   })
   ```

### Por qué pide login

El dashboard **no vive dentro de Electron** (Electron carga su propio renderer
local). Vive en el navegador del usuario. `shell.openExternal` abre el navegador
**predeterminado del SO**, que puede no ser donde el usuario inició sesión → pide
login. Además siempre abre pestaña/ventana nueva.

> Aclaración importante: la idea literal de "reusar la ventana del dashboard ya
> abierta" no es posible desde Electron — un proceso no controla pestañas de un
> navegador externo. Lo realista es: **minimizar la ventana de grabación** (lo que
> el usuario pidió) y, cuando haga falta abrir, asegurar que el login aterrice en
> el destino correcto (ya resuelto por el trabajo previo de `callbackUrl`).

### Opciones

| Opción | Qué hace | Pros | Contras |
|--------|----------|------|---------|
| **A — Solo minimizar** (recomendada para ese botón) | Al pulsar "Revisar acciones", ocultar/minimizar la ventana de Electron para revelar el dashboard que el usuario ya tiene abierto detrás | Cero ventanas nuevas, cero login. Es literalmente lo pedido | No navega el dashboard ya abierto a la sesión específica; si no hay dashboard abierto, no muestra nada |
| **B — Minimizar + abrir solo si hace falta** | Minimizar la ventana de Electron **y** lanzar `openExternal` al deep-link (con `section`+`session`) | Lleva a la sesión exacta; el `callbackUrl` ya hace que un login aterrice bien | Puede abrir pestaña nueva si el navegador no reusa; persiste el caso "navegador distinto" |
| **C — Embeber dashboard en Electron** | Cargar el dashboard web dentro de un `BrowserWindow`/webview de Electron | Sesión 100% controlada, sin navegador externo | Cambio arquitectónico grande y riesgoso. **Descartada** |

### Recomendación

**Opción A como comportamiento principal del botón "Revisar acciones"**, porque es
exactamente lo que el usuario pidió ("minimizar la ventana de grabación dejando
visible el dashboard ya abierto") y elimina por completo el problema de
login/ventanas nuevas. Mantener los botones "Abrir dashboard →" del pie
([`App.tsx:717`](desktop/src/renderer/src/App.tsx#L717)) con `openExternal` para el
caso en que el usuario quiera abrirlo explícitamente.

Opcionalmente añadir un matiz de Opción B detrás del mismo botón: minimizar **y**
hacer `openExternal` al deep-link, pero solo si se decide en ejecución (tiene el
riesgo del "navegador distinto"). Por defecto se implementa A.

### Fix #2.1 — Main process

En `open-dashboard` (o un nuevo canal `focus-dashboard`), en vez de
`shell.openExternal`, minimizar/ocultar la ventana:

```ts
ipcMain.on('open-dashboard', (_e, sessionId?: string) => {
  // Revela el dashboard que el usuario ya tiene abierto detrás de la app.
  mainWindow?.minimize()
})
```

> Si se elige el matiz B, conservar el `openExternal` además del `minimize()`.

### Fix #2.2 — Renderer (opcional, claridad)

Renombrar el texto/handler si conviene (p. ej. el botón "Revisar acciones" llama a
un `onReviewActions` que minimiza). El botón "Abrir dashboard →" del pie conserva
`openDashboard()` con apertura externa. Mantener compatibilidad de la API del
preload.

### Validación Bug #2
- Grabar → "Revisar acciones" → la ventana de Electron se minimiza y queda visible
  el navegador con el dashboard. No se abre ventana nueva, no pide login.
- Botón "Abrir dashboard →" del pie sigue abriendo el navegador (deep-link), y si
  pide login, tras autenticarse aterriza en `?section=meetaction` (gracias a
  `callbackUrl` ya implementado).

---

## Auditoría rápida — ambos tipos de cuenta

| Flujo | Cuenta manual | Cuenta Google pura | Estado tras fixes |
|-------|---------------|--------------------|-------------------|
| Registro | OK | OK (callback `auth.ts:79-95`) | sin cambios |
| Login manual | OK | OK una vez fija password (#1.2) | ✅ |
| Login Google | OK (no sobreescribe password) | OK | ✅ sin cambios |
| Recuperar/fijar password | OK | **arreglado** (#1.1 + #1.2) | ✅ |
| Reset con server reiniciado | **arreglado** (#3.1) | **arreglado** | ✅ |

Otros puntos revisados (sin acción requerida, solo verificar en ejecución):
- `auth.ts` ya **no** sobreescribe `provider`/`password_hash` al linkear Google → linking correcto.
- `consumeResetToken` se llama tras éxito → no replay.
- Anti-enumeración se mantiene en `forgot` (200 genérico para email inexistente).

---

## Limpieza de residuos (para dejar listo para producción)

Durante la ejecución, hacer también:

1. **Verificar/retirar logs ruidosos** introducidos en debug (no dejar `console.log`
   de tokens ni emails; el `[DEV]` de `forgot/route.ts:88` está bien porque es
   `NODE_ENV !== production`).
2. **Archivos temporales / scratch**: confirmar que no quedan `.md` de planes
   antiguos sin referenciar ni archivos de prueba en la raíz.
3. **Migraciones**: añadir `password_reset_tokens_migration.sql` al orden documentado
   en `README.md` / `CLAUDE.md` (justo después de `user_profiles_migration.sql`).
4. **Build artifacts**: confirmar que `desktop/out`, `.next`, etc. siguen en
   `.gitignore` (ya cubierto por commit `e274cfa`).
5. **Sin imports muertos** tras editar `reset-token-store.ts` (quitar tipos/imports
   que dejen de usarse).

---

## Plan de ejecución

### Fase 1 — Bug #1 (rápido, sin dependencias)
1. Editar `src/app/api/auth/password/forgot/route.ts` (Fix #1.1).
2. Editar `src/app/api/auth/password/reset/route.ts` (Fix #1.2).

### Fase 2 — Bug #3 (habilita que #1 funcione en prod)
3. Crear `supabase/password_reset_tokens_migration.sql`.
4. Reescribir `src/lib/reset-token-store.ts` → backend Supabase (misma firma).
5. (Decisión en ejecución) migrar `otp-store.ts` igual; dejar `rate-limit` en memoria.
6. Documentar la migración en `README.md` y `CLAUDE.md`.

### Fase 3 — Bug #2 (desktop, independiente)
7. Editar `desktop/src/main/index.ts` handler `open-dashboard` (Fix #2.1).
8. Ajustar `desktop/src/renderer/src/App.tsx` si se separa "Revisar acciones" de
   "Abrir dashboard" (Fix #2.2).

### Fase 4 — Validación y limpieza
9. `npx tsc --noEmit` (web) y build del desktop (`cd desktop && npm run build`).
10. `npm test` (web).
11. `npm run build` (web).
12. Pruebas manuales de los 3 bugs según las secciones "Validación".
13. Limpieza de residuos (sección anterior).

### Estimado de cambios
- **Web:** 3 archivos editados + 1 reescrito + 1 migración nueva (+ docs) ≈ 6 archivos.
- **Desktop:** 1–2 archivos editados.
- **Total:** ~7–8 archivos. Sin cambios de esquema destructivos (todo `IF NOT EXISTS`).

---

## Qué NO tocar (evitar regresiones)

- ❌ El callback `signIn`/`jwt` de [`auth.ts`](auth.ts) — el account-linking ya quedó correcto.
- ❌ La lógica anti-enumeración (`genericOk()` para emails inexistentes).
- ❌ El proveedor de email (`src/lib/email.ts`) — funciona; el bug no estaba ahí.
- ❌ El trabajo previo de `callbackUrl` (dashboard → auth → verify) — ya resuelve el login-landing.
- ❌ La firma pública de `reset-token-store` ni de `electronAPI` (mantener compatibilidad).
- ❌ Migraciones marcadas deprecated (`zoom_migration.sql`, `desktop_migration.sql`).
