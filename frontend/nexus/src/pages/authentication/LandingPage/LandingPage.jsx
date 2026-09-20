import landingPageImage from '../../../assets/LandingPageImg.png'
import { TestLoginPanel } from '../../../features/authentication/TestLoginPanel/TestLoginPanel'
import { useAuthentication } from '../../../features/authentication/use-authentication'

export function LandingPage() {
  const { error, loginWithMicrosoft, refreshAuthentication } =
    useAuthentication()

  return (
    <main className="landing-page">
      <section className="landing-hero" aria-label="Nexus sign in">
        <div className="landing-shell">
          <header className="landing-header">
            <div className="landing-brand">
              <span className="brand-mark" aria-hidden="true">N</span>
              <span className="brand-name">Nexus</span>
            </div>
            <span className="landing-status">
              <span className="landing-status-dot" aria-hidden="true" />
              Secure service desk
            </span>
          </header>

          <div className="landing-layout">
            <div className="landing-content">
              <div className="landing-copy">
                <p className="eyebrow">Service desk workspace</p>
                <h1>Everything your team needs, in one place.</h1>
                <p>
                  Connect requests, conversations, and handoffs in a workspace
                  designed to keep support moving.
                </p>
                <div className="landing-highlights" aria-label="Nexus capabilities">
                  <div className="landing-highlight"><span className="landing-highlight-icon" aria-hidden="true">01</span><span>Organize requests</span></div>
                  <div className="landing-highlight"><span className="landing-highlight-icon" aria-hidden="true">02</span><span>Collaborate clearly</span></div>
                  <div className="landing-highlight"><span className="landing-highlight-icon" aria-hidden="true">03</span><span>Resolve faster</span></div>
                </div>
                <div className="landing-actions">
                  <button type="button" className="btn microsoft-login" onClick={loginWithMicrosoft}>
                    <span className="microsoft-mark" aria-hidden="true"><span /><span /><span /><span /></span>
                    Login with Microsoft
                  </button>
                  {error ? <button type="button" className="btn landing-retry" onClick={refreshAuthentication}>Retry</button> : null}
                </div>
                <TestLoginPanel />
                {error ? <p className="landing-error">{error}</p> : null}
              </div>
            </div>

            <aside className="landing-visual" aria-label="Nexus workspace overview">
              <img className="landing-image" src={landingPageImage} alt="Nexus workspace connecting tickets, conversations, and teams" />
              <div className="landing-overlay" />
              <div className="landing-visual-content">
                <span className="landing-visual-badge">Built for clarity</span>
                <strong>One connected workspace.</strong>
                <span>Keep every request and handoff moving forward.</span>
              </div>
            </aside>
          </div>

          <footer className="landing-footer"><span>Nexus service desk</span><span>Internal workspace</span></footer>
        </div>
      </section>
    </main>
  )
}

