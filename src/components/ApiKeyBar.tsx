import { useState } from 'react';

interface Props {
  apiKey: string;
  onApiKey: (v: string) => void;
  loading: boolean;
  onLoad: () => void;
  error: string | null;
}

export function ApiKeyBar({ apiKey, onApiKey, loading, onLoad, error }: Props) {
  // The field was write-only: masked, with no way to check a paste. A Torn key
  // is 16 characters of noise, so a truncated or double-pasted one looks
  // identical to a good one and the only feedback was a failed load. This is
  // the primary conversion action, so let people see what they typed.
  const [reveal, setReveal] = useState(false);

  return (
    <section className="panel">
      <h2>Connection</h2>
      {/* A real form, so Enter submits from the field rather than doing nothing. */}
      <form
        className="apibar"
        onSubmit={(e) => {
          e.preventDefault();
          if (!loading && apiKey) onLoad();
        }}
      >
        <div className="apikey-field">
          <input
            type={reveal ? 'text' : 'password'}
            placeholder="Torn API key (battle stats access)"
            value={apiKey}
            onChange={(e) => onApiKey(e.target.value)}
            aria-label="Torn API key"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
          />
          <button
            type="button"
            className="reveal-btn"
            onClick={() => setReveal((r) => !r)}
            aria-pressed={reveal}
          >
            {reveal ? 'Hide' : 'Show'}
          </button>
        </div>
        <button type="submit" disabled={loading || !apiKey}>
          {loading ? 'Loading…' : 'Load data'}
        </button>
        <p className="hint">
          The key stays in your browser and is sent only to api.torn.com. It needs a Limited or Full
          key — stats, perks and personal stats are private. Your gym-gain modifiers are detected
          from your perks on load and can be edited below.
        </p>
      </form>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
