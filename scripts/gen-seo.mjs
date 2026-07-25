// Programmatic SEO.
//
// The calculator is one URL, and one URL can only rank for so much. The gym
// data is already structured, verified game data, so this script turns it into
// the long tail: a page per gym, a dots chart, a "best gym for <stat>" page per
// battle stat, and the evergreen mechanics explainers — each one linking back
// into the calculator with the relevant stat and gym pre-selected via the query
// string (see src/url-state.ts), so search traffic lands on a filled-in tool.
//
// Single source of truth: gyms are parsed out of src/data/gyms.ts, never
// retyped here. Change a dot value there and every page follows.
//
// Run: node scripts/gen-seo.mjs   (wired into `npm run build`)

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'public');
const SITE = 'https://torntraining.com';
const TODAY = new Date().toISOString().slice(0, 10);

// ---- Data ------------------------------------------------------------------

/** Parse the `g(id, 'name', energy, cost, str, spd, def, dex)` rows. */
function readGyms() {
  const src = readFileSync(resolve(ROOT, 'src/data/gyms.ts'), 'utf8');
  const re = /g\(\s*(\d+),\s*(?:'([^']*)'|"([^"]*)"),\s*([\d.]+),\s*(\d+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)\s*\)/g;
  const gyms = [];
  let m;
  while ((m = re.exec(src)) !== null) {
    const name = (m[2] ?? m[3]).replace(/\\'/g, "'");
    gyms.push({
      id: Number(m[1]),
      name,
      slug: name
        .toLowerCase()
        .replace(/[’']/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
      energy: Number(m[4]),
      cost: Number(m[5]),
      dots: { strength: Number(m[6]), speed: Number(m[7]), defense: Number(m[8]), dexterity: Number(m[9]) },
    });
  }
  if (gyms.length < 30) throw new Error(`Only parsed ${gyms.length} gyms — check the regex against src/data/gyms.ts`);
  return gyms;
}

const STATS = [
  { key: 'strength', label: 'Strength' },
  { key: 'defense', label: 'Defense' },
  { key: 'speed', label: 'Speed' },
  { key: 'dexterity', label: 'Dexterity' },
];

const money = (n) => (n >= 2_000_000_000 ? 'Invite only' : '$' + n.toLocaleString('en-US'));
const dot = (v) => (v > 0 ? v.toFixed(1) : '—');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---- Template --------------------------------------------------------------

const STYLE = readFileSync(resolve(OUT, 'guide/index.html'), 'utf8').match(/<style>[\s\S]*?<\/style>/)[0];

/**
 * One template for every generated page, so head tags, breadcrumbs, structured
 * data and internal links can never drift apart across 40 files.
 */
function page({ path, title, description, h1, sub, body, crumbs, schema = [], related = [] }) {
  const url = `${SITE}${path}`;
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: `${SITE}${c.path}`,
    })),
  };
  const blocks = [breadcrumb, ...schema]
    .map((s) => `    <script type="application/ld+json">\n${JSON.stringify(s, null, 2)}\n    </script>`)
    .join('\n');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${url}" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <meta name="theme-color" content="#14161b" />

    <meta property="og:type" content="article" />
    <meta property="og:site_name" content="Torn Training Optimizer" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${SITE}/og-image.png" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:image" content="${SITE}/og-image.png" />

    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />

    <script async src="https://www.googletagmanager.com/gtag/js?id=G-VXBFXDRGL2"></script>
    <script>
      window.dataLayer = window.dataLayer || [];
      function gtag(){ dataLayer.push(arguments); }
      gtag('js', new Date());
      gtag('config', 'G-VXBFXDRGL2');
    </script>

${blocks}

    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet" />
${STYLE}
  </head>
  <body>
    <main class="wrap">
      <div class="crumb">${crumbs
        .map((c, i) => (i === crumbs.length - 1 ? esc(c.name) : `<a href="${c.path}">${esc(c.name)}</a>`))
        .join(' › ')}</div>

      <h1>${esc(h1)}</h1>
      <p class="sub">${sub}</p>

