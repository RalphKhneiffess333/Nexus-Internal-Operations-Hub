const DEFAULT_CLASS_NAMES = {
  container: 'ticket-attachments',
  heading: 'ticket-attachments-heading',
  actions: 'ticket-attachment-actions',
  attachment: 'ticket-attachment',
  download: 'ticket-attachment-download',
}

export function AttachmentList({
  attachments = [],
  heading = 'Attachments',
  downloadingAttachmentId,
  onOpen,
  onDownload,
  classNames = DEFAULT_CLASS_NAMES,
}) {
  if (attachments.length === 0) {
    return null
  }

  return (
    <div className={classNames.container}>
      <p className={classNames.heading}>{heading}</p>
      <ul>
        {attachments.map((attachment) => {
          const isBusy = downloadingAttachmentId === attachment.attachmentId

          return (
            <li key={attachment.attachmentId}>
              <div className={classNames.actions}>
                <button
                  type="button"
                  className={classNames.attachment}
                  title={attachment.originalName}
                  onClick={() => onOpen(attachment)}
                  disabled={isBusy}
                >
                  <span aria-hidden="true">📎</span>
                  <span>{attachment.originalName}</span>
                </button>
                <button
                  type="button"
                  className={classNames.download}
                  onClick={() => onDownload(attachment)}
                  disabled={isBusy}
                >
                  {isBusy ? 'Working…' : 'Download'}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
