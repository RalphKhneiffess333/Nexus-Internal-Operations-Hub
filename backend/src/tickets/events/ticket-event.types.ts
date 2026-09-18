import { TicketEvent, TicketEventAction, TicketPriority } from '@prisma/client';

export interface SubmissionEventDetails {
  title: string;
  departmentId: string;
  priority: TicketPriority;
  description: string;
  submitterId: string;
}

export interface ClaimEventDetails {
  agentId: string;
  timestamp: string;
}

export interface CloseEventDetails {
  agentId: string;
  completionNotes: string | null;
}

export interface ReopenEventDetails {
  priority: TicketPriority;
  description: string;
  submitterId: string;
}

export interface DeleteEventDetails {
  deletedById: string;
}

export interface ModificationEventDetails {
  oldTitle: string;
  newTitle: string;
  oldDepartmentId: string;
  newDepartmentId: string;
  oldPriority: TicketPriority;
  newPriority: TicketPriority;
  oldDescription: string;
  newDescription: string;
}

export type HandoffEventAction =
  'REQUESTED' | 'ACCEPTED' | 'DENIED' | 'CANCELLED';

export interface HandoffEventDetails {
  requesterId: string;
  requestedAgentId: string;
  action: HandoffEventAction;
  timestamp: string;
}

export interface TicketEventDetailsByAction {
  [TicketEventAction.SUBMISSION]: SubmissionEventDetails;
  [TicketEventAction.CLAIM]: ClaimEventDetails;
  [TicketEventAction.CLOSE]: CloseEventDetails;
  [TicketEventAction.REOPEN]: ReopenEventDetails;
  [TicketEventAction.DELETE]: DeleteEventDetails;
  [TicketEventAction.MODIFICATION]: ModificationEventDetails;
  [TicketEventAction.HANDOFF]: HandoffEventDetails;
}

export type NewTicketEvent = {
  [Action in TicketEventAction]: {
    ticketId: string;
    userId: string;
    action: Action;
    details: TicketEventDetailsByAction[Action];
    createdAt: Date;
  };
}[TicketEventAction];

export type NewSubmissionEvent = Omit<
  Extract<NewTicketEvent, { action: 'SUBMISSION' }>,
  'ticketId'
>;

export type NewClaimEvent = Extract<NewTicketEvent, { action: 'CLAIM' }>;

export type NewTicketMutationEvent = Exclude<
  NewTicketEvent,
  { action: 'SUBMISSION' | 'CLAIM' }
>;

type TicketEventScalars = Omit<TicketEvent, 'action' | 'details'>;

export type TicketEventRecord = {
  [Action in TicketEventAction]: TicketEventScalars & {
    action: Action;
    details: TicketEventDetailsByAction[Action];
  };
}[TicketEventAction];