${body}

      <footer>
        ${
          related.length
            ? `<p>${related.map((r) => `<a href="${r.path}">${esc(r.name)}</a>`).join(' · ')}</p>`
            : ''
        }
        <p>
          Unofficial fan-made tool · not affiliated with Torn.com. Your API key stays in your browser
          and is sent only to api.torn.com.
        </p>
      </footer>
    </main>
  </body>
</html>
`;
}

function write(path, html) {
  const file = resolve(OUT, path.replace(/^\//, '').replace(/\/$/, '') + '/index.html');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, html);
}

// ---- Pages -----------------------------------------------------------------

const gyms = readGyms();
const standard = gyms.filter((g) => g.id <= 24);
const specialist = gyms.filter((g) => g.id > 24);
const urls = [];

const HUBS = [
  { name: 'Gym dots chart', path: '/gym-dots/' },
  { name: 'All gyms', path: '/gyms/' },
  { name: 'Unlock order', path: '/gym-unlock-order/' },
  { name: 'The 50M stat cap', path: '/stat-cap/' },
  { name: 'Training ratios', path: '/training-ratios/' },
  { name: 'Xanax vs LSD', path: '/xanax-vs-lsd/' },
  { name: 'Training guide', path: '/guide/' },
  { name: 'Happy jump', path: '/happy-jump/' },
  { name: 'Specialist gyms', path: '/specialist-gyms/' },
];

const related = (exclude) => HUBS.filter((h) => h.path !== exclude).slice(0, 6);
const emit = (path, html, priority) => {
  write(path, html);
  urls.push({ path, priority });
};

const gymTable = (list, highlight) => `      <table>
        <thead>
          <tr><th>Gym</th><th>Energy</th>${STATS.map((s) => `<th>${s.label}</th>`).join('')}<th>Cost</th></tr>
        </thead>
        <tbody>
${list
  .map(
    (g) => `          <tr>
            <td><a href="/gyms/${g.slug}/">${esc(g.name)}</a></td>
            <td class="num">${g.energy}E</td>
${STATS.map(
  (s) =>
    `            <td class="num"${
      highlight && g.dots[s.key] === Math.max(...list.map((x) => x.dots[highlight])) && s.key === highlight
        ? ' style="color:var(--best)"'
        : ''
    }>${dot(g.dots[s.key])}</td>`,
).join('\n')}
            <td class="num">${money(g.cost)}</td>
          </tr>`,
  )
  .join('\n')}
        </tbody>
      </table>`;

// --- /gyms/<slug>/ : one page per gym
for (const g of gyms) {
  const best = STATS.filter((s) => g.dots[s.key] > 0).sort((a, b) => g.dots[b.key] - g.dots[a.key]);
  const top = best[0];
  const isSpecialist = g.id > 24;
  const deepLink = top ? `/?stat=${top.key}&gym=${g.id}` : '/';

  emit(
    `/gyms/${g.slug}/`,
    page({
      path: `/gyms/${g.slug}/`,
      title: `${g.name} (Torn Gym): Dots, Energy Cost & Gains`,
      description: `${g.name} in Torn costs ${g.energy} energy per train and ${money(g.cost)} to join. Full dot values per battle stat, how it compares to every other gym, and what you actually gain per train.`,
      h1: `${g.name}`,
      sub: `${g.energy} energy per train · ${money(g.cost)} to join · ${
        top ? `best for ${top.label} at ${dot(g.dots[top.key])} dots` : 'no trainable stats'
      }.`,
      crumbs: [
        { name: 'Torn Training Optimizer', path: '/' },
        { name: 'Gyms', path: '/gyms/' },
        { name: g.name, path: `/gyms/${g.slug}/` },
      ],
      schema: [
        {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: [
            {
              '@type': 'Question',
              name: `How many dots does ${g.name} have in Torn?`,
              acceptedAnswer: {
                '@type': 'Answer',
                text: `${g.name} has ${STATS.map((s) => `${dot(g.dots[s.key])} ${s.label}`).join(', ')}. Each train costs ${g.energy} energy.`,
              },
            },
            {
              '@type': 'Question',
              name: `How much does ${g.name} cost in Torn?`,
              acceptedAnswer: {
                '@type': 'Answer',
                text: `Joining ${g.name} costs ${money(g.cost)}. ${
                  isSpecialist
                    ? 'It is a specialist gym, so it also has stat-ratio requirements you must keep meeting to stay a member.'
                    : 'Standard gyms also require enough gym EXP, which is the total energy you have spent training over your whole career.'
                }`,
              },
            },
          ],
        },
      ],
      body: `      <h2>Dots and energy</h2>
