# Rediseño del frontend: shell, navegación y voz tipográfica

Fecha: 2026-09-06
Estado: aprobado, listo para plan de implementación
Repo: `torn-training-optimizer` · producción: torntraining.com (Vercel)

## Problema

La app es una sola URL con 14 superficies apiladas. Después del plan vienen doce
`<details>` en fila, todos con la misma forma — etiqueta más frase ingeniosa —
sin jerarquía ni agrupación. Eso, más la repetición literal del mismo párrafo de
método una vez por stat, es lo que se lee como interfaz generada.

El diagnóstico visual apunta a la tipografía, no al color: la paleta latón/teal
sobre azul oscuro es propia y está razonada (hay comentarios de contraste en
`styles.css`). Lo que falla son 18 tamaños de fuente en 95 declaraciones
—`font-size` adivinado por componente— y 27 reglas de `text-transform:
uppercase`, que dejan a la página sin jerarquía porque todo grita.

Objetivo: claridad y navegación por encima de cantidad de información por página.

## Decisiones tomadas

| # | Decisión | Elegido |
|---|---|---|
| 1 | Para quién es `/` | Ambos, en rutas separadas |
| 2 | Alcance | Podar y fusionar: 14 superficies → 5 destinos |
| 3 | Cambio visual | Cambiar la voz tipográfica, conservar la paleta |
| 4 | Dinamismo | La página se adapta a la etapa del jugador (no animaciones) |
| 5 | Ruteo | Vistas sobre la History API, sin router |
| 6 | Shell | Respuesta fija + tabs, con la barra apagada en `/` |
| 7 | Tipografía | IBM Plex Sans reemplaza a Oswald y a Inter |
| 8 | Deep links SEO | Entran en este spec |

## Arquitectura de información

Cinco destinos. Ninguno choca con las 43 rutas estáticas existentes.

| Ruta | Trabajo | Absorbe |
|---|---|---|
| `/` **Plan** | Qué hacer hoy | `SummaryCard` + `TrainingPlan` |
| `/build` **Build** | Hacia dónde vas | `BuildRatio` + `BuildRoadmap` |
| `/compare` **Comparar** | Qué gym, qué setup | `GymComparator` + `BuildCompare` |
| `/cost` **Costo** | Qué cuesta y qué comprar | `Economics` + `Optimizer` + `SessionSimulator` |
| `/progress` **Tiempo** | Tu curva y a dónde llega | `HistoryChart` + `ProgressTracker` + `Projector` + `Planner` |

Cada ruta es una narrativa hacia abajo, no una pila de paneles:

- `/cost` — qué energía tenés → qué cuesta → qué comprás con X presupuesto.
- `/progress` — tu curva → real vs predicho → a dónde llega → cuándo llegás.

**Regla dura:** dentro de una ruta las secciones se maquetan, no se pliegan. Si
una ruta necesita acordeones, está mal cortada y reintrodujimos el problema de
origen. `Fold.tsx` deja de usarse y se borra.

### Lo que no es destino

- **`PlayerSummary`** — panel de debug ("what was read from the API"). Se borra;
  el dato ya está en el plan.
- **`Modifiers` (M)** — no es una sección, es un control: cambia *todos* los
  cálculos. Va como ajuste dentro de `/`.
- **`ApiKeyBar` + `ManualEntry`** — dos formas de lo mismo. Se fusionan en un
  único "tus datos" que vive en el shell y es alcanzable desde cualquier ruta.
- **`AboutSection`** — sale de la app. Ya vive en el shell prerenderizado de
  `index.html` para crawlers y en `/guide` para humanos.

### Fusiones que además borran código

`BuildRatio` y `BuildRoadmap` calculaban lo mismo por caminos distintos: una
bisección de 60 iteraciones en `nearestGymTarget` contra el solver cerrado de
`resolveUnlockTarget`. La fusión borra la bisección y deja el solver exacto como
única fuente. Es la duplicación que quedó marcada en la auditoría previa.

