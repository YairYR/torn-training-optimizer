# Rediseño de shell, navegación y voz tipográfica — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir una página única de 14 paneles apilados en cinco destinos navegables con una voz tipográfica propia, sin romper las 43 páginas estáticas de SEO.

**Architecture:** Vistas sobre la History API (sin router), cinco rutas planas servidas por un rewrite de Vercel. Los componentes existentes se fusionan por destino; la lógica de adaptación al jugador se deriva una sola vez en `src/engine/stage.ts`. El sistema tipográfico pasa de 18 tamaños ad-hoc a seis tokens y de 27 reglas de mayúsculas a una.

**Tech Stack:** React 18, TypeScript 5.6, Vite 5, Vitest 2, CSS a mano (sin framework). Node 20 para `scripts/gen-seo.mjs`. Deploy: Vercel.

**Spec:** `docs/superpowers/specs/2026-09-06-frontend-shell-redesign-design.md`

## Global Constraints

- **Cero dependencias nuevas.** Ni `react-router` ni framework de CSS. Si una tarea parece necesitar una, parar y preguntar.
- **La paleta no se toca.** Los tokens de color de `:root` en `src/styles.css` (`--ink --surface --surface-2 --line --text --muted --accent --accent-dim --best --danger`) quedan con sus valores actuales, incluidos los corregidos tras el fallo de contraste de Lighthouse.
- **La matemática no se toca.** Nada bajo `src/engine/` cambia de comportamiento salvo donde el plan lo dice explícitamente (`build-ratio.ts`, tarea 9).
- **Baseline de tests: 148 pasando.** Ninguna tarea puede bajar ese número. Al terminar el plan deben ser 148 + los nuevos.
- **Familias finales:** `--display` y `--body` son ambos `'IBM Plex Sans', system-ui, sans-serif`. `--mono` sigue siendo `'JetBrains Mono', ui-monospace, monospace`. Pesos de IBM Plex Sans: 400, 500, 600, 700.
- **URL de Google Fonts final** (una sola cadena, idéntica en los cuatro lugares donde aparece):
  `https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap`
- **Rutas de la app:** `/`, `/build`, `/compare`, `/cost`, `/progress`. Ninguna otra. No colisionan con las estáticas.
- **Verificación estándar** al final de cada tarea, en este orden: `npm run typecheck` → `npx vitest run` → `npm run build`.

---

## Estructura de archivos

**Nuevos**

| Archivo | Responsabilidad |
|---|---|
| `src/engine/stage.ts` | Deriva los cinco flags de etapa del jugador. Sin React. |
| `src/engine/stage.test.ts` | Tests de `stage.ts`. |
| `src/url-state.test.ts` | Tests del parseo/armado de ruta y query. |
| `src/components/Nav.tsx` | Tabs de navegación con badges de estado. |
| `src/components/AnswerBar.tsx` | Barra fija con stat, gym y ganancia/día. |
| `src/components/YourData.tsx` | Fusión de `ApiKeyBar` + `ManualEntry`. |
| `src/routes/Plan.tsx` | Ruta `/`. |
| `src/routes/Build.tsx` | Ruta `/build`. |
| `src/routes/Compare.tsx` | Ruta `/compare`. |
| `src/routes/Cost.tsx` | Ruta `/cost`. |
| `src/routes/Progress.tsx` | Ruta `/progress`. |

**Modificados:** `src/App.tsx`, `src/url-state.ts`, `src/styles.css`, `src/engine/build-ratio.ts`, `index.html`, `vercel.json`, `scripts/gen-seo.mjs`, `public/guide/index.html`, `public/404.html`, `public/happy-jump/index.html`, `public/specialist-gyms/index.html`.

**Borrados:** `src/components/Fold.tsx`, `src/components/PlayerSummary.tsx`, `src/components/AboutSection.tsx`, `src/components/ApiKeyBar.tsx`, `src/components/ManualEntry.tsx` (su tipo `ManualData` se muda, ver tarea 11).

Los cinco archivos de `src/routes/` son delgados: componen los componentes existentes en orden y no llevan lógica de cálculo.

---

# FASE 1 — Sistema tipográfico

Independiente de todo lo demás. Se puede mergear y desplegar sola.

---

### Task 1: Tokens de escala y espaciado

**Files:**
- Modify: `src/styles.css:1-30` (bloque `:root`)

**Interfaces:**
- Produces: los tokens CSS `--fs-figure --fs-title --fs-lead --fs-base --fs-sm --fs-label` y `--sp-1 --sp-2 --sp-3 --sp-4`, que consumen las tareas 3 y 4.

- [ ] **Step 1: Agregar los tokens al final del bloque `:root`**

Insertar justo antes de la llave de cierre del `:root` existente, después de la línea `--body: 'Inter', system-ui, sans-serif;`:

```css
  /* Escala tipográfica. Seis pasos cubren todo lo que la app muestra; antes
     había 18 tamaños distintos, un font-size adivinado por componente.
     Cualquier valor nuevo va a uno de estos, no a un px suelto. */
  --fs-figure: 30px;  /* cifra principal, siempre en --mono */
  --fs-title: 20px;   /* título de ruta y de bloque */
  --fs-lead: 16px;    /* frase de apertura */
  --fs-base: 14px;    /* texto corrido y celdas */
  --fs-sm: 12px;      /* notas al pie y secundario */
  --fs-label: 11px;   /* etiquetas: el único lugar con mayúsculas */

  /* Escala de espaciado. Usar en gap, padding y margin. */
  --sp-1: 4px;
  --sp-2: 8px;
  --sp-3: 16px;
  --sp-4: 24px;
```

- [ ] **Step 2: Verificar que no rompió nada**

Run: `npm run build`
Expected: build exitoso. Ningún estilo cambia todavía — los tokens están declarados pero nadie los usa.

- [ ] **Step 3: Commit**

```bash
git add src/styles.css
git commit -m "style: agregar tokens de escala tipografica y de espaciado"
```

---

### Task 2: Cambiar las familias tipográficas

Las familias están declaradas en **cuatro fuentes distintas** y hay que cambiar las cuatro o el sitio queda cargando una fuente que no usa:

1. `src/styles.css` — los tokens `--display` / `--body` de la app.
2. `index.html` — el `<link>` y su copia en `<noscript>`.
3. `scripts/gen-seo.mjs` — la constante `FONTS`, que pone el `<link>` en las 43 páginas generadas.
4. `public/guide/index.html` — su bloque `<style>`, del que `gen-seo.mjs` **escrapea por regex** los estilos de esas mismas 43 páginas (ver `const STYLE` en `gen-seo.mjs`).

Más tres páginas escritas a mano con su propia copia: `public/404.html`, `public/happy-jump/index.html`, `public/specialist-gyms/index.html`.

