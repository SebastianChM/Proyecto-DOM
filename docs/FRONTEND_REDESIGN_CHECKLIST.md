# DOM BIM Platform — Frontend Redesign Checklist

> Prototipo aprobado: v4 (dark-first, inspirado en Linear/Geist/shadcn)
> Archivo de referencia: `docs/prototype/index.html`
> Inicio: 2026-04-15

---

## FASE 0 — Cimientos del Design System

- [x] **0.1** `globals.css` — Reescribir CSS variables light + dark con tokens v4 (Zinc scale)
- [x] **0.2** `globals.css` — Eliminar clases legacy: glass-panel, glass-card, glass-button, text-glow, animate-float
- [x] **0.3** `globals.css` — Agregar tokens nuevos: --sidebar, --brand-subtle, --brand-glow, semantic colors
- [x] **0.4** `tailwind.config.ts` — Actualizar colores: brand scale, sidebar, semantic (green/amber/red/blue/violet)
- [x] **0.5** `tailwind.config.ts` — Ajustar --radius de 1rem a 0.625rem (10px)
- [x] **0.6** `tailwind.config.ts` — Limpiar animaciones innecesarias, mantener fade-in y accordion
- [x] **0.7** `layout.tsx` (root) — Cambiar defaultTheme de "light" a "dark"
- [x] **0.8** Verificar que shadcn components compilan sin errores tras cambio de tokens

## FASE 1 — App Shell (Layout + TopBar)

- [x] **1.1** `dashboard/layout.tsx` — Eliminar los 3 divs de ambient glow (blue/purple/cyan blobs)
- [x] **1.2** `dashboard/layout.tsx` — Quitar NotificationBell+UserMenu flotante (top-right fixed)
- [x] **1.3** Crear `components/TopBar.tsx` — Breadcrumbs auto + search trigger ⌘K + bell + avatar
- [x] **1.4** `dashboard/layout.tsx` — Integrar TopBar, ajustar padding (ml-[232px], p-0)
- [x] **1.5** Verificar que todas las rutas del dashboard renderizan correctamente

## FASE 2 — Sidebar

- [x] **2.1** `Sidebar.tsx` — Cambiar w-64 a w-[232px], header compacto (h-auto)
- [x] **2.2** `Sidebar.tsx` — Agrupar nav en 4 secciones: Main, Analysis, Compliance, System con labels
- [x] **2.3** `Sidebar.tsx` — Active state: bg-brand-subtle + text-brand + left indicator (2.5px bar)
- [x] **2.4** `Sidebar.tsx` — Eliminar glass-card del footer, simplificar user section
- [x] **2.5** `Sidebar.tsx` — Sidebar bg: usar token sidebar (más tenue que content area)
- [x] **2.6** `dashboard/layout.tsx` — Actualizar ml-64 → ml-[232px] en main content

## FASE 3 — Login

- [x] **3.1** `app/page.tsx` — Panel izquierdo: gradient #0c0a1a + radial glows + grid pattern
- [x] **3.2** `app/page.tsx` — Titulo: gradient text en "Future" con background-clip
- [x] **3.3** `app/page.tsx` — Panel derecho: quitar glassmorphism, usar bg-app + card limpio
- [x] **3.4** `app/page.tsx` — Boton brand: gradient #6366f1→#4f46e5, glow on hover

## FASE 4 — Dashboard

- [x] **4.1** `dashboard/page.tsx` — Stat cards: nuevo layout (icon+label arriba, val 22px, trend pill)
- [x] **4.2** `dashboard/page.tsx` — Titulo: text-5xl → text-xl, eliminar animaciones slide-in
- [x] **4.3** `dashboard/page.tsx` — Quitar glass-panel de cards, usar border + shadow-xs pattern
- [x] **4.4** `dashboard/page.tsx` — Reducir spacing general (gap-6 → gap-2.5)

## FASE 5 — Páginas Principales

- [x] **5.1** `projects/page.tsx` — Toolbar con search + filters + grid/list tabs
- [x] **5.2** `projects/page.tsx` — Project cards: border definido + shadow-sm, status pills con borde
- [x] **5.3** `files/page.tsx` — File type badges coloreados (RVT=blue, DWG=pink, PDF=red, IFC=green)
- [x] **5.4** `files/page.tsx` — Status pills bordered, action buttons icon-only compactos
- [x] **5.5** `bom/page.tsx` — Table header: uppercase 9.5px bg-muted, hover row bg-brand-subtle
- [x] **5.6** `compliance/results/page.tsx` — Severity pills con dot+borde, score ring conic-gradient

## FASE 6 — Settings

- [x] **6.1** `settings/page.tsx` — Layout sidebar nav (170px) + content area
- [x] **6.2** `settings/page.tsx` — Profile card: avatar + role badge, toggle switches nuevo estilo

## FASE 7 — shadcn/ui Component Tweaks

- [x] **7.1** `ui/button.tsx` — Primary: gradient bg + inner highlight, ajustar tamaños
- [x] **7.2** `ui/card.tsx` — Default: border + shadow-xs (quitar shadow default pesado)
- [x] **7.3** `ui/badge.tsx` — Variantes semánticas: success, warning, destructive, info con borde
- [x] **7.4** `ui/input.tsx` — Focus: brand glow ring (0 0 0 2px brand-glow)
- [x] **7.5** `ui/table.tsx` — Header uppercase smaller bg-muted, row hover bg-brand-subtle

---

## Notas de Progreso

| Fecha      | Fase     | Detalle                                                                                                                                                                                                                                                         |
| ---------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2025-07-25 | Fase 0   | ✅ Completada — globals.css reescrito con tokens v4 (light+dark), tailwind.config.ts actualizado (brand, sidebar, semantic, radius 0.625rem, animaciones limpiadas), defaultTheme="dark", build OK. Fix bug preexistente en files/page.tsx (fragment faltante). |
| 2025-07-25 | Fase 1   | ✅ TopBar.tsx creado (breadcrumbs + search ⌘K + bell + avatar), dashboard/layout.tsx limpiado (sin ambient glows, sin bell/menu flotante).                                                                                                                      |
| 2025-07-25 | Fase 2   | ✅ Sidebar reescrita: 4 grupos (Main/Analysis/Compliance/System), header compacto h-12, active state con bg-brand-subtle + left indicator, bg-sidebar token.                                                                                                    |
| 2025-07-25 | Fase 3   | ✅ Login: 2-column layout, left panel gradient #0c0a1a + radial glows + grid, gradient text "Future", gradient brand button.                                                                                                                                    |
| 2025-07-25 | Fase 4   | ✅ Dashboard: StatCards compactos (icon+label, 22px value, trend pill), título text-xl, spacing gap-2.5, activity cards con border+hover.                                                                                                                       |
| 2025-07-25 | Fase 5   | ✅ Projects: header compacto, cards con border+shadow-xs. Bulk sed: glass-panel/glass-card/glass-button/dom-bim-blue eliminados en ~30 archivos. rounded-2xl→lg, shadow reducidos.                                                                              |
| 2025-07-25 | Fase 6-7 | ✅ Settings: header text-xl. UI components: button (sizes h-9, outline=border), card (shadow-xs), badge (+success/warning/info variants), input (h-9), select (semantic tokens).                                                                                |
