import { Link } from 'react-router-dom'
import notFoundImage from '../assets/NotFound.png'

export function NotFoundPage() {
  return (
    <main className="not-found-page">
      <div className="not-found-card clay-card">
        <img src={notFoundImage} alt="" aria-hidden="true" />
        <div>
          <p className="eyebrow">Page not found</p>
          <h1>We couldn’t find that page.</h1>
          <p>The link may be outdated, or the page may have moved somewhere else in Nexus.</p>
          <Link to="/" className="btn primary">Back to home</Link>
        </div>
      </div>
    </main>
  )
}