## Shell

Opción C: masthead → barra de respuesta fija → tabs → contenido.

La barra fija lleva stat, gym y ganancia por día, y está presente en las cuatro
rutas profundas. **En `/` va apagada**: ahí la respuesta ya está en el cuerpo y
repetirla sería ruido.

- Escritorio: tabs horizontales bajo la barra.
- Móvil: barra de respuesta arriba, tabs abajo (alcance del pulgar).
- Los ítems del nav cargan estado: punto en **Build** si el jugador se salió del
  ratio, **Costo** atenuado si no hay precios cargados. Atenuado, nunca oculto.

## Sistema tipográfico

**Familias.** IBM Plex Sans (400/500/600/700) reemplaza a Oswald *y* a Inter.
JetBrains Mono se queda para cifras: las columnas se comparan y `tabular-nums`
es lo correcto ahí. Neto: tres familias → dos.

**Escala.** Seis tokens reemplazan los 18 tamaños actuales.

| Token | px | Uso |
|---|---|---|
| `--fs-figure` | 30 | Cifra principal (mono) |
| `--fs-title` | 20 | Título de ruta y de bloque |
| `--fs-lead` | 16 | Frase de apertura |
| `--fs-base` | 14 | Texto y celdas |
| `--fs-sm` | 12 | Notas y secundario |
| `--fs-label` | 11 | Etiquetas (caps + tracking) |

**Mayúsculas.** De 27 reglas a 1: el uppercase sobrevive solo en `--fs-label` —
kickers y encabezados de columna, donde las mayúsculas con tracking dicen "esto
es una etiqueta, no una frase", que es información real. Se van de títulos,
nombres de gimnasios, nombres de stats, botones, celdas y nav.

**Espaciado.** `styles.css` hoy no tiene tokens de espaciado. Se agrega una
escala de cuatro (`4 / 8 / 16 / 24`) y los `gap` de flex y grid la usan.

La paleta no se toca. Los seis tokens de color de `:root` quedan como están,
incluidos los valores de contraste corregidos tras el fallo de Lighthouse.

## Capa adaptativa

Un solo lugar: `src/engine/stage.ts`. Deriva los flags una vez y se pasa hacia
abajo. Nada de `if (regime === …)` desparramado por cinco componentes.

```ts
interface Stage {
  regime: Regime;           // de trainingRegime(), ya existe
  hasBuild: boolean;        // el ratio cae dentro de la tolerancia de algún preset
  offRatio: boolean;        // badge en el nav de /build
  hasPrices: boolean;       // /cost habilitado
  showJumpCeiling: boolean; // la línea del salto a 99k
}
```

Cinco campos, todos consumidos por algo hoy. Ninguno especulativo.

Reglas que habilita:

- `/` muestra solo el régimen que aplica. Con 100k se ve happy-jump; con 15M la
  línea del salto a 99k no aparece, porque para ese jugador es peor.
- La justificación del método aparece **una vez, al nivel donde varía** — por
  régimen, no por stat. Hoy el mismo párrafo se repite cuatro veces.
- `"Next upgrade: Fight Club — Invite only"` × 4 desaparece. Si el único upgrade
  es inalcanzable, no se dice nada.
- `/build` se declara solo si el jugador tiene un build. Un jugador balanceado no
  necesita un tracker de ratio: necesita que le digan que un build es una
  decisión que todavía no tomó.

## Ruteo y SEO

**Mecánica.** `src/url-state.ts` gana un segmento de ruta. Hoy lee la query y
sincroniza con `replaceState`; navegar suma `pushState` más un listener de
`popstate` para que "atrás" funcione. Un `<nav>`, un switch en `App.tsx`.
Sin dependencias nuevas.

La ruta va en el path, los datos del jugador siguen en la query. Un link
compartido queda `/cost?str=3200000&def=…`: se puede mandar la página de costos
*con los números de quien la comparte*, no solo la home.