**Files:**
- Modify: `src/styles.css:24-26`
- Modify: `index.html:130` y `index.html:135`
- Modify: `scripts/gen-seo.mjs:33-35`
- Modify: `public/guide/index.html` (líneas del `<link>`, el `<noscript>` y el `--display`/`--body` del `<style>`)
- Modify: `public/404.html`, `public/happy-jump/index.html`, `public/specialist-gyms/index.html` (lo mismo en cada una)

**Interfaces:**
- Consumes: nada.
- Produces: `--display` y `--body` resuelven ambos a IBM Plex Sans en toda la superficie del sitio.

- [ ] **Step 1: Cambiar los tokens de la app**

En `src/styles.css`, reemplazar las dos líneas:

```css
  --display: 'Oswald', system-ui, sans-serif;
  --body: 'Inter', system-ui, sans-serif;
```

por:

```css
  /* Una sola familia en dos roles. La jerarquía sale del peso y el tamaño,
     no de cambiar de tipografía. --display se conserva como nombre porque
     lo usan ~20 selectores; apunta a lo mismo que --body. */
  --display: 'IBM Plex Sans', system-ui, sans-serif;
  --body: 'IBM Plex Sans', system-ui, sans-serif;
```

- [ ] **Step 2: Cambiar la URL de fuentes en los siete archivos**

La cadena vieja a buscar (aparece completa en `index.html` ×2, `gen-seo.mjs` ×1, y en cada página a mano ×2):

```
https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;700&display=swap
```

La nueva:

```
https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500;700&display=swap
```

Y en el `<style>` de cada página a mano (`guide`, `404`, `happy-jump`, `specialist-gyms`), la línea:

```css
--display: 'Oswald', sans-serif; --body: 'Inter', system-ui, sans-serif; --mono: 'JetBrains Mono', monospace;
```

pasa a:

```css
--display: 'IBM Plex Sans', system-ui, sans-serif; --body: 'IBM Plex Sans', system-ui, sans-serif; --mono: 'JetBrains Mono', monospace;
```

- [ ] **Step 3: Verificar que no queda ninguna referencia vieja**

Run:

```bash
npm run seo
git grep -n "Oswald" -- . ':!public/gyms' ':!public/best-gym-for-*' ':!public/gym-dots' ':!public/gym-unlock-order' ':!public/stat-cap' ':!public/training-ratios' ':!public/xanax-vs-lsd'
git grep -cn "family=Inter" -- src index.html scripts public/guide public/404.html public/happy-jump public/specialist-gyms
```

Expected: ambos greps sin resultados (exit 1). Los directorios excluidos son generados y ya se regeneraron con `npm run seo`.

- [ ] **Step 4: Mirar el sitio**

Run: `npm run dev` y abrir `http://localhost:5173`
Expected: nada en Oswald. El texto se ve en IBM Plex Sans. Sigue todo en mayúsculas y con tamaños dispares — eso lo arreglan las tareas 3 y 4.

- [ ] **Step 5: Commit**

```bash
git add src/styles.css index.html scripts/gen-seo.mjs public/guide/index.html public/404.html public/happy-jump/index.html public/specialist-gyms/index.html scripts/lastmod.json
git commit -m "style: IBM Plex Sans reemplaza Oswald e Inter en toda la superficie"
```

`scripts/lastmod.json` entra en el commit porque `npm run seo` re-fecha las páginas cuyo HTML cambió — que es exactamente su trabajo.

---

### Task 3: Migrar los 95 `font-size` a los seis tokens

**Files:**
- Modify: `src/styles.css` (95 declaraciones repartidas por todo el archivo)

**Interfaces:**
- Consumes: los tokens `--fs-*` de la tarea 1.
- Produces: `src/styles.css` sin ningún `font-size` en px salvo dentro de `@media`.

- [ ] **Step 1: Contar el estado inicial**

Run: `grep -c "font-size" src/styles.css`
Expected: `95`

- [ ] **Step 2: Correr la migración por buckets**

Guardar como `/tmp/fs-migrate.mjs` y ejecutar con `node /tmp/fs-migrate.mjs`:

```js
import { readFileSync, writeFileSync } from 'node:fs';

// Bucket por tamaño. Los 18 valores actuales caen en seis destinos.
const bucket = (px) => {
  const n = parseFloat(px);
  if (n <= 11.5) return '--fs-label';
  if (n <= 12.5) return '--fs-sm';
  if (n <= 14) return '--fs-base';
  if (n <= 16) return '--fs-lead';
  if (n <= 22) return '--fs-title';
  return '--fs-figure';
};

const p = 'src/styles.css';
const out = readFileSync(p, 'utf8').replace(
  /font-size:\s*([\d.]+)px/g,
  (_, px) => `font-size: var(${bucket(px)})`,
);
writeFileSync(p, out);
```

- [ ] **Step 3: Verificar que no quedan px sueltos**

Run: `grep -n "font-size: *[0-9]" src/styles.css`
Expected: sin resultados (exit 1).

Run: `grep -c "font-size" src/styles.css`
Expected: `95` — la misma cantidad de declaraciones, ahora todas apuntando a un token.

- [ ] **Step 4: Corregir a mano los seis casos donde el rol no coincide con el bucket**

El bucket agrupa por tamaño, pero cuatro selectores son **cifras**, no títulos: se ven en mono y en negrita, y deben usar `--fs-figure` aunque midieran 20px. Cambiar a `font-size: var(--fs-figure)` en:

- `.stat-card .v`
- `.ptile-v`
- `.readout .v` (la línea con `font-family: var(--mono); font-weight: 700`)
- `.summary-figure` (si el bucket no le puso ya `--fs-figure`)

Y dos que son etiquetas y quedaron en `--fs-sm`, deben ir a `--fs-label`:

- `.plan-now`
- `.plan-ceiling`

- [ ] **Step 5: Mirar el resultado**

Run: `npm run dev` y abrir `http://localhost:5173`
Expected: la jerarquía se ve más pareja. Las cifras grandes siguen siendo las más grandes. Nada ilegiblemente chico ni desproporcionado.

- [ ] **Step 6: Verificar y commitear**

Run: `npm run typecheck && npx vitest run && npm run build`
Expected: typecheck limpio, 148 tests pasando, build exitoso.

```bash
git add src/styles.css
git commit -m "style: migrar los 95 font-size a los seis tokens de escala"
```

---

### Task 4: De 27 reglas de mayúsculas a una

Sobreviven solo las etiquetas: kickers, encabezados de columna y badges, donde las mayúsculas con tracking dicen "esto es una etiqueta, no una frase". Se van de títulos, nombres de gimnasios, nombres de stats, botones, celdas y nav.

**Files:**
- Modify: `src/styles.css` (27 reglas `text-transform: uppercase`)

**Interfaces:**
- Consumes: `--fs-label` de la tarea 1.
- Produces: una única regla de mayúsculas en toda la hoja.

- [ ] **Step 1: Borrar las 15 reglas que no son etiquetas**

Quitar la línea `text-transform: uppercase;` (y el `letter-spacing` que la acompaña, si lo hay) de estos selectores:

