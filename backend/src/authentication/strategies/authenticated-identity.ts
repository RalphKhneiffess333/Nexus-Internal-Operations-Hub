export interface AuthenticatedIdentity {
  provider: string;
  providerUserId: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  displayName: string;
  phoneNumber?: string | null;
}
