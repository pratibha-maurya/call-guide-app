// Frame for the pages shown before logging in.
export default function AuthLayout({ title, lede, children }) {
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
      <main className="main">
        <section className="start auth" aria-labelledby="auth-title">
          <h1 id="auth-title" className="start-title">{title}</h1>
          {lede && <p className="start-lede">{lede}</p>}
          {children}
        </section>
      </main>
    </div>
  );
}