`.masthead h1` · `.about h2` · `.panel > h2` · `button` · `.subhead` · `.plan-stat` · `.plan-select` · `.plan-method` · `.roadmap-archetypes button` · `.history-head h2` · `.toggle-btn` · `.btn-primary` · `.footer-nav a` · `.cmp-col h3` · `.fold-label`

- [ ] **Step 2: Reemplazar las 12 restantes por una sola regla**

Quitar `text-transform: uppercase`, `letter-spacing` y `font-size` de estos doce selectores, y agregar al final del bloque de tokens de `src/styles.css` esta regla única:

```css
/* El único lugar del sitio con mayúsculas. Una etiqueta no es una frase:
   las versalitas con tracking marcan "esto rotula lo de al lado", que es
   información real. En un título solo hacen que todo grite igual. */
.stat-card .k,
thead th,
.readout .k,
.plan-k,
.ptile-k,
.summary-figure-unit,
.summary-next-label,
.summary-flag,
.summary-chip-muted,
.stage-badge,
.access,
.masthead .phase {
  font-size: var(--fs-label);
  font-weight: 600;
  letter-spacing: 0.11em;
  text-transform: uppercase;
  color: var(--muted);
}
```

Al mover el `color: var(--muted)` a la regla común, revisar que ninguno de los doce necesitaba otro color; `.summary-flag` y `.stage-badge` llevan color propio — dejarles su `color` en su propia regla, que gana por venir después.

- [ ] **Step 3: Verificar el conteo**

Run: `grep -c "text-transform: *uppercase" src/styles.css`
Expected: `1`

- [ ] **Step 4: Mirar el resultado**

Run: `npm run dev` y abrir `http://localhost:5173`
Expected: títulos, nombres de gimnasios y botones en mayúscula y minúscula. Solo las etiquetas chicas siguen en versalitas. Ninguna etiqueta perdió su color ni su tracking.

- [ ] **Step 5: Verificar y commitear**

Run: `npm run typecheck && npx vitest run && npm run build`
Expected: typecheck limpio, 148 tests, build exitoso.

```bash
git add src/styles.css
git commit -m "style: reducir 27 reglas de mayusculas a una sola de etiquetas"
```

**Fin de la fase 1.** Mergeable y desplegable sola.

---

# FASE 2 — Shell y rutas

---

### Task 5: `stage.ts` — la capa adaptativa

Un solo lugar deriva los flags. Nada de `if (regime === …)` desparramado por cinco componentes.

**Files:**
- Create: `src/engine/stage.ts`
- Test: `src/engine/stage.test.ts`

**Interfaces:**
- Consumes: `trainingRegime` y `Regime` de `src/engine/training-method.ts`; `evaluateBuildRatio` y `BUILD_PRESETS` de `src/engine/build-ratio.ts`; `STAT_KEYS` y `PlayerState` de `src/engine/types.ts`; `Prices` de `src/engine/cost-model.ts`.
- Produces: `interface Stage` y `export function playerStage(player: PlayerState, prices: Prices | null): Stage`. Las tareas 8, 9 y 11 lo consumen.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/engine/stage.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { playerStage } from './stage';
import { PlayerState } from './types';

const player = (stats: Partial<Record<string, number>>): PlayerState => ({
  stats: {
    strength: stats.strength ?? 0,
    defense: stats.defense ?? 0,
    speed: stats.speed ?? 0,
    dexterity: stats.dexterity ?? 0,
  },
  happy: { current: 4475, maximum: 4475 },
  energy: { current: 150, maximum: 150 },
});