${gymTable([g])}

      <div class="callout">
        Dots are a multiplier, not a rate. ${g.name} at ${dot(g.dots[top?.key ?? 'strength'])} dots gives
        ${top ? (g.dots[top.key] / 2).toFixed(2) : '—'}× the gain of a 2.0-dot gym for the same energy, all
        else equal. Energy per train does not change gains per energy — a 50E train is worth roughly
        five 10E trains at the same dots.
      </div>

      <h2>${isSpecialist ? 'Requirements' : 'How you unlock it'}</h2>
      <p>
        ${
          isSpecialist
            ? `${g.name} is a specialist gym. It requires the relevant standard gym unlocked plus a stat ratio that you must keep meeting — lose the ratio and you lose access until you regain it. Exact requirements are on the <a href="/specialist-gyms/">specialist gyms page</a>.`
            : `Standard gyms unlock on gym EXP — the cumulative energy you have spent training, not your level or your stats. You also pay ${money(g.cost)} to join. See the <a href="/gym-unlock-order/">full unlock order</a>.`
        }
      </p>

      <h2>What you actually gain here</h2>
      <p>
        Gains depend on four things beyond the gym: your happy at the moment you train, the current
        value of the stat, your energy per train, and your gym-gain perks. The calculator runs the
        real formula on your own numbers rather than a generic table.
      </p>

      <a class="cta" href="${deepLink}">
        <b>Calculate your gains in ${esc(g.name)} →</b><br />
        Opens the calculator with this gym${top ? ` and ${top.label}` : ''} already selected. No account, no API key required.
      </a>

      <h2>Compared to every other gym</h2>
      <p>See the <a href="/gym-dots/">full dots chart</a>${
        top ? ` or the <a href="/best-gym-for-${top.key}/">best gyms for ${top.label}</a>` : ''
      }.</p>`,
      related: related(`/gyms/${g.slug}/`),
    }),
    0.6,
  );
}

// --- /gyms/ : index
emit(
  '/gyms/',
  page({
    path: '/gyms/',
    title: 'All Torn Gyms: Dots, Energy and Unlock Costs',
    description:
      'Every gym in Torn — 24 standard gyms and the specialists — with dot values for all four battle stats, energy per train and cost to join. One page per gym with full detail.',
    h1: 'All Torn gyms',
    sub: `${gyms.length} gyms: ${standard.length} standard ones you progress through with gym EXP, and ${specialist.length} specialists gated on stat ratios.`,
    crumbs: [
      { name: 'Torn Training Optimizer', path: '/' },
      { name: 'Gyms', path: '/gyms/' },
    ],
    body: `      <h2>Standard gyms</h2>
${gymTable(standard)}
      <h2>Specialist gyms</h2>
