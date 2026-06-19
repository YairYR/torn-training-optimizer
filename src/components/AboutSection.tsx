export function AboutSection() {
  return (
    <section className="about" aria-label="About the Torn Training Optimizer">
      <p className="about-lead">
        <strong>Torn Training Optimizer</strong> is a free tool for the game{' '}
        <a href="https://www.torn.com/" rel="noopener noreferrer" target="_blank">
          Torn
        </a>{' '}
        that turns your stats, gyms and perks into a clear plan: which gym to train at, whether to
        happy-jump or energy-train, the cheapest energy, and exactly what it takes to unlock your next
        gym — for every battle stat. Paste your API key above to begin.
      </p>

      <h2>What you get</h2>
      <ul className="about-list">
        <li>
          <strong>Optimal training plan per stat.</strong> It chooses the method by stat level — 99k
          happy jumps win at low stats, but plain energy training wins once stats are high, so it
          never tells a high-stat player to chase jumps.
        </li>
        <li>
          <strong>Best usable gym per stat.</strong> Respects the gyms you have actually unlocked
          (gym EXP) and the specialist requirements for Balboas, Frontline, Mr. Isoyamas, The Elites
          and the Sports Science Lab.
        </li>
        <li>
          <strong>Auto-detected gym-gain modifier (M).</strong> Reads your gym-gain bonuses from your
          perks, per stat, with a breakdown — editable if it misses one.
        </li>
        <li>
          <strong>Economics &amp; daily energy capacity.</strong> Cheapest energy by cost, plus a
          cooldown-aware view of how much energy you can train per day (so it won't call LSD
          "cheaper" when Xanax gives 5× the energy per cooldown slot).
        </li>
        <li>
          <strong>Budget optimizer.</strong> Give it a money budget and it returns the best items to
          buy for the most gains.
        </li>
        <li>
          <strong>Unlock planner.</strong> How much energy, cash and days to unlock a specific gym or
          reach a target stat.
        </li>
        <li>
          <strong>Projections &amp; progress tracking.</strong> A multi-day stat projection chart,
          plus snapshots over time to compare your real gains against the formula's prediction.
        </li>
      </ul>

      <h2>How to use it</h2>
      <ol className="about-list">
        <li>Get a Torn API key (a read-only "Limited" key is enough).</li>
        <li>Paste it into the box above and press Load.</li>
        <li>Read your per-stat plan — everything fills in automatically.</li>
      </ol>

      <h2>Is my API key safe?</h2>
      <p>
        Yes. Your key stays in your browser and is only ever sent to api.torn.com — never to us.
        There is no server, no database and no account, so nothing is stored remotely. It's free, has
        no ads, and is not affiliated with Torn.
      </p>

      <p>
        New to gym training, or want the mechanics in depth? Read the{' '}
        <a href="/guide/">full Torn gym training guide</a> — happy, energy, drugs and gyms, with
        verified mechanics and when to happy-jump vs energy-train.
      </p>

      <h2>Frequently asked questions</h2>
      <dl className="about-faq">
        <dt>Should I happy jump or energy train?</dt>
        <dd>
          It depends on your stat level. Happy jumps to 99,999 win at low stats, but once stats are
          high, energy training wins because stacking energy for a jump wastes regeneration. The tool
          picks the right method per stat for you.
        </dd>
        <dt>Which gym should I train at?</dt>
        <dd>
          The best gym you can use for a stat is the one with the highest dots among those you've
          unlocked and qualify for. The optimizer marks it and shows what you'd need to reach the next
          one.
        </dd>
        <dt>How accurate is it?</dt>
        <dd>
          It uses the standard Torn gym-gain (Vladar) formula, checked against real in-game trains to
          about 0.1%. Community-reported but unconfirmed mechanics are flagged, not silently assumed.
        </dd>
        <dt>Is it like TornStats?</dt>
        <dd>
          It's narrower — focused only on gym-training optimization — and privacy-first, running
          entirely in your browser with no server.
        </dd>
      </dl>
    </section>
  );
}