**Host.** `vercel.json` suma un rewrite de las cuatro rutas nuevas a
`/index.html`. Las 43 páginas estáticas ganan por especificidad y no se tocan.

**Indexación.** `/` conserva el shell prerenderizado. Las cuatro rutas profundas
no entran al sitemap y llevan `noindex`: sin datos del jugador no significan
nada.

**Deep links.** Las páginas estáticas dejan de apuntar todas a `/` y apuntan al
destino que responde su intención de búsqueda.

| Página estática | CTA hoy | CTA nueva |
|---|---|---|
| `/gyms/<slug>` (33 páginas) | `/?stat=…&gym=…` | `/compare?stat=…&gym=…` |
| `/best-gym-for-<stat>` (4) | `/?stat=…` | `/compare?stat=…` |
| `/gyms` (índice) | `/` | `/compare` |
| `/gym-dots` | `/` | `/compare` |
| `/gym-unlock-order` | `/` | `/build` |
| `/training-ratios` | `/` | `/build` |
| `/xanax-vs-lsd` | `/` | `/cost` |
| `/stat-cap` | `/` | `/` |
| `/specialist-gyms` (a mano) | `/` | `/build` |
| `/guide`, `/happy-jump` (a mano) | `/` | `/` |

`/stat-cap` se queda en `/`: la pregunta que trae el visitante es "¿cuánto gano
yo pasado el cap?", y eso lo responde el plan.

Cambia `scripts/gen-seo.mjs` en ocho CTAs. El ledger de `lastmod.json` va a
re-fechar las páginas cuyo HTML cambie, que es exactamente su trabajo.

## Orden sugerido

Tres fases que se pueden mergear por separado, cada una dejando el sitio en pie:

1. **Sistema tipográfico** — tokens, escala, familias, poda de mayúsculas. No
   toca estructura; se puede desplegar solo y ya se nota.
2. **Shell y rutas** — nav, barra fija, `pushState`, rewrite, fusiones de
   componentes, `stage.ts`.
3. **Deep links** — los ocho CTAs de `gen-seo.mjs`. Depende de que las rutas
   existan en producción.

## Estados

| Estado | Comportamiento |
|---|---|
| Sin datos | El jugador de ejemplo carga en *cualquier* ruta — se puede entrar directo a `/compare` desde un link |
| Sin API key | `/cost` existe y explica qué le falta; nunca aparece vacía. Nav atenuado |
| Error de API | Vive en el shell, no por ruta |
| En la cárcel | Sin cambios: `inJail` ya viaja en la query y en el gate |

## Tests

Los 148 del motor siguen sirviendo: la matemática no se toca. Se suman dos:

- `src/engine/stage.test.ts` — la única lógica nueva del rediseño.
- Casos de ruta en `src/url-state.test.ts`, que hoy no existe.

Nada de tests de componente para mudanzas.

## Fuera de alcance

- `react-router` — cinco rutas planas sin params no lo justifican.
- Animaciones y transiciones — no se pidieron.
- Tailwind o cualquier framework de CSS. Los 26 KB a mano en su mayoría sirven:
  se cambian tokens y familias, no se reescribe.
- Sistema de componentes genérico. Un `<Panel>` aparece cuando se repita tres
  veces, no antes.
- Storybook, regresión visual.

## Archivos tocados

**Nuevos:** `src/engine/stage.ts`, `src/engine/stage.test.ts`,
`src/url-state.test.ts`, un componente de nav y uno de barra de respuesta.

**Modificados:** `App.tsx`, `url-state.ts`, `styles.css`, `index.html` (familias
de fuente), `vercel.json`, `scripts/gen-seo.mjs`, y los componentes que se
fusionan.

**Borrados:** `src/components/Fold.tsx`, `src/components/PlayerSummary.tsx`,
`src/components/AboutSection.tsx`, y los componentes que se absorben en las
fusiones.
