# PLAN — Auditoría y Preparación para Producción (MeetBox)

> Generado tras **ejecutar y verificar** el estado real del proyecto (no especulación).
> No se modificó ningún archivo de código durante la auditoría. Este documento
> describe estado actual, hallazgos concretos y los cambios exactos a aplicar.

---

## Estado actual verificado (ejecutado el 2026-06-27)

| Check | Comando | Resultado | Exit |
|-------|---------|-----------|------|
| Type-check web | `npx tsc --noEmit` | ✅ Limpio | 0 |
| Type-check desktop | `cd desktop && npx tsc --noEmit` | ✅ Limpio | 0 |
| Tests | `npm test -- --run` | ✅ **103/103** (7 archivos) | 0 |
| Build web | `npx next build` | ✅ Compila | 0 |
| Build desktop | `cd desktop && npx electron-vite build` | ✅ Compila | 0 |
| Lint web | `npm run lint` | ⚠️ **No configurado** (prompt interactivo) | — |

**Conclusión:** el proyecto **compila y pasa tests hoy**. Lo que falta para "listo
para producción" no es arreglar build roto, sino: (1) eliminar código muerto/inseguro,
(2) limpiar residuos de compilación, (3) configurar lint, (4) documentar, (5) commitear.

---

## Resumen de hallazgos (por severidad)

| # | Hallazgo | Severidad | Sección |
|---|----------|-----------|---------|
| H1 | Rutas Zoom per-user OAuth huérfanas (`zoom/route.ts`, `zoom/callback/route.ts`) — código muerto que contradice S2S **y filtra `client_id` por console.log** | 🔴 CRÍTICO | §5 |
| H2 | Artefactos `.d.ts` regados por `desktop/src` (10 archivos shadowing) — misma causa raíz del bug que ya corregimos | 🔴 CRÍTICO | §2 |
| H3 | `npm run lint` no está configurado → colgaría en CI | 🔴 CRÍTICO | §1 |
| H4 | `.gitignore` ignora `desktop/**/*.d.ts` → oculta `env.d.ts` legítimo; además `env.d.ts` está desactualizado y es redundante | 🟠 IMPORTANTE | §2 |
| H5 | Migraciones nuevas y cambios sin commitear (24 modificados, 2 borrados, 4 nuevos) | 🟠 IMPORTANTE | §6 |
| H6 | `console.log` de OTP/reset link (dev-only, ya protegidos) — verificar que sigan guardados por `NODE_ENV` | 🟢 OPCIONAL | §5 |
| H7 | `PLAN_AUTH_BUGS_FIX.md` y este `PLAN_PRODUCTION_AUDIT.md` en la raíz — decidir si se versionan o se borran | 🟢 OPCIONAL | §2 |
| H8 | Renderer desktop bundle 586 kB (sin code-splitting) | 🟢 OPCIONAL | §5 |

---

## §1. Verificación de compilación y tests

Comandos en orden, con resultado esperado. **Todos deben pasar antes de marcar listo.**

```bash
# 1. Web — type-check (esperado: sin salida, exit 0)
npx tsc --noEmit

# 2. Web — tests (esperado: "103 passed", exit 0)
npm test -- --run

# 3. Web — build producción (esperado: "✓ Compiled successfully", exit 0)
npx next build

# 4. Desktop — type-check (esperado: sin salida, exit 0)
cd desktop && npx tsc --noEmit && cd ..

# 5. Desktop — build (esperado: 3 bundles "✓ built", exit 0)
cd desktop && npx electron-vite build && cd ..
```

### 🔴 CRÍTICO — H3: `npm run lint` no funciona

`npm run lint` (que ejecuta `next lint`) **lanza un prompt interactivo** de
configuración de ESLint porque no hay config. En CI/CD esto **cuelga el pipeline**.

**Acción:** crear configuración de ESLint no interactiva. Opción mínima recomendada
(`.eslintrc.json` en la raíz):

```json
{
  "extends": "next/core-web-vitals"
}
```

Verificar que `eslint-config-next` esté en `devDependencies` (Next 15 lo trae). Luego:

```bash
npm run lint   # esperado ahora: corre sin prompt, exit 0 (o lista warnings reales)
```

> **Riesgo:** si al configurarlo aparecen muchos errores de lint preexistentes,
> NO arreglar todo a mano en este plan. Marcar reglas problemáticas como `warn`
> y dejar el pipeline verde; los warnings se atacan después. No bloquear producción
> por estilo.

---

## §2. Auditoría de residuos

### 🔴 CRÍTICO — H2: artefactos `.d.ts` en `desktop/src`

