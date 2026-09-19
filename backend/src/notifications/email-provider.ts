export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface OutboundEmail {
  to: EmailRecipient;
  subject: string;
  text: string;
  html: string;
}

export interface EmailProvider {
  send(message: OutboundEmail): Promise<void>;
}

export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');