describe('playerStage', () => {
  it('muestra el techo del salto a 99k solo mientras el salto conviene', () => {
    const low = playerStage(player({ strength: 100_000 }), null);
    const high = playerStage(player({ strength: 20_000_000 }), null);
    expect(low.showJumpCeiling).toBe(true);
    expect(high.showJumpCeiling).toBe(false);
  });

  it('toma el regimen del stat mas alto', () => {
    const s = playerStage(player({ strength: 20_000_000, defense: 1000 }), null);
    expect(s.regime).toBe('energy-training');
  });

  it('reconoce un build cuando el ratio cae dentro de la tolerancia de un preset', () => {
    const balanced = playerStage(
      player({ strength: 100, defense: 100, speed: 100, dexterity: 100 }),
      null,
    );
    expect(balanced.hasBuild).toBe(true);
    expect(balanced.offRatio).toBe(false);
  });

  it('marca offRatio cuando ningun preset encaja', () => {
    const lopsided = playerStage(
      player({ strength: 1_000_000, defense: 3000, speed: 900_000, dexterity: 4000 }),
      null,
    );
    expect(lopsided.offRatio).toBe(true);
  });

  it('hasPrices sigue a la presencia de precios', () => {
    expect(playerStage(player({ strength: 1000 }), null).hasPrices).toBe(false);
    expect(
      playerStage(player({ strength: 1000 }), { items: { Xanax: 900_000 }, pointPrice: 27_000 })
        .hasPrices,
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run src/engine/stage.test.ts`
Expected: FAIL — `Failed to resolve import "./stage"`.

- [ ] **Step 3: Escribir la implementación mínima**

Crear `src/engine/stage.ts`:

```ts
import { PlayerState, STAT_KEYS } from './types';
import { Prices } from './cost-model';
import { Regime, trainingRegime } from './training-method';
import { BUILD_PRESETS, evaluateBuildRatio } from './build-ratio';

/**
 * En qué etapa del juego está el jugador, para que la interfaz muestre solo lo
 * que le aplica. Se deriva una vez en App y baja por props: la alternativa es
 * que cinco componentes recalculen lo mismo y se desincronicen.
 */
export interface Stage {
  /** Régimen del stat más alto: es el que manda en el consejo de método. */
  regime: Regime;
  /** El ratio actual encaja con algún preset — el jugador sigue un build. */
  hasBuild: boolean;
  /** Sigue un build pero se salió de él: badge en el nav de /build. */
  offRatio: boolean;
  /** Hay precios de mercado cargados; sin esto /cost no puede calcular. */
  hasPrices: boolean;
  /** El salto a 99k todavía le gana al entrenamiento por energía. */
  showJumpCeiling: boolean;
}

export function playerStage(player: PlayerState, prices: Prices | null): Stage {
  const top = Math.max(...STAT_KEYS.map((s) => player.stats[s]));
  const regime = trainingRegime(top).regime;

  // El build es el preset cuyo ratio queda más cerca del reparto actual.
  // evaluateBuildRatio ya aplica la tolerancia de ±1 punto porcentual.
  const fits = BUILD_PRESETS.map((p) => evaluateBuildRatio(player.stats, p.weights));
  const onTrack = fits.some((r) => r.onTrack);

  return {
    regime,
    hasBuild: onTrack,
    offRatio: !onTrack,
    hasPrices: prices != null,
    showJumpCeiling: regime !== 'energy-training',
  };
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npx vitest run src/engine/stage.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Verificar y commitear**

Run: `npm run typecheck && npx vitest run`
Expected: typecheck limpio, 153 tests.

```bash
git add src/engine/stage.ts src/engine/stage.test.ts
git commit -m "feat: stage.ts deriva la etapa del jugador en un solo lugar"
```

---

### Task 6: Rutas en `url-state.ts`

**Files:**
- Modify: `src/url-state.ts`
- Test: `src/url-state.test.ts`

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `type Route = '/' | '/build' | '/compare' | '/cost' | '/progress'`, `export function readRoute(pathname?: string): Route`, `export function navigate(route: Route, state: SharedState): void`, y `ROUTES` (el arreglo de las cinco). `syncUrl` pasa a aceptar la ruta actual. Las tareas 7 y 8 lo consumen.

- [ ] **Step 1: Escribir el test que falla**

Crear `src/url-state.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readRoute, buildShareUrl } from './url-state';

describe('readRoute', () => {
  it('mapea cada ruta conocida', () => {
    expect(readRoute('/')).toBe('/');
    expect(readRoute('/build')).toBe('/build');
    expect(readRoute('/compare')).toBe('/compare');
    expect(readRoute('/cost')).toBe('/cost');
    expect(readRoute('/progress')).toBe('/progress');
  });

  it('tolera la barra final', () => {
    expect(readRoute('/build/')).toBe('/build');
  });

  it('cae a / con cualquier cosa desconocida', () => {
    expect(readRoute('/gyms/atlas')).toBe('/');
    expect(readRoute('/no-existe')).toBe('/');
    expect(readRoute('')).toBe('/');
  });
});

describe('buildShareUrl', () => {
  it('pone la ruta en el path y los datos en la query', () => {
    const url = buildShareUrl(
      { manual: { stats: { strength: 3_200_000, defense: 0, speed: 0, dexterity: 0 }, maxHappy: 4475, maxEnergy: 150, xanaxEcstasy: null, unlockedGymId: 20 } },
      'https://torntraining.com',
      '/cost',
    );
    expect(url.startsWith('https://torntraining.com/cost?')).toBe(true);
    expect(url).toContain('str=3200000');
  });

  it('no deja doble barra en la raiz', () => {
    const url = buildShareUrl({}, 'https://torntraining.com', '/');
    expect(url).toBe('https://torntraining.com/?');
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `npx vitest run src/url-state.test.ts`
Expected: FAIL — `readRoute is not exported`.

- [ ] **Step 3: Agregar el ruteo a `url-state.ts`**

Añadir arriba del archivo, después de los imports existentes:

```ts
/**
 * Cinco rutas planas, sin params y sin anidar. Un router traería loaders,
 * outlets y 12 KB para resolver esto; la History API ya lo resuelve.
 * La ruta va en el path y los datos del jugador siguen en la query, así que
 * un link compartido lleva la sección Y los números de quien lo comparte.
 */
export const ROUTES = ['/', '/build', '/compare', '/cost', '/progress'] as const;
export type Route = (typeof ROUTES)[number];

export function readRoute(pathname = window.location.pathname): Route {
  const clean = ('/' + pathname.replace(/^\/+|\/+$/g, '')) as Route;
  return ROUTES.includes(clean) ? clean : '/';
}
```

Cambiar la firma de `buildShareUrl` para que acepte la ruta:

```ts
export function buildShareUrl(
  state: SharedState,
  origin = window.location.origin,
  route: Route = '/',
): string {
```

y su `return` final, que hoy es `` return `${origin}/?${p.toString()}`; ``, por:

```ts
  return `${origin}${route === '/' ? '/' : route}?${p.toString()}`;
```

Cambiar `syncUrl` para que también lleve la ruta, y agregar `navigate`:

```ts
/** Mantiene la barra de direcciones al día sin ensuciar el historial. */
export function syncUrl(state: SharedState, route: Route = '/'): void {
  const url = buildShareUrl(state, window.location.origin, route);
  window.history.replaceState(null, '', url.slice(window.location.origin.length));
}

/** Cambio de sección: sí entra en el historial, para que "atrás" funcione. */
export function navigate(route: Route, state: SharedState): void {
  const url = buildShareUrl(state, window.location.origin, route);
  window.history.pushState(null, '', url.slice(window.location.origin.length));
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `npx vitest run src/url-state.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Verificar y commitear**

Run: `npm run typecheck && npx vitest run`
Expected: typecheck limpio (las llamadas existentes a `syncUrl` siguen compilando: el parámetro es opcional), 158 tests (148 + 5 de `stage` + 5 de `url-state`).

```bash
git add src/url-state.ts src/url-state.test.ts
git commit -m "feat: rutas sobre la History API en url-state"
```

---

### Task 7: Rewrite de Vercel y no indexación

Sin esto, entrar directo a `torntraining.com/build` da 404: el host no sabe que esa ruta la resuelve el cliente.

**Files:**
- Modify: `vercel.json`
- Modify: `index.html` (nada; ver step 2)

**Interfaces:**
- Consumes: la lista `ROUTES` de la tarea 6 (como valor literal en la config).
- Produces: las cuatro rutas profundas sirven `index.html` en producción.

- [ ] **Step 1: Agregar el rewrite**

En `vercel.json`, agregar la clave `rewrites` junto a `redirects` (el redirect de `www` que ya está no se toca):

```json
  "rewrites": [
    { "source": "/build", "destination": "/index.html" },
    { "source": "/compare", "destination": "/index.html" },
    { "source": "/cost", "destination": "/index.html" },
    { "source": "/progress", "destination": "/index.html" }
  ]
```

Se listan una por una a propósito. Un comodín se comería las 43 páginas estáticas.

- [ ] **Step 2: No indexar las rutas profundas**

Sin datos del jugador no significan nada. En `src/App.tsx` (tarea 8) se agrega el meta al cambiar de ruta; acá solo dejar registrado que `scripts/gen-seo.mjs` **no** debe sumarlas al sitemap: `STATIC_URLS` sigue con las mismas cuatro entradas que hoy.

- [ ] **Step 3: Verificar el JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf8')); console.log('ok')"`
Expected: `ok`

- [ ] **Step 4: Commit**

```bash
git add vercel.json
git commit -m "chore: rewrite de las rutas de la app a index.html en Vercel"
```

---

### Task 8: Shell — `Nav`, `AnswerBar` y el switch de `App`

**Files:**
- Create: `src/components/Nav.tsx`
- Create: `src/components/AnswerBar.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css` (estilos de `.nav`, `.answerbar`)

**Interfaces:**
- Consumes: `Route`, `ROUTES`, `readRoute`, `navigate`, `syncUrl` de la tarea 6; `Stage` y `playerStage` de la tarea 5; `bestUsableGymIdForStat` de `src/engine/gym-eligibility.ts`; `gainPerTrain` de `src/engine/vladar.ts`.
- Produces: `<Nav route stage onNavigate />` y `<AnswerBar gyms player modifiers gate energyPerDay />`. La tarea 10 monta las rutas dentro de este shell.

- [ ] **Step 1: Crear `Nav.tsx`**

```tsx
import { Route, ROUTES } from '../url-state';
import { Stage } from '../engine/stage';

const LABEL: Record<Route, string> = {
  '/': 'Plan',
  '/build': 'Build',
  '/compare': 'Comparar',
  '/cost': 'Costo',
  '/progress': 'Tiempo',
};

interface Props {
  route: Route;
  stage: Stage;
  onNavigate: (r: Route) => void;
}

export function Nav({ route, stage, onNavigate }: Props) {
  return (
    <nav className="nav" aria-label="Secciones">
      {ROUTES.map((r) => (
        <button
          key={r}
          type="button"
          className={`nav-tab${r === route ? ' on' : ''}${
            r === '/cost' && !stage.hasPrices ? ' dim' : ''
          }`}
          aria-current={r === route ? 'page' : undefined}
          onClick={() => onNavigate(r)}
        >
          {LABEL[r]}
          {r === '/build' && stage.offRatio && <span className="nav-dot" aria-hidden="true" />}
        </button>
      ))}
    </nav>
  );
}
```

`/cost` se atenúa, nunca se oculta: una sección que desaparece hace pensar que se rompió algo.

- [ ] **Step 2: Crear `AnswerBar.tsx`**

Repite el cálculo que ya hace `SummaryCard`: stat más alto, mejor gym usable para ese stat, ganancia por día.

```tsx
import { Gym, PlayerState, STAT_KEYS, STAT_LABEL, StatKey } from '../engine/types';
import { GymGate, bestUsableGymIdForStat } from '../engine/gym-eligibility';
import { gainPerTrain } from '../engine/vladar';
import { fmtInt } from '../format';

interface Props {
  gyms: Gym[];
  player: PlayerState;
  modifiers: Record<StatKey, number>;
  gate: GymGate;
  energyPerDay: number;
}

export function AnswerBar({ gyms, player, modifiers, gate, energyPerDay }: Props) {
  const primary = STAT_KEYS.reduce((a, b) =>
    player.stats[a] >= player.stats[b] ? a : b,
  );
  const gymId = bestUsableGymIdForStat(
    gyms,
    primary,
    player.stats,
    player.xanaxEcstasyTaken,
    gate,
  );
  const gym = gyms.find((g) => g.id === gymId);
  if (!gym || gym.dots[primary] <= 0) return null;

  const perTrain = gainPerTrain({
    modifiers: modifiers[primary],
    dots: gym.dots[primary],
    energyPerTrain: gym.energyPerTrain,
    happy: player.happy.maximum,
    statValue: player.stats[primary],
  });
  const perDay = (perTrain / gym.energyPerTrain) * energyPerDay;

  return (
    <div className="answerbar">
      <span className="answerbar-what">
        {STAT_LABEL[primary]} · {gym.name}
      </span>
      <span className="answerbar-figure">{fmtInt(perDay)}</span>
      <span className="k">por día</span>
    </div>
  );
}
```

- [ ] **Step 3: Cablear el shell en `App.tsx`**

Agregar el estado de ruta y el listener de `popstate`, junto a los `useState` que ya están:

```tsx
const [route, setRoute] = useState<Route>(() => readRoute());

useEffect(() => {
  const onPop = () => setRoute(readRoute());
  window.addEventListener('popstate', onPop);
  return () => window.removeEventListener('popstate', onPop);
}, []);

const stage = useMemo(
  () => (player ? playerStage(player, prices) : null),
  [player, prices],
);

const go = (r: Route) => {
  navigate(r, shared);
  setRoute(r);
  window.scrollTo(0, 0);
};
```

Cambiar la llamada existente a `syncUrl(shared)` por `syncUrl(shared, route)` y agregar `route` a su arreglo de dependencias.

Agregar el meta de no indexación, que sigue a la ruta:

```tsx
useEffect(() => {
  const id = 'route-robots';
  document.getElementById(id)?.remove();
  if (route === '/') return; // solo / se indexa
  const m = document.createElement('meta');
  m.id = id;
  m.name = 'robots';
  m.content = 'noindex, follow';
  document.head.appendChild(m);
}, [route]);
```

Reemplazar la guarda existente `{player && gyms && config && (…)}` por
`{player && gyms && config && stage && (…)}` — sin `stage` en la guarda, TypeScript
no lo estrecha desde el `useMemo` y `RouteProps` no compila. Dentro, reemplazar toda
la pila de `<Fold>` por el shell más un switch:

```tsx
<>
  {route !== '/' && (
    <AnswerBar
      gyms={gyms}
      player={player}
      modifiers={modifiers}
      gate={gate}
      energyPerDay={energyPerDay}
    />
  )}
  {stage && <Nav route={route} stage={stage} onNavigate={go} />}
  {route === '/' && <Plan {...routeProps} />}
  {route === '/build' && <Build {...routeProps} />}
  {route === '/compare' && <Compare {...routeProps} />}
  {route === '/cost' && <Cost {...routeProps} />}
  {route === '/progress' && <Progress {...routeProps} />}
</>
```

donde `routeProps` es el objeto que ya se arma con lo que los componentes piden hoy:

```tsx
const routeProps = {
  gyms, player, modifiers, gate, config, prices, energyPerDay, stage,
  unlockedGymId,
  onConfig: patchConfig,
  onUnlockedGym: setUnlockedGymId,
  onMod: setMod,
  onDetect: detectMods,
};
```

Las rutas se crean en la tarea 10; hasta entonces, dejar los cinco componentes como stubs de una línea (`export const Plan = () => null;`) para que compile, y borrarlos ahí.

- [ ] **Step 4: Estilos del shell**

Agregar al final de `src/styles.css`:

```css
.answerbar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: baseline;
  gap: var(--sp-3);
  flex-wrap: wrap;
  padding: var(--sp-2) var(--sp-3);
  background: var(--surface-2);
  border-bottom: 1px solid var(--line);
}
.answerbar-figure {
  font-family: var(--mono);
  font-weight: 700;
  font-size: var(--fs-title);
  color: var(--best);
  font-variant-numeric: tabular-nums;
}
.nav {
  display: flex;
  gap: var(--sp-1);
  padding: 0 var(--sp-2);
  border-bottom: 1px solid var(--line);
  overflow-x: auto;
}
.nav-tab {
  padding: var(--sp-2) var(--sp-3);
  font-size: var(--fs-base);
  color: var(--muted);
  background: none;
  border: 0;
  border-bottom: 2px solid transparent;
  white-space: nowrap;
  cursor: pointer;
}
.nav-tab.on { color: var(--text); border-bottom-color: var(--accent); }
.nav-tab.dim { opacity: 0.45; }
.nav-dot {
  display: inline-block;
  width: 5px; height: 5px;
  margin-left: var(--sp-1);
  border-radius: 50%;
  background: var(--accent);
}
/* En móvil los tabs van abajo, al alcance del pulgar. */
@media (max-width: 560px) {
  .nav {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    background: var(--surface);
    border-top: 1px solid var(--line);
    border-bottom: 0;
    z-index: 20;
  }
  main { padding-bottom: 56px; }
}
```

- [ ] **Step 5: Verificar la navegación a mano**

Run: `npm run dev`
Expected: los cinco tabs cambian la URL; el botón "atrás" del navegador vuelve a la sección anterior; recargar en `/build` mantiene la sección; la barra de respuesta aparece en las cuatro profundas y no en `/`.

Y el caso que pide el spec — el jugador de ejemplo carga en *cualquier* ruta: abrir
`http://localhost:5173/compare` en una pestaña limpia, sin query. Debe mostrar la
comparación con los datos de ejemplo y el aviso de "Sample player", no una pantalla
vacía. Funciona sin código extra porque `readSharedState()` solo mira la query y
nunca el path — confirmarlo, no asumirlo.

- [ ] **Step 6: Verificar y commitear**

Run: `npm run typecheck && npx vitest run && npm run build`
Expected: typecheck limpio, 158 tests, build exitoso.

```bash
git add src/components/Nav.tsx src/components/AnswerBar.tsx src/App.tsx src/styles.css
git commit -m "feat: shell con barra de respuesta fija y navegacion por tabs"
```

---

### Task 9: Fusionar `/build` y borrar la bisección duplicada

`BuildRatio` y `BuildRoadmap` respondían la misma pregunta por caminos distintos: `nearestGymTarget` hace 60 iteraciones de bisección sobre `evaluateGymEligibility`, mientras `resolveUnlockTarget` (en `planner.ts`) resuelve lo mismo en forma cerrada. Se queda el cerrado.

**Files:**
- Create: `src/routes/Build.tsx`
- Modify: `src/engine/build-ratio.ts` (borrar `nearestGymTarget` y `GymTarget`)
- Modify: `src/engine/build-ratio.test.ts` (borrar el bloque `describe('nearestGymTarget')`)
- Modify: `src/components/BuildRatio.tsx` (usa `nearestGymTarget`; pasa a `resolveUnlockTarget`)
- Delete: `src/components/BuildRoadmap.tsx` → su contenido pasa a `Build.tsx`

**Interfaces:**
- Consumes: `resolveUnlockTarget(gym, stats)` de `src/engine/planner.ts`, que devuelve `{ stat: StatKey; target: number } | null`; `buildRoadmap` de `src/engine/build-roadmap.ts`.
- Produces: `export function Build(props: RouteProps)`.

- [ ] **Step 1: Verificar que la bisección no tiene otro consumidor**

Run: `git grep -n "nearestGymTarget"`
Expected: solo `src/engine/build-ratio.ts`, `src/engine/build-ratio.test.ts`, `src/components/BuildRatio.tsx` y `extension/src/content.ts`.

Si aparece en `extension/src/content.ts`, cambiarlo también a `resolveUnlockTarget` en el mismo commit — `extension/` está fuera de `tsconfig.include`, así que `npm run typecheck` **no** lo revisa y el error solo aparecería al correr `npm run build:ext`.

- [ ] **Step 2: Borrar la bisección**

En `src/engine/build-ratio.ts`, borrar la interfaz `GymTarget` y toda la función `nearestGymTarget` (desde su comentario de bloque hasta su llave de cierre). Borrar el import de `evaluateGymEligibility` y `isJailGym` si quedan sin uso.

En `src/engine/build-ratio.test.ts`, borrar el `describe('nearestGymTarget', …)` completo y quitar `nearestGymTarget` del import.

- [ ] **Step 3: Correr los tests**

Run: `npx vitest run src/engine/build-ratio.test.ts`
Expected: PASS. El archivo pierde los tests de `nearestGymTarget` y conserva el resto.

Run: `npx vitest run`
Expected: PASS. Anotar el número que queda: es el baseline para las tareas 10, 11 y 12,
donde ya no debe moverse.

- [ ] **Step 4: Crear `Build.tsx` con las dos vistas fusionadas**

`src/routes/Build.tsx` renderiza, en este orden y sin plegar nada: el selector de preset y la tabla de ratio (el cuerpo actual de `BuildRatio.tsx`), y debajo la escalera de gimnasios (el cuerpo actual de `BuildRoadmap.tsx`). El objetivo de desbloqueo se obtiene de `resolveUnlockTarget(gym, player.stats)` en vez de `nearestGymTarget`.

Si `stage.hasBuild` es `false`, en lugar de la tabla mostrar:

```tsx
<p className="footnote">
  Tus cuatro stats están parejos, así que todavía no seguís ningún build. Un
  build es una decisión: sacrificás un stat para que otro quede 25% arriba y se
  te abra un gimnasio especialista. Elegí uno arriba para ver qué te costaría.
</p>
```

- [ ] **Step 5: Verificar y commitear**

Run: `npm run typecheck && npx vitest run && npm run build && npm run build:ext`
Expected: todo verde.

```bash
git add src/routes/Build.tsx src/engine/build-ratio.ts src/engine/build-ratio.test.ts src/components/BuildRatio.tsx
git rm src/components/BuildRoadmap.tsx
git commit -m "feat: fusionar /build y borrar la biseccion duplicada"
```

---

### Task 10: Las otras cuatro rutas

Composición pura: cada ruta importa los componentes que ya existen y los apila en orden narrativo. Sin `<Fold>`.

**Files:**
- Create: `src/routes/Plan.tsx`, `src/routes/Compare.tsx`, `src/routes/Cost.tsx`, `src/routes/Progress.tsx`
- Modify: `src/App.tsx` (borrar los stubs de la tarea 8)

**Interfaces:**
- Consumes: los componentes existentes con las props que ya piden (ver más abajo).
- Produces: cuatro componentes de ruta con la firma `(props: RouteProps) => JSX.Element`.

- [ ] **Step 1: Definir `RouteProps` una vez**

En `src/routes/types.ts`:

```ts
import { Gym, PlayerState, SessionConfig, StatKey } from '../engine/types';
import { GymGate } from '../engine/gym-eligibility';
import { Prices } from '../engine/cost-model';
import { Stage } from '../engine/stage';

/** Todo lo que cualquier ruta puede necesitar. Un solo objeto: los componentes
 *  ya pedían subconjuntos de esto y prop-drilling por separado no compra nada. */
export interface RouteProps {
  gyms: Gym[];
  player: PlayerState;
  modifiers: Record<StatKey, number>;
  gate: GymGate;
  config: SessionConfig;
  prices: Prices | null;
  energyPerDay: number;
  stage: Stage;
  unlockedGymId: number | null;
  onConfig: (patch: Partial<SessionConfig>) => void;
  onUnlockedGym: (id: number) => void;
  onMod: (stat: StatKey, value: number) => void;
  onDetect: () => void;
}
```

Las cuatro últimas son los callbacks que `App.tsx` ya tiene (`patchConfig`,
`setUnlockedGymId`, `setMod`, `detectMods`). Van en la bolsa para que el switch de
la tarea 8 pueda ser `<Plan {...routeProps} />` sin excepciones por ruta.

- [ ] **Step 2: Escribir las cuatro rutas**

`src/routes/Plan.tsx`:

```tsx
import { SummaryCard } from '../components/SummaryCard';
import { TrainingPlan } from '../components/TrainingPlan';
import { Modifiers } from '../components/Modifiers';
import { standardGyms } from '../engine/gym-eligibility';
import { RouteProps } from './types';

export function Plan(p: RouteProps) {
  return (
    <>
      <SummaryCard gyms={p.gyms} player={p.player} modifiers={p.modifiers} gate={p.gate} />
      <TrainingPlan
        gyms={p.gyms}
        player={p.player}
        modifiers={p.modifiers}
        prices={p.prices}
        gate={p.gate}
        stage={p.stage}
        standardGyms={standardGyms(p.gyms)}
        unlockedGymId={p.unlockedGymId}
        onUnlockedGym={p.onUnlockedGym}
      />
      <Modifiers
        modifiers={p.modifiers}
        detected={p.player.detectedModifiers}
        contributions={p.player.modifierContributions}
        onChange={p.onMod}
        onDetect={p.onDetect}
      />
    </>
  );
}
```

`TrainingPlan` gana la prop `stage` acá; la usa en la tarea 11 para imprimir la
justificación una sola vez.

`src/routes/Compare.tsx`:

```tsx
import { GymComparator } from '../components/GymComparator';
import { BuildCompare } from '../components/BuildCompare';
import { RouteProps } from './types';

export function Compare(p: RouteProps) {
  return (
    <>
      <GymComparator gyms={p.gyms} player={p.player} modifiers={p.modifiers} gate={p.gate} />
      <BuildCompare
        gyms={p.gyms}
        player={p.player}
        modifiers={p.modifiers}
        gate={p.gate}
        energyPerDay={p.energyPerDay}
      />
    </>
  );
}
```

`src/routes/Cost.tsx` — orden narrativo *qué energía tenés → qué cuesta → qué comprás*:

```tsx
import { Economics } from '../components/Economics';
import { Optimizer } from '../components/Optimizer';
import { SessionSimulator } from '../components/SessionSimulator';
import { RouteProps } from './types';

export function Cost(p: RouteProps) {
  return (
    <>
      {!p.stage.hasPrices && (
        <p className="footnote">
          Estas cifras necesitan precios de mercado en vivo. Cargá tu API key arriba —
          cualquier clave sirve, los precios son públicos.
        </p>
      )}
      <Economics
        gyms={p.gyms}
        player={p.player}
        modifiers={p.modifiers[p.config.stat]}
        config={p.config}
        prices={p.prices}
      />
      <Optimizer
        gyms={p.gyms}
        player={p.player}
        modifiers={p.modifiers[p.config.stat]}
        config={p.config}
        prices={p.prices}
      />
      <SessionSimulator
        gyms={p.gyms}
        player={p.player}
        modifiers={p.modifiers[p.config.stat]}
        config={p.config}
        onConfig={p.onConfig}
      />
    </>
  );
}
```

`src/routes/Progress.tsx` — la línea de tiempo, de pasado a futuro. Los tres
componentes pesados se cargan en diferido: mover acá los `lazy()` que hoy están en
`App.tsx`, junto con `ChartFallback`.

```tsx
import { lazy, Suspense } from 'react';
import { Planner } from '../components/Planner';
import { RouteProps } from './types';

const HistoryChart = lazy(() =>
  import('../components/HistoryChart').then((m) => ({ default: m.HistoryChart })),
);
const ProgressTracker = lazy(() =>
  import('../components/ProgressTracker').then((m) => ({ default: m.ProgressTracker })),
);
const Projector = lazy(() =>
  import('../components/Projector').then((m) => ({ default: m.Projector })),
);

const ChartFallback = () => <p className="footnote">Cargando gráfico…</p>;

export function Progress(p: RouteProps) {
  return (
    <Suspense fallback={<ChartFallback />}>
      <HistoryChart player={p.player} />
      <ProgressTracker
        player={p.player}
        gyms={p.gyms}
        modifiers={p.modifiers}
        gate={p.gate}
      />
      <Projector
        gyms={p.gyms}
        player={p.player}
        modifiers={p.modifiers}
        gate={p.gate}
        config={p.config}
        prices={p.prices}
      />
      <Planner
        gyms={p.gyms}
        player={p.player}
        modifiers={p.modifiers}
        prices={p.prices}
        gate={p.gate}
      />
    </Suspense>
  );
}
```

Recharts sigue fuera del bundle inicial: solo se descarga cuando alguien entra a
`/progress`. El motivo original del `lazy()` — que recharts mide su contenedor al
montar y dentro de un `<details>` cerrado medía cero — desaparece con `Fold`, pero
el beneficio de peso se conserva.

- [ ] **Step 3: Borrar los stubs**

Quitar de `App.tsx` los cinco `export const X = () => null;` de la tarea 8 y reemplazar por imports desde `src/routes/`.

- [ ] **Step 4: Verificar que no quedó ningún `Fold`**

Run: `git grep -n "Fold"`
Expected: solo `src/components/Fold.tsx`, que se borra en la tarea 11.

- [ ] **Step 5: Recorrer las cinco rutas a mano**

Run: `npm run dev`
Expected: cada ruta muestra su contenido sin acordeones. Los gráficos de `/progress` se dibujan (no salen en blanco: ya no están dentro de un `<details>` cerrado, que era lo que rompía la medición de recharts). `/cost` sin API key muestra el aviso y no una sección vacía.

- [ ] **Step 6: Verificar y commitear**

Run: `npm run typecheck && npx vitest run && npm run build`
Expected: typecheck limpio, el mismo número de tests que dejó la tarea 9, build exitoso.

```bash
git add src/routes src/App.tsx
git commit -m "feat: las cuatro rutas restantes como composicion de los paneles existentes"
```

---

### Task 11: Podar — borrar lo que ya no es destino

**Files:**
- Create: `src/components/YourData.tsx`
- Delete: `src/components/Fold.tsx`, `src/components/PlayerSummary.tsx`, `src/components/AboutSection.tsx`, `src/components/ApiKeyBar.tsx`, `src/components/ManualEntry.tsx`
- Modify: `src/App.tsx`, `src/url-state.ts` (el import de `ManualData`), `src/demo.ts` (idem), `src/styles.css`
- Modify: `src/components/TrainingPlan.tsx` (deduplicación)

**Interfaces:**
- Consumes: `Stage` de la tarea 5.
- Produces: `export interface ManualData` se muda a `src/engine/types.ts`; `<YourData apiKey onApiKey loading onLoad error onManual />`.

- [ ] **Step 1: Mudar `ManualData` a `engine/types.ts`**

Hoy vive en `src/components/ManualEntry.tsx` y lo importan `src/demo.ts` y `src/url-state.ts` — dos módulos sin React que dependen de un componente. Mover la interfaz tal cual a `src/engine/types.ts` y actualizar los tres imports.

- [ ] **Step 2: Fusionar `ApiKeyBar` + `ManualEntry` en `YourData.tsx`**

Un solo bloque con dos formas de lo mismo: el campo de API key arriba y, detrás de un `<details>` con `<summary>Prefiero escribir mis stats a mano</summary>`, el formulario actual de `ManualEntry`. Este `<details>` sí se justifica: es un camino alternativo, no una sección de contenido escondida.

`YourData` vive en el shell, arriba del `AnswerBar`, y es alcanzable desde cualquier ruta.

- [ ] **Step 3: Borrar los tres componentes muertos**

`Fold.tsx` ya no se usa (tarea 10). `PlayerSummary.tsx` era un panel de debug — el dato ya está en el plan. `AboutSection.tsx` sale de la app: su contenido ya vive en el shell prerenderizado de `index.html` para crawlers y en `/guide` para humanos.

- [ ] **Step 4: Deduplicar el plan de entrenamiento**

En `src/components/TrainingPlan.tsx`:

- La justificación del método (`trainingRegime(...).rationale`) hoy se imprime una vez por stat. Imprimirla **una sola vez**, arriba de las cuatro filas, usando `stage.regime`. Si algún stat cae en otro régimen, esa fila lleva su propia nota corta; en la práctica los cuatro comparten régimen casi siempre.
- La línea `99k jump ceiling` se muestra solo si `stage.showJumpCeiling`.
- La línea `Next upgrade:` se omite cuando el gimnasio que sigue tiene `status === 'invite'`. "Next upgrade: Fight Club — Invite only" repetido cuatro veces no es un consejo: nadie puede entrar.

- [ ] **Step 5: Limpiar el CSS huérfano**

Run: `git grep -c "fold-\|about-\|player-summary"`

Borrar de `src/styles.css` las reglas de las clases que ya no existen en ningún `.tsx`.

- [ ] **Step 6: Verificar y commitear**

Run: `npm run typecheck && npx vitest run && npm run build`
Expected: typecheck limpio (`noUnusedLocals` está activo y delata cualquier import huérfano), el mismo número de tests que dejó la tarea 9, build exitoso.

Run: `npm run dev` y mirar `/`
Expected: el párrafo de método aparece **una vez**, no cuatro. No hay ninguna mención a Fight Club como próximo upgrade.

```bash
git add src/components/YourData.tsx src/components/TrainingPlan.tsx src/engine/types.ts src/App.tsx src/url-state.ts src/demo.ts src/styles.css
git rm src/components/Fold.tsx src/components/PlayerSummary.tsx src/components/AboutSection.tsx src/components/ApiKeyBar.tsx src/components/ManualEntry.tsx
git commit -m "refactor: podar paneles muertos y deduplicar el plan por stat"
```

**Fin de la fase 2.**

---

# FASE 3 — Deep links

Depende de que las rutas existan en producción: hasta entonces, estos links darían 404.

---

### Task 12: Apuntar los CTAs de las páginas estáticas al destino que responde su intención

**Files:**
- Modify: `scripts/gen-seo.mjs` (8 CTAs)
- Modify: `public/specialist-gyms/index.html` (1 CTA, escrita a mano)

**Interfaces:**
- Consumes: las rutas de la tarea 6, ya desplegadas.
- Produces: nada que otro código consuma.

- [ ] **Step 1: Cambiar los ocho CTAs generados**

En `scripts/gen-seo.mjs`, según esta tabla:

| Página | CTA hoy | CTA nueva |
|---|---|---|
| `/gyms/<slug>` (33) | `href="${deepLink}"` | el mismo `deepLink`, con `/compare` como base en vez de `/` |
| `/gyms` (índice) | `href="/"` | `href="/compare"` |
| `/gym-dots` | `href="/"` | `href="/compare"` |
| `/best-gym-for-<stat>` (4) | `href="/?stat=${s.key}"` | `href="/compare?stat=${s.key}"` |
| `/stat-cap` | `href="/"` | `href="/"` (sin cambio) |
| `/gym-unlock-order` | `href="/"` | `href="/build"` |
| `/training-ratios` | `href="/"` | `href="/build"` |
| `/xanax-vs-lsd` | `href="/"` | `href="/cost"` |

`/stat-cap` se queda en `/`: la pregunta que trae el visitante es "¿cuánto gano yo pasado el cap?", y eso lo responde el plan, no una comparación de gimnasios.

Para las 33 páginas de gimnasio, cambiar la construcción de `deepLink` para que empiece con `/compare?` en vez de `/?`.

- [ ] **Step 2: Cambiar el CTA de la página a mano**

En `public/specialist-gyms/index.html`, el CTA final pasa de `href="/"` a `href="/build"`.

- [ ] **Step 3: Regenerar y verificar**

Run:

```bash
npm run seo
grep -c 'class="cta" href="/compare' public/gyms/*/index.html | grep -c ':1'
grep -o 'class="cta" href="[^"]*"' public/gym-unlock-order/index.html public/training-ratios/index.html public/xanax-vs-lsd/index.html
```

Expected: 33 páginas de gimnasio con CTA a `/compare`; unlock-order y training-ratios a `/build`; xanax-vs-lsd a `/cost`.

- [ ] **Step 4: Verificar que el sitemap no cambió de tamaño**

Run: `grep -c "<loc>" public/sitemap.xml`
Expected: `47`. Las rutas de la app no entran al sitemap.

- [ ] **Step 5: Commit**

```bash
git add scripts/gen-seo.mjs public/specialist-gyms/index.html scripts/lastmod.json
git commit -m "feat: los CTAs de las paginas estaticas apuntan a la ruta que responde su intencion"
```

`lastmod.json` va en el commit: el ledger re-fecha las páginas cuyo HTML cambió, que es su trabajo.

---

## Verificación final

- [ ] `npm run typecheck` limpio
- [ ] `npx vitest run` — 148 de base, +5 de `stage`, +5 de `url-state`, menos los de `nearestGymTarget` que se borran junto con la función en la tarea 9. El número exacto queda fijado ahí y no se mueve después.
- [ ] `npm run build` exitoso
- [ ] `npm run build:ext` exitoso
- [ ] `grep -c "text-transform: *uppercase" src/styles.css` → `1`
- [ ] `grep -n "font-size: *[0-9]" src/styles.css` → sin resultados
- [ ] `git grep -n "Oswald"` → sin resultados
- [ ] `git grep -n "Fold"` → sin resultados
- [ ] Las cinco rutas cargan en `npm run dev`, el botón "atrás" funciona, y recargar en `/cost` mantiene la sección
- [ ] En producción, `torntraining.com/build` no da 404