${gymTable(specialist)}
      <a class="cta" href="/"><b>Find the best gym for your stats →</b><br />The calculator only recommends gyms you can actually use.</a>`,
    related: related('/gyms/'),
  }),
  0.8,
);

// --- /gym-dots/ : the chart people search for
emit(
  '/gym-dots/',
  page({
    path: '/gym-dots/',
    title: 'Torn Gym Dots Chart — All Gyms, All Stats',
    description:
      'The complete Torn gym dots chart: strength, speed, defense and dexterity values for all 32 gyms, plus energy per train and cost. Verified against the Torn wiki.',
    h1: 'Torn gym dots chart',
    sub: 'Every gym, every stat, in one table. Dots are the gym multiplier in the gain formula — double the dots, double the gain for the same energy.',
    crumbs: [
      { name: 'Torn Training Optimizer', path: '/' },
      { name: 'Gym dots chart', path: '/gym-dots/' },
    ],
    schema: [
      {
        '@context': 'https://schema.org',
        '@type': 'Dataset',
        name: 'Torn gym dots, energy cost and join cost',
        description: 'Dot values per battle stat, energy per train and membership cost for every gym in Torn.',
        url: `${SITE}/gym-dots/`,
        creator: { '@type': 'Organization', name: 'Torn Training Optimizer' },
        isAccessibleForFree: true,
      },
    ],
    body: `      <h2>Standard gyms</h2>
${gymTable(standard)}
      <h2>Specialist gyms</h2>
${gymTable(specialist)}

      <div class="callout">
        In the Torn API these values are stored ten times larger — George's reads
        <code>73</code>, not <code>7.3</code>. Divide by ten before putting them in the gain formula.
      </div>

      <a class="cta" href="/"><b>Apply these to your own stats →</b></a>`,
    related: related('/gym-dots/'),
  }),
  0.9,
);

// --- /best-gym-for-<stat>/ : four pages
for (const s of STATS) {
  const ranked = [...gyms].filter((g) => g.dots[s.key] > 0).sort((a, b) => b.dots[s.key] - a.dots[s.key]);
  // Fight Club is invite-only, so it is a footnote rather than an answer.
  const top = ranked.find((g) => g.cost < 2_000_000_000) ?? ranked[0];
  const bestStandard = standard.filter((g) => g.dots[s.key] > 0).sort((a, b) => b.dots[s.key] - a.dots[s.key])[0];

  emit(
    `/best-gym-for-${s.key}/`,
    page({
      path: `/best-gym-for-${s.key}/`,
      title: `Best Gym for ${s.label} in Torn (Ranked by Dots)`,
      description: `Every Torn gym that trains ${s.label}, ranked by dots. ${top.name} leads the obtainable gyms at ${dot(top.dots[s.key])}; ${bestStandard.name} is the best without specialist requirements. Work out which one you can actually use.`,
      h1: `Best gym for ${s.label} in Torn`,
      sub: `${top.name} has the highest obtainable ${s.label} dots at ${dot(top.dots[s.key])} — only the invite-only Fight Club goes higher. The best gym you can <em>use</em> is a different question: it depends on your unlocks and stat ratios.`,
      crumbs: [
        { name: 'Torn Training Optimizer', path: '/' },
        { name: `Best gym for ${s.label}`, path: `/best-gym-for-${s.key}/` },
      ],
      schema: [
        {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: [
            {
              '@type': 'Question',
              name: `What is the best gym for ${s.label} in Torn?`,
              acceptedAnswer: {
                '@type': 'Answer',
                text: `${top.name} has the highest obtainable ${s.label} dots at ${dot(top.dots[s.key])}, but it is a specialist gym with stat-ratio requirements. Among standard gyms, ${bestStandard.name} is the best at ${dot(bestStandard.dots[s.key])} dots. The best gym for you is the highest-dot gym you currently qualify for. (Fight Club has 10.0 dots but is invite-only.)`,
              },
            },
          ],
        },
      ],
      body: `      <h2>Ranked by ${s.label} dots</h2>
