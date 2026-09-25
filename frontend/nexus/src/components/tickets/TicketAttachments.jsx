export function TicketAttachments({
  attachments = [],
  heading = 'Attachments',
  downloadingAttachmentId,
  onOpen,
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
            <div className="ticket-attachment-actions">
              <button
                type="button"
                className="ticket-attachment"
                title={attachment.originalName}
                onClick={() => onOpen(attachment)}
                disabled={downloadingAttachmentId === attachment.attachmentId}
              >
                <span aria-hidden="true">📎</span>
                <span>{attachment.originalName}</span>
              </button>
              <button
                type="button"
                className="ticket-attachment-download"
                onClick={() => onDownload(attachment)}
                disabled={downloadingAttachmentId === attachment.attachmentId}
              >
                {downloadingAttachmentId === attachment.attachmentId
                  ? 'Working…'
                  : 'Download'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
