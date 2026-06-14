interface Props {
  apiKey: string;
  onApiKey: (v: string) => void;
  modifiers: number;
  onModifiers: (v: number) => void;
  loading: boolean;
  onLoad: () => void;
  error: string | null;
}

export function ApiKeyBar({ apiKey, onApiKey, modifiers, onModifiers, loading, onLoad, error }: Props) {
  return (
    <section className="panel">
      <h2>Connection</h2>
      <div className="apibar">
        <input
          type="password"
          placeholder="Torn API key (battlestats access)"
          value={apiKey}
          onChange={(e) => onApiKey(e.target.value)}
          aria-label="Torn API key"
        />
        <div>
          <label htmlFor="mod">Modifier M</label>
          <input
            id="mod"
            type="number"
            step="0.01"
            min="1"
            style={{ width: 110 }}
            value={modifiers}
            onChange={(e) => onModifiers(Math.max(0, Number(e.target.value) || 0))}
          />
        </div>
        <button onClick={onLoad} disabled={loading || !apiKey}>
          {loading ? 'Loading…' : 'Load data'}
        </button>
        <p className="hint">
          The key stays in your browser and is sent only to api.torn.com. It needs a Limited or Full
          key (battle stats are private). M is the product of your gym-gain perks — 1.00 if unknown;
          it does not change the gym ranking, only absolute gains.
        </p>
      </div>
      {error && <p className="error">{error}</p>}
    </section>
  );
}
