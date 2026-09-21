export function LoadingState({ children }) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <span className="loading-spinner" aria-hidden="true" />
      <p>{children}</p>
    </div>
  )
}