${gymTable(ranked, s.key)}

      <h2>The catch</h2>
      <p>
        The top of that table is mostly specialist gyms, and specialists gate on stat <em>ratios</em>:
        the stat you want to train has to sit a set percentage above your others, and you are locked
        out again the moment that stops being true. That makes "best" personal. ${bestStandard.name}
        at ${dot(bestStandard.dots[s.key])} dots is the ceiling if you have not built a lopsided
        ratio on purpose.
      </p>

      <a class="cta" href="/?stat=${s.key}">
        <b>Find your best usable ${s.label} gym →</b><br />
        Enter your stats and it filters out everything you are locked out of.
      </a>

      <h2>Related</h2>
      <p>
        <a href="/specialist-gyms/">Specialist gym requirements</a> ·
        <a href="/training-ratios/">Training ratios explained</a> ·
        <a href="/gym-dots/">Full dots chart</a>
      </p>`,
      related: related(`/best-gym-for-${s.key}/`),
    }),
    0.8,
  );
}

// --- /stat-cap/ : the page nobody has written properly
emit(
  '/stat-cap/',
  page({
    path: '/stat-cap/',
    title: 'The Torn 50M Stat Cap — Removed in 2022, and What Replaced It',
    description:
      'Torn removed the 50,000,000 gym stat cap in August 2022. Gains above 50M keep growing at a decreasing rate. Here is what actually happens now, with the official growth figures and the curve derived from them.',
    h1: 'The Torn 50M stat cap',
    sub: 'It is gone. Torn removed the hard cap on 2 August 2022, and most calculators still have not caught up — which is why they under-predict end-game gains.',
    crumbs: [
      { name: 'Torn Training Optimizer', path: '/' },
      { name: 'The 50M stat cap', path: '/stat-cap/' },
    ],
    schema: [
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Is there still a stat cap in Torn?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'No. Torn removed the 50,000,000 gym stat cap on 2 August 2022. Gym gains above 50M no longer freeze — they keep increasing, but at a steadily decreasing rate, so growth slows without ever stopping.',
            },
          },
          {
            '@type': 'Question',
            name: 'What happens to gym gains above 50 million in Torn?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Above 50M, the stat term in the gain formula is compressed logarithmically instead of frozen. A 1 billion stat behaves roughly like a 62 million one, and a 1 trillion stat like a 9.5 billion one, so gains keep rising while monthly percentage growth flattens toward about 2%.',
            },
          },
        ],
      },
    ],
    body: `      <h2>What changed</h2>
      <p>
        Before August 2022, the gain formula clamped your stat at 50,000,000. Training a 50M stat and
        a 5B stat produced exactly the same gain per train, which is why end-game players abandoned
        the gym for stat enhancers. Torn removed that clamp: past 50M the stat still counts, just
        with sharply diminishing weight.
      </p>

      <h2>The official numbers</h2>
      <p>
        Torn published monthly-growth figures for a fixed regime — 1,500 energy a day, George's, a
        fully upgraded private island, no Steadfast — before and after the change:
      </p>
      <table>
        <thead><tr><th>Stat</th><th>Monthly growth (old)</th><th>Monthly growth (now)</th></tr></thead>
        <tbody>
          <tr><td class="num">50M</td><td class="num">211.75%</td><td class="num">211.75%</td></tr>
          <tr><td class="num">100M</td><td class="num">103.35%</td><td class="num">108.05%</td></tr>
          <tr><td class="num">1B</td><td class="num">10.33%</td><td class="num">12.87%</td></tr>
          <tr><td class="num">5B</td><td class="num">2.07%</td><td class="num">4.47%</td></tr>
          <tr><td class="num">10B</td><td class="num">1.03%</td><td class="num">3.37%</td></tr>
          <tr><td class="num">50B</td><td class="num">0.21%</td><td class="num">2.40%</td></tr>
          <tr><td class="num">100B</td><td class="num">0.10%</td><td class="num">2.24%</td></tr>
          <tr><td class="num">1T</td><td class="num">0.01%</td><td class="num">1.97%</td></tr>
        </tbody>
      </table>

      <h2>The curve behind them</h2>
      <p>
        Those old figures scale exactly as 1/stat, which proves gain per train was flat above the cap
        and pins down the formula's stat coefficient. Inverting the new figures then gives the
        effective stat the game now uses:
      </p>
      <div class="callout">
        <code>S_eff = 50,000,000 + (S − 50,000,000) ÷ (8.77635 × log₁₀ S)</code>
      </div>
      <p>
        That reproduces every published figure from 1B to 1T within half a percent. In practice a 1B
        stat trains like a 62M one, a 10B stat like 163M, and a 1T stat like 9.5B — gains keep
        climbing, percentage growth flattens toward roughly 2% a month.
      </p>

      <div class="flag">
        Why it matters: a calculator that still clamps at 50M under-predicts a 200M player by about
        5%, and an end-game player by far more. One that ignores the cap entirely over-predicts
        wildly. This tool implements the curve above.
      </div>

      <a class="cta" href="/"><b>Run your own post-cap numbers →</b></a>`,
    related: related('/stat-cap/'),
  }),
  0.9,
);

// --- /gym-unlock-order/
emit(
  '/gym-unlock-order/',
  page({
    path: '/gym-unlock-order/',
    title: 'Torn Gym Unlock Order — All 24 Standard Gyms',
    description:
      'The full order Torn gyms unlock in, with the cost to join each one. Standard gyms unlock on gym EXP — total energy spent training — not on level or stats.',
    h1: 'Torn gym unlock order',
    sub: 'Standard gyms unlock on gym EXP: the cumulative energy you have spent training across your whole career. Not level, not stats, not days played.',
    crumbs: [
      { name: 'Torn Training Optimizer', path: '/' },
      { name: 'Unlock order', path: '/gym-unlock-order/' },
    ],
    schema: [
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'How do gyms unlock in Torn?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Standard gyms unlock with gym EXP, which is the total energy you have spent training over your entire career, and then a membership fee. Once you unlock George\u2019s you stop earning gym EXP. Specialist gyms instead require stat ratios and a prerequisite standard gym.',
            },
          },
        ],
      },
    ],
    body: `      <h2>The progression</h2>