La limpieza anterior borró los `.js`/`.jsx` accidentales pero **dejó los `.d.ts`**
del mismo `tsc` errante. Son 10 artefactos (cada uno tiene un `.ts`/`.tsx` hermano):

```
src/main/index.d.ts
src/preload/index.d.ts
src/renderer/src/App.d.ts
src/renderer/src/main.d.ts
src/renderer/src/types.d.ts
src/renderer/src/components/{ConnectScreen,RecordButton,SettingsPanel,TitleBar,TranscriptPanel}.d.ts
```

**Acción — borrar solo los artefactos (preservar `env.d.ts`):**

```bash
cd desktop
for f in $(find src -name "*.d.ts" ! -name "env.d.ts"); do
  base="${f%.d.ts}"
  if [ -f "${base}.ts" ] || [ -f "${base}.tsx" ]; then rm "$f"; echo "borrado: $f"; fi
done
cd ..
# Verificar que tsc sigue limpio tras borrar:
cd desktop && npx tsc --noEmit && cd ..
```

> **Riesgo:** borrar `env.d.ts` por error rompería el typing de `window.electronAPI`
> en el renderer. El comando lo excluye explícitamente (`! -name "env.d.ts"`).
> **Prevención futura:** ver H4 — la causa raíz es un `tsc` sin `outDir`. Confirmar
> que nadie corra `tsc` (sin `--noEmit`) dentro de `desktop/`. El script de build
> usa `electron-vite build` (que emite a `out/`), así que el flujo normal está bien.

### 🟠 IMPORTANTE — H4: `.gitignore` demasiado amplio + `env.d.ts` problemático

`.gitignore` (raíz) tiene:
```
desktop/**/*.d.ts
desktop/**/*.js
desktop/**/*.jsx
```
Esto ignora también el **legítimo** `desktop/src/renderer/src/env.d.ts`, que por tanto
**no está versionado**. Además, ese `env.d.ts`:
- Está **desactualizado**: declara `openDashboard` pero **no** `focusDashboard` (el que añadimos).
- Es **redundante**: el preload ya hace `declare global { interface Window { electronAPI: typeof api } }`,
  que es la fuente de verdad siempre sincronizada.

**Decisión a tomar en ejecución (recomendación: Opción A):**

- **Opción A (recomendada) — eliminar `env.d.ts` y depender del preload.**
  Verificar primero que el `tsconfig` del renderer incluye el preload (o ajustar
  `include`), borrar `env.d.ts`, correr `npx tsc --noEmit` en desktop. Si pasa, el
  tipo `electronAPI` viene del preload (siempre correcto) y se elimina la fuente de
  desincronización. Mantener el `.gitignore` como está.
- **Opción B — conservar `env.d.ts`:** regenerarlo a mano con `focusDashboard`,
  forzar tracking (`git add -f desktop/src/renderer/src/env.d.ts`) y **estrechar** el
  gitignore para no ignorarlo. Más frágil (hay que mantenerlo sincronizado).

> **Riesgo de no hacer nada:** un clone limpio + `tsc` en desktop podría fallar
> (env.d.ts ausente) si el preload no está en el scope del renderer. El build con
> `electron-vite` NO lo detecta (esbuild no type-checkea), así que el fallo solo
> aparecería en CI con `tsc` o en el editor de otro dev.

### Residuos de build (NO versionar — ya cubiertos por `.gitignore`)

Seguros de borrar para una verificación limpia (se regeneran):

```bash
# Raíz (web)
rm -rf .next
# Desktop
rm -rf desktop/out
# Caché de perfil de Electron (NO toca sesión; connection.json se conserva)
#   solo si se quiere un arranque 100% limpio:
#   rm -rf "$APPDATA/meetbox-desktop/Cache" "$APPDATA/meetbox-desktop/Code Cache" "$APPDATA/meetbox-desktop/GPUCache"
```

`.gitignore` **sí cubre**: `node_modules/`, `.next/`, `out/`, `dist/`, `build/`
(con excepción `!desktop/build/`), `.env*.local`, `coverage/`, `*.tsbuildinfo`.
**No requiere cambios** salvo la decisión de H4.

### 🟢 OPCIONAL — H7: archivos de plan en la raíz

`PLAN_AUTH_BUGS_FIX.md` y `PLAN_PRODUCTION_AUDIT.md` están sin trackear. Decidir:
versionarlos en una carpeta `docs/` o borrarlos antes del commit final. No afectan
producción. `LEVANTAMIENTO_MEETBOX.md` ya está versionado — dejar como está.

---

## §3. Validación de funcionalidad crítica

