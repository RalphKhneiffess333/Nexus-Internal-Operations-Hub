import heroImage from '../../assets/hero.png'
import { TestLoginPanel } from '../../features/authentication/TestLoginPanel'
import { useAuthentication } from '../../features/authentication/use-authentication'

export function LandingPage() {
  const { error, loginWithMicrosoft, refreshAuthentication } =
    useAuthentication()

  return (
    <main className="landing-page">
      <section className="landing-hero" aria-label="Nexus sign in">
        <img className="landing-image" src={heroImage} alt="" aria-hidden="true" />
        <div className="landing-overlay" />
        <div className="landing-content">
          <div className="landing-brand">
            <span className="brand-mark" aria-hidden="true">
              N
            </span>
            <span className="brand-name">Nexus</span>
          </div>
          <div className="landing-copy">
            <p className="eyebrow">Service desk workspace</p>
            <h1>Nexus</h1>
            <p>
              Sign in with your company Microsoft account to continue to the
              ticket workspace.
            </p>
            <div className="landing-actions">
              <button
                type="button"
                className="btn microsoft-login"
                onClick={loginWithMicrosoft}
              >
                <span className="microsoft-mark" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                  <span />
                </span>
                Login with Microsoft
              </button>
              {error ? (
                <button
                  type="button"
                  className="btn landing-retry"
                  onClick={refreshAuthentication}
                >
                  Retry
                </button>
              ) : null}
            </div>
            <TestLoginPanel />
            {error ? <p className="landing-error">{error}</p> : null}
          </div>
        </div>
      </section>
    </main>
  )
}