${gymTable(standard)}
      <div class="callout">
        After George's you stop earning gym EXP entirely — the standard ladder ends there, and every
        gym above it is a specialist with ratio requirements instead.
      </div>
      <a class="cta" href="/"><b>See which gym you should be in →</b></a>`,
    related: related('/gym-unlock-order/'),
  }),
  0.8,
);

// --- /training-ratios/
emit(
  '/training-ratios/',
  page({
    path: '/training-ratios/',
    title: 'Torn Training Ratios — Hank\u2019s Ratio and Specialist Access',
    description:
      'How stat ratios in Torn gate the 7.5, 8.0 and 9.0-dot specialist gyms, why the 1.25:1:1:0 build exists, and what leaving a stat behind actually buys you.',
    h1: 'Torn training ratios',
    sub: 'Specialist gyms do not care how big your stats are — they care how lopsided they are. That single rule shapes every serious Torn build.',
    crumbs: [
      { name: 'Torn Training Optimizer', path: '/' },
      { name: 'Training ratios', path: '/training-ratios/' },
    ],
    body: `      <h2>Why ratios exist</h2>
      <p>
        Two-stat specialists need a pair of stats 25% above the other pair. Single-stat specialists
        need one stat 25% above your second highest. So access is bought with imbalance, and the
        cost of that imbalance is a stat you deliberately never train.
      </p>

      <h2>The common builds</h2>
      <ul>
        <li><strong>1.25 : 1 : 1 : 0</strong> — the classic. Three stats trained, one abandoned, primary held a quarter above the rest. Unlocks an 8.0-dot single-stat gym for the primary.</li>
        <li><strong>Balanced</strong> — no specialist access, George's at 7.3 forever. Simpler, and much better for defending against attacks.</li>
        <li><strong>Two-stat</strong> — a pair 25% above the other pair, for the 7.5-dot Balboas or Frontline. A softer commitment than a single-stat build.</li>
      </ul>

      <div class="flag">
        Ratios are checked continuously. Train the wrong stat and you fall out of the gym you built
        the whole ratio for, keeping the membership but losing access until you climb back.
      </div>

      <h2>Is the imbalance worth it?</h2>
      <p>
        Going from George's 7.3 to an 8.0-dot specialist is about 9.6% more gain per energy on that
        one stat — while the abandoned stat contributes nothing to your battle score. Whether that
        trades well depends on what you want the stats for.
      </p>

      <a class="cta" href="/"><b>Check which specialists you qualify for →</b><br />Enter your four stats and it computes every ratio requirement for you.</a>`,
    related: related('/training-ratios/'),
  }),
  0.7,
);

// --- /xanax-vs-lsd/
emit(
  '/xanax-vs-lsd/',
  page({
    path: '/xanax-vs-lsd/',
    title: 'Xanax vs LSD in Torn — Which Actually Gives More Energy',
    description:
      'LSD often looks cheaper per energy, but drugs share one cooldown. Per cooldown slot Xanax gives five times the energy. Here is the arithmetic that decides your daily training budget.',
    h1: 'Xanax vs LSD',
    sub: 'The per-dollar ranking is a trap. Drugs share a single cooldown, so the number that matters is energy per cooldown slot, not energy per dollar.',
    crumbs: [
      { name: 'Torn Training Optimizer', path: '/' },
      { name: 'Xanax vs LSD', path: '/xanax-vs-lsd/' },
    ],
    schema: [
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'Is Xanax or LSD better for training in Torn?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Xanax, in almost every case. Xanax gives 250 energy and LSD gives 50, and because all drugs share one cooldown you only get roughly three doses a day either way. That makes Xanax worth five times as much per slot, even when LSD looks cheaper per point of energy.',
            },
          },
        ],
      },
    ],
    body: `      <h2>The numbers</h2>
      <table>
        <thead><tr><th>Drug</th><th>Energy per dose</th><th>Doses per day</th><th>Energy per day</th></tr></thead>
        <tbody>
          <tr><td>Xanax</td><td class="num">250</td><td class="num">~3</td><td class="num">~750</td></tr>
          <tr><td>LSD</td><td class="num">50</td><td class="num">~3</td><td class="num">~150</td></tr>
        </tbody>
      </table>

      <div class="callout">
        The doses column is the whole argument. One shared cooldown of roughly 6–8 hours means about
        three doses a day whichever drug you take, so a cheap drug that fills the slot badly is
        expensive in the only currency that is actually scarce.
      </div>

      <h2>What your day actually holds</h2>
      <p>
        Natural regeneration gives 720 energy a day as a donator (5 per 10 minutes), plus roughly
        750 from Xanax and 150 from a points refill. The calculator adds these up for your own
        settings and uses the total as the training budget in every projection.
      </p>

      <a class="cta" href="/"><b>Work out your daily energy budget →</b></a>`,
    related: related('/xanax-vs-lsd/'),
  }),
  0.7,
);

// ---- Sitemap ---------------------------------------------------------------

const STATIC_URLS = [
  { path: '/', priority: 1.0, changefreq: 'weekly' },
  { path: '/happy-jump/', priority: 0.9 },
  { path: '/guide/', priority: 0.8 },
  { path: '/specialist-gyms/', priority: 0.8 },
];

const all = [...STATIC_URLS, ...urls];
writeFileSync(
  resolve(OUT, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${all
  .map(
    (u) => `  <url>
    <loc>${SITE}${u.path}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${u.changefreq ?? 'monthly'}</changefreq>
    <priority>${u.priority.toFixed(1)}</priority>
  </url>`,
  )
  .join('\n')}
</urlset>
`,
);

console.log(`gen-seo: ${urls.length} pages generated, sitemap has ${all.length} URLs.`);
