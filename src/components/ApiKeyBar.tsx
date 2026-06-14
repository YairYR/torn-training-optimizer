interface Props {
  apiKey: string;
  onApiKey: (v: string) => void;
  loading: boolean;
  onLoad: () => void;
  error: string | null;
}

export function ApiKeyBar({ apiKey, onApiKey, loading, onLoad, error }: Props) {
  return (
    <section className="panel">
      <h2>Connection</h2>
      <div className="apibar">
        <input
          type="password"
          placeholder="Torn API key (battle stats access)"
          value={apiKey}
          onChange={(e) => onApiKey(e.target.value)}
          aria-label="Torn API key"
        />
        <button onClick={onLoad} disabled={loading || !apiKey}>
          {loading ? 'Loading…' : 'Load data'}
        </button>
        <p className="hint">
          The key stays in your browser and is sent only to api.torn.com. It needs a Limited or Full
          key — stats, perks and personal stats are private. Your gym-gain modifiers are detected
          from your perks on load and can be edited below.
        </p>
      </div>
      {error && <p className="error">{error}</p>}
    </section>
  );
}
