import {
  TicketEvent,
  TicketEventAction,
  TicketPriority,
  UserRole,
} from '@prisma/client';

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

export interface TicketEventUser {
  userId: string;
  fullName: string;
  email: string;
  role: UserRole;
}

export interface SubmissionEventDetailsResponse
  extends Omit<SubmissionEventDetails, 'submitterId'> {
  submitter: TicketEventUser;
}

export interface ClaimEventDetailsResponse
  extends Omit<ClaimEventDetails, 'agentId'> {
  agent: TicketEventUser;
}

export interface CloseEventDetailsResponse
  extends Omit<CloseEventDetails, 'agentId'> {
  agent: TicketEventUser;
}

export interface ReopenEventDetailsResponse
  extends Omit<ReopenEventDetails, 'submitterId'> {
  submitter: TicketEventUser;
}

export interface DeleteEventDetailsResponse
  extends Omit<DeleteEventDetails, 'deletedById'> {
  deletedBy: TicketEventUser;
}

export interface HandoffEventDetailsResponse
  extends Omit<HandoffEventDetails, 'requesterId' | 'requestedAgentId'> {
  requester: TicketEventUser;
  requestedAgent: TicketEventUser;
}

export interface TicketEventDetailsResponseByAction {
  [TicketEventAction.SUBMISSION]: SubmissionEventDetailsResponse;
  [TicketEventAction.CLAIM]: ClaimEventDetailsResponse;
  [TicketEventAction.CLOSE]: CloseEventDetailsResponse;
  [TicketEventAction.REOPEN]: ReopenEventDetailsResponse;
  [TicketEventAction.DELETE]: DeleteEventDetailsResponse;
  [TicketEventAction.MODIFICATION]: ModificationEventDetails;
  [TicketEventAction.HANDOFF]: HandoffEventDetailsResponse;
}

type TicketEventScalars = Omit<TicketEvent, 'action' | 'details' | 'userId'>;

export type TicketEventRecord = {
  [Action in TicketEventAction]: TicketEventScalars & {
    action: Action;
    user: TicketEventUser;
    details: TicketEventDetailsResponseByAction[Action];
  };
}[TicketEventAction];
