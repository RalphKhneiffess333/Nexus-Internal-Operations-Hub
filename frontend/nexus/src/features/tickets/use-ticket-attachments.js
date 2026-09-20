import { useCallback, useEffect, useState } from 'react'
import { downloadTicketAttachment, getTicketAttachments, openTicketAttachment } from './ticket-api'
import { useLatestRequest } from '../../lib/api/use-latest-request'

export function useTicketAttachments(ticketId) {
  const { beginRequest } = useLatestRequest()
  const [ticketAttachments, setTicketAttachments] = useState(null)
  const [downloadingAttachmentId, setDownloadingAttachmentId] = useState('')
  const [error, setError] = useState('')

  const reload = useCallback(async () => {
    const request = beginRequest()
    try {
      const result = await getTicketAttachments(ticketId, { signal: request.controller.signal })
      if (!request.isCurrent()) return
      setTicketAttachments(result)
    } catch {
      if (request.isCurrent()) setTicketAttachments(null)
    }
  }, [beginRequest, ticketId])

  useEffect(() => {
    // The attachment hook owns the initial attachment synchronization for this page.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload()
  }, [reload])

  const downloadAttachment = useCallback(async (attachment, eventId) => {
    setDownloadingAttachmentId(attachment.attachmentId)
    setError('')
    try {
      await downloadTicketAttachment(ticketId, eventId, attachment.attachmentId)
    } catch (downloadError) {
      setError(downloadError.message || 'Unable to download this attachment. Please try again.')
    } finally {
      setDownloadingAttachmentId('')
    }
  }, [ticketId])

  const openAttachment = useCallback(async (attachment, eventId) => {
    setDownloadingAttachmentId(attachment.attachmentId)
    setError('')
    try {
      await openTicketAttachment(ticketId, eventId, attachment.attachmentId)
    } catch (openError) {
      setError(openError.message || 'Unable to open this attachment. Please try again.')
    } finally {
      setDownloadingAttachmentId('')
    }
  }, [ticketId])

  return {
    attachments: ticketAttachments,
    downloadingAttachmentId,
    error,
    reload,
    downloadAttachment,
    openAttachment,
  }
}
