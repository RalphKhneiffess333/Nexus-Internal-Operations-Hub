import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TicketForm,
  validateTicketFields,
} from '../../components/tickets/TicketForm'
import { createTicket } from '../../features/tickets/ticket-api'

export function NewTicketPage() {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [createdCode, setCreatedCode] = useState('')

  async function handleSubmit(values) {
    const nextFieldErrors = validateTicketFields(values, {
      requireSubmittedBy: true,
    })
    setFieldErrors(nextFieldErrors)
    if (Object.keys(nextFieldErrors).length > 0) {
      return
    }

    setSubmitting(true)
    setError('')
    try {
      const ticket = await createTicket({
        title: values.title,
        description: values.description,
        priority: values.priority,
        departmentId: values.departmentId,
        submittedBy: values.submittedBy,
      })
      setCreatedCode(ticket.ticketCode)
      navigate(`/tickets/${ticket.ticketId}`)
    } catch (submitError) {
      setError(
        submitError.message || 'Unable to submit this ticket. Please try again.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">New request</p>
          <h1>Submit a ticket</h1>
        </div>
      </header>
      {createdCode ? (
        <p className="banner success">Ticket {createdCode} was created.</p>
      ) : null}
      <TicketForm
        includeSubmittedBy
        submitLabel="Submit ticket"
        submittingLabel="Submitting..."
        submitting={submitting}
        error={error}
        fieldErrors={fieldErrors}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/tickets')}
      />
    </section>
  )
}
