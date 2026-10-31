// Shown instead of the app when there is no backend to talk to.
// Better a clear error than quietly running on fake data.
export default function ConfigError() {
  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <span className="brand">
            <span className="brand-mark" aria-hidden="true" />
            Call Guide
          </span>
        </div>
      </header>
      <div className="config-error" role="alert">
        <div className="config-error-inner">
          <p className="config-error-title">App not configured</p>
          <p>
            <code>VITE_API_URL</code>, <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>{' '}
            must all be set. Add them to <code>frontend/.env</code> (see <code>.env.example</code>) and restart{' '}
            <code>npm run dev</code>.
          </p>
          <p className="config-error-sub">
            Vite reads <code>.env</code> only at startup, and the file must sit in <code>frontend/</code> next to{' '}
            <code>package.json</code>. For an offline demo use <code>VITE_USE_MOCK=true</code> instead.
          </p>
        </div>
      </div>
    </div>
  );
}
