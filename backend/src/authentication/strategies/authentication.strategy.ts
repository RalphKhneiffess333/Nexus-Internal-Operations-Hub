import { AuthenticatedIdentity } from './authenticated-identity';

export interface AuthenticationStrategy<TInput = unknown> {
  authenticate(input: TInput): Promise<AuthenticatedIdentity>;
}
