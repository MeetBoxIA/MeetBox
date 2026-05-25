# MeetBox — Landing Page

Landing page oficial de **MeetBox**, un sistema de transcripción y resúmenes de reuniones en tiempo real. Funciona tanto con el **Dispositivo físico** (sala de juntas presencial) como con la **app Desktop** (videollamadas en Zoom, Meet, Teams).

---

## Stack

| Tecnología | Versión |
|---|---|
| Next.js (App Router) | 15 |
| TypeScript | 5 |
| Tailwind CSS | 3 |
| shadcn/ui | — |
| GSAP + SplitText | 3.15 |
| Framer Motion | — |
| Lucide React | — |
| React Icons | — |
| Bun | runtime y package manager |

---

## Requisitos

- **Bun** instalado (`curl -fsSL https://bun.sh/install | bash`)
- Node.js no requerido

---

## Instalación

```bash
bun install
```

## Desarrollo

```bash
bun run dev
```

Abre [http://localhost:3000](http://localhost:3000)

## Build de producción

```bash
bun run build
bun run start
```

---

## Estructura del proyecto

```
src/
├── app/
│   ├── layout.tsx          # Metadata global (título, favicon)
│   ├── page.tsx            # Ensamble de todas las secciones
│   ├── auth/               # Página de login / registro
│   ├── terms/              # Términos de servicio
│   └── privacy/            # Política de privacidad
│
├── components/
│   ├── ui/
│   │   ├── hero-section.tsx     # Hero + navbar principal
│   │   ├── floating-nav.tsx     # Navbar flotante al hacer scroll
│   │   ├── split-text.tsx       # Animación de texto con GSAP SplitText
│   │   ├── logo-loop.tsx        # Carrusel infinito de logos (rAF)
│   │   ├── auth-tabs-card.tsx   # Formulario de login/registro
│   │   └── ...                  # Primitivos shadcn (button, input, tabs…)
│   │
│   └── landing/
│       ├── problem-section.tsx      # Problema que resuelve MeetBox
│       ├── products-section.tsx     # Dispositivo vs Desktop + banner animado
│       ├── how-it-works.tsx         # 3 pasos del flujo
│       ├── video-section.tsx        # Espacio para video demo
│       ├── integrations-section.tsx # Carrusel de integraciones + cards
│       ├── meety-section.tsx        # Asistente IA "Meety" (buscador)
│       ├── pricing-section.tsx      # Planes de precio
│       └── cta-section.tsx          # Call to action final
│
public/
└── favicon.svg             # Logo MeetBox como favicon
```

---

## Secciones de la landing

1. **Hero** — titular animado, badges Dispositivo + Desktop, CTAs
2. **Problema** — por qué las reuniones pierden acuerdos
3. **Productos** — comparativa Dispositivo ($149.99) vs Desktop ($23.99/mes) + ticker de features compartidas
4. **Cómo funciona** — 3 pasos: botón → IA → resumen
5. **Video demo** — espacio reservado para video del producto
6. **Integraciones** — carrusel de logos + cards de Slack, Jira, Google Calendar
7. **Meety** — asistente IA con respuestas sobre MeetBox
8. **Precios** — Dispositivo $149.99 · Por sala $23.99/mes · Empresa $184.99/mes
9. **CTA** — cierre con llamada a acción

---

## Rutas

| Ruta | Descripción |
|---|---|
| `/` | Landing page completa |
| `/auth?tab=sign-in` | Inicio de sesión |
| `/auth?tab=sign-up` | Registro |
| `/terms` | Términos de servicio |
| `/privacy` | Política de privacidad |

---

## Decisiones técnicas

- **Bun exclusivo** — no se usa npm/npx/node en ningún script
- **Sin CSS variables en componentes de auth** — se usan clases Tailwind directas para evitar el bug de HTML sin estilos cuando los tokens de shadcn no están cargados
- **`suppressHydrationWarning` en `<html>`** — evita error de hidratación por extensiones del navegador (ej. LanguageTool)
- **`React.createElement(tag as string, ...)`** — usado en SplitText para evitar el error de TypeScript con tags dinámicos en JSX
- **LogoLoop con rAF** — carrusel infinito sin dependencias externas, con easing de velocidad suave y efecto fade en los bordes
