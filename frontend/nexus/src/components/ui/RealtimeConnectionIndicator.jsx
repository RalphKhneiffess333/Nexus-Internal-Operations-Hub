import { useOperationsSocket } from '../../features/realtime/use-operations-socket'

const statusLabels = {
  connected: 'Live updates connected',
  connecting: 'Connecting live updates',
  reconnecting: 'Reconnecting live updates',
  error: 'Live updates unavailable',
  disconnected: 'Live updates disconnected',
}

export function RealtimeConnectionIndicator() {
  const { connectionState } = useOperationsSocket()

  return (
    <p
      className={`realtime-connection is-${connectionState}`}
      role="status"
      aria-live="polite"
    >
      <span aria-hidden="true" />
      {statusLabels[connectionState]}
    </p>
  )
}