Flujos a probar manualmente (el build/test no los cubre end-to-end). Para cada uno,
los archivos donde vive la lógica:

| Flujo | Probar que… | Archivos clave |
|-------|-------------|----------------|
| Registro Google | crea usuario `provider=google` | [auth.ts](auth.ts) (callback `signIn`) |
| Registro manual + OTP | envía y verifica código de 6 dígitos | [otp/send](src/app/api/auth/otp/send/route.ts), [otp/verify](src/app/api/auth/otp/verify/route.ts), [otp-store.ts](src/lib/otp-store.ts) |
| Login manual | entra con email+password | [auth.ts](auth.ts) (Credentials) |
| Login Google | entra y no pisa password_hash | [auth.ts](auth.ts) |
| **Recuperar contraseña (cuenta Google)** | llega email **y** permite fijar password | [password/forgot](src/app/api/auth/password/forgot/route.ts), [password/reset](src/app/api/auth/password/reset/route.ts), [reset-token-store.ts](src/lib/reset-token-store.ts) |
| Recuperar contraseña (cuenta manual) | sigue funcionando (no regresión) | idem |
| Deep-link desktop | "Revisar acciones" **minimiza**, no abre ventana | [desktop main](desktop/src/main/index.ts) (`focus-dashboard`), [App.tsx:432](desktop/src/renderer/src/App.tsx#L432) |
| callbackUrl tras login | login aterriza en `?section=meetaction` | [dashboard/page.tsx](src/app/dashboard/page.tsx), [auth-tabs-card.tsx](src/components/ui/auth-tabs-card.tsx), [verify-client.tsx](src/app/auth/verify/verify-client.tsx) |
| Zoom (crear reunión) | usa S2S vía env vars, no OAuth per-user | [zoom.ts](src/lib/integrations/zoom.ts), [execute route](src/app/api/meetaction/sessions/[id]/execute/route.ts) |
| Meety AI | responde y usa tools (o fallback sin API key) | [meety-tools.ts](src/lib/meety-tools.ts), [messages route](src/app/api/meety/conversations/[id]/messages/route.ts) |

> **Prerequisito DB:** correr en Supabase las 4 migraciones nuevas/críticas:
> `user_profiles_migration.sql`, `password_reset_tokens_migration.sql`,
> `otp_codes_migration.sql` (ver §4). Sin ellas, recuperación de contraseña y OTP
> fallan con "enlace no válido" / "código inválido".

---

## §4. Actualización de documentación

### README.md
Ya actualizado con el orden de migraciones (incluye `user_profiles`, `password_reset_tokens`,
`otp_codes`) y la sección de Zoom S2S. **Acción de verificación:**
- Confirmar que la sección de variables de entorno documenta las de Zoom S2S:
  `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_USER_EMAIL`.
- Confirmar que `BREVO_API_KEY` / `RESEND_*` / `SMTP_*` estén documentadas (proveedor de email).

### CLAUDE.md
Ya apunta al README para el orden de migraciones. **Acción:** tras eliminar las rutas
Zoom huérfanas (H1), verificar que CLAUDE.md no las mencione como existentes.

### Migraciones / env vars a documentar
- Si H1 elimina rutas Zoom per-user, quitar de cualquier doc referencias a
  `/api/auth/zoom` (GET) y `/api/auth/zoom/callback` como endpoints OAuth.

---

## §5. Limpieza de código

### 🔴 CRÍTICO — H1: rutas Zoom per-user huérfanas (código muerto + fuga de secreto)

`src/app/api/auth/zoom/route.ts` y `src/app/api/auth/zoom/callback/route.ts`:
- Implementan **OAuth per-user** (redirect a `zoom.us/oauth/authorize`) — abandonado
  al migrar a Server-to-Server.
- **No están referenciadas** en ningún lado (verificado: solo `zoom/status` se usa,
  en [dashboard-shell.tsx:1488](src/components/dashboard/dashboard-shell.tsx#L1488)).
- [zoom/route.ts](src/app/api/auth/zoom/route.ts) **loguea el `client_id`** por consola
  (líneas 21-28) — fuga de info en logs de producción.
- Tienen `REDIRECT_URI` hardcodeado a `http://localhost:3000` (líneas 24, 39 del callback).

**Acción — eliminar ambas rutas, conservar solo `status`:**

```bash
rm src/app/api/auth/zoom/route.ts
rm src/app/api/auth/zoom/callback/route.ts
# Conservar: src/app/api/auth/zoom/status/route.ts
# Verificar que nada más las referencia (debe dar 0 resultados fuera de status):
grep -rn "auth/zoom\"" src/ | grep -v "zoom/status"
npx tsc --noEmit && npx next build   # deben seguir pasando
```

> **Riesgo:** si alguna integración externa (Zoom Marketplace) aún apunta a esos
> callbacks, dejarían de existir — pero al ser S2S ya no se usan. Bajo riesgo.

### 🟢 OPCIONAL — H6: console.log restantes

Inventario verificado (11 ocurrencias en 4 archivos):
- [logger.ts](src/lib/logger.ts) — **legítimo** (es el logger).
- [password/forgot:88](src/app/api/auth/password/forgot/route.ts#L88) — reset link **solo en dev** (`NODE_ENV !== production`). OK.
- [otp/send](src/app/api/auth/otp/send/route.ts) — imprime OTP. **Verificar** que esté guardado por `NODE_ENV !== "production"`; si no, envolverlo.
- [zoom/route.ts](src/app/api/auth/zoom/route.ts) — **se elimina con H1**.

**Acción:** revisar el bloque de `otp/send` y confirmar el guard de entorno.

### 🟢 OPCIONAL — H8: tamaño del bundle del renderer desktop

586 kB en un solo chunk. No bloquea (es app de escritorio, carga local). Mejora
futura opcional: code-splitting. **No tocar ahora.**

### TODO/FIXME
Solo 2, ambos menores ([api-routes.test.ts](src/test/api-routes.test.ts), [jira-service.ts](src/lib/services/jira-service.ts)). Revisar texto; no bloquean.

---

## §6. Plan de ejecución

### Orden recomendado

1. **Limpieza de residuos primero** (estado limpio para validar):
   - H2: borrar artefactos `.d.ts` del desktop (script en §2).
   - H4: decidir Opción A/B para `env.d.ts`.
2. **Eliminar código muerto:**
   - H1: borrar rutas Zoom huérfanas.
3. **Configurar lint:**
   - H3: crear `.eslintrc.json`, correr `npm run lint`.
4. **Documentación:**
   - §4: verificar README/CLAUDE tras los borrados.
   - H7: decidir destino de los `PLAN_*.md`.
5. **Validación final completa** (todos deben pasar):
   ```bash
   npx tsc --noEmit                              # web
   npm test -- --run                             # 103/103
   npm run lint                                  # exit 0
   npx next build                                # ✓
   cd desktop && npx tsc --noEmit && npx electron-vite build && cd ..
   ```
6. **Commit** (§ siguiente).

### Qué hacer si algo falla
- **tsc falla tras borrar `.d.ts`/`env.d.ts`:** revertir el borrado de `env.d.ts`
  (Opción B de H4) o ajustar `include` del tsconfig del renderer.
- **build web falla tras borrar rutas Zoom:** `grep -rn "auth/zoom"` para encontrar
  la referencia colgante y limpiarla.
- **lint explota con cientos de errores:** bajar reglas a `warn`, no bloquear.

### Commit final
Trabajamos en branch `deploy`. Agrupar en un commit claro:
```bash
git add -A
git status   # revisar que NO entren residuos (.next, out, .d.ts artefactos)
git commit   # mensaje describiendo: cleanup Zoom dead code, .d.ts artifacts,
             # eslint config, migraciones nuevas, fixes auth/desktop
```
> **No** hacer push automático — confirmar con el usuario antes (regla del repo).

### Criterio de "listo para producción"
- [ ] tsc web + desktop limpios
- [ ] 103/103 tests
- [ ] `npm run lint` corre sin prompt, exit 0
- [ ] build web + desktop OK
- [ ] sin rutas Zoom huérfanas, sin artefactos `.d.ts`, sin console.log de secretos
- [ ] 4 migraciones documentadas y corridas en Supabase
- [ ] flujos críticos de §3 probados manualmente
- [ ] cambios commiteados en `deploy`

---

## Qué NO tocar (evitar regresiones)

- ❌ El callback `signIn`/`jwt` de [auth.ts](auth.ts) — account-linking correcto.
- ❌ La lógica anti-enumeración en `forgot`.
- ❌ `src/lib/email.ts` — proveedor de email funciona.
- ❌ El trabajo de `callbackUrl` (dashboard → auth → verify).
- ❌ El handler `focus-dashboard` del desktop — recién arreglado y verificado.
- ❌ `src/app/api/auth/zoom/status/route.ts` — esta sí se usa.
- ❌ Migraciones marcadas deprecated (`zoom_migration.sql`, `desktop_migration.sql`).
- ❌ El `.gitignore` de los artefactos `.js`/`.jsx` del desktop (previene el bug que ya tuvimos).
