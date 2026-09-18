export function TicketAttachments({
  attachments = [],
  heading = 'Attachments',
  downloadingAttachmentId,
  onDownload,
}) {
  if (attachments.length === 0) {
    return null
  }

  return (
    <div className="ticket-attachments">
      <p className="ticket-attachments-heading">{heading}</p>
      <ul>
        {attachments.map((attachment) => (
          <li key={attachment.attachmentId}>
            <button
              type="button"
              className="ticket-attachment"
              onClick={() => onDownload(attachment)}
              disabled={downloadingAttachmentId === attachment.attachmentId}
            >
              <span aria-hidden="true">📎</span>
              <span>{attachment.originalName}</span>
              <span className="ticket-attachment-action">
                {downloadingAttachmentId === attachment.attachmentId
                  ? 'Downloading…'
                  : 'Download'}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
