import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { TicketForm } from "../../components/tickets/TicketForm";
import { validateTicketFields } from "../../components/tickets/ticket-validation";
import { useDepartments } from "../../features/departments/use-departments";
import { createTicket } from "../../features/tickets/ticket-api";

export function NewTicketPage() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [createdCode, setCreatedCode] = useState("");
  const {
    departments,
    loading: loadingDepartments,
    error: departmentsError,
    reload: reloadDepartments,
  } = useDepartments();

  async function handleSubmit(values) {
    const nextFieldErrors = validateTicketFields(values);
    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0) {
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const ticket = await createTicket({
        title: values.title,
        description: values.description,
        priority: values.priority,
        departmentId: values.departmentId,
      });
      setCreatedCode(ticket.ticketCode);
      navigate(`/tickets/${ticket.ticketId}`);
    } catch (submitError) {
      setError(
        submitError.message ||
          "Unable to submit this ticket. Please try again.",
      );
    } finally {
      setSubmitting(false);
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

      {loadingDepartments ? (
        <p className="muted">Loading departments...</p>
      ) : null}

      {!loadingDepartments && departmentsError ? (
        <div className="banner error">
          <p>{departmentsError}</p>
          <button
            type="button"
            className="btn ghost"
            onClick={reloadDepartments}
          >
            Try again
          </button>
        </div>
      ) : null}

      {!loadingDepartments && !departmentsError ? (
        <TicketForm
          departments={departments}
          submitLabel="Submit ticket"
          submittingLabel="Submitting..."
          submitting={submitting}
          error={error}
          fieldErrors={fieldErrors}
          onSubmit={handleSubmit}
          onCancel={() => navigate("/tickets")}
        />
      ) : null}
    </section>
  );
}
