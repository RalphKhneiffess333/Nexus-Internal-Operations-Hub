export const UserInternalEvent = {
  Deactivated: 'user.deactivated',
} as const;

export interface UserDeactivatedEvent {
  userId: string;
}
