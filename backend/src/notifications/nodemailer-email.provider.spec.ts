import { describe, expect, it, jest } from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type SendMailOptions } from 'nodemailer';
import { NodemailerEmailProvider } from './nodemailer-email.provider';

describe('NodemailerEmailProvider', () => {
  it('maps the provider-independent message to an SMTP transport', async () => {
    const sendMail = jest
      .fn<(options: SendMailOptions) => Promise<unknown>>()
      .mockResolvedValue({ messageId: 'smtp-id' });
    const createTransport = jest
      .spyOn(nodemailer, 'createTransport')
      .mockReturnValue({
        sendMail,
      } as unknown as ReturnType<typeof nodemailer.createTransport>);
    const config = configFor({
      SMTP_USER: 'smtp-user',
      SMTP_PASSWORD: 'smtp-password',
    });

    try {
      const provider = new NodemailerEmailProvider(
        config as unknown as ConfigService,
      );

      await provider.send({
        to: { email: 'person@example.com', name: 'Person' },
        subject: '[Nexus] Ticket claimed',
        text: 'A ticket was claimed.',
        html: '<p>A ticket was claimed.</p>',
      });

      expect(createTransport).toHaveBeenCalledWith({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        auth: { user: 'smtp-user', pass: 'smtp-password' },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
      });
      expect(sendMail).toHaveBeenCalledWith({
        from: { address: 'noreply@example.com', name: 'Nexus' },
        to: { address: 'person@example.com', name: 'Person' },
        subject: '[Nexus] Ticket claimed',
        text: 'A ticket was claimed.',
        html: '<p>A ticket was claimed.</p>',
      });
    } finally {
      createTransport.mockRestore();
    }
  });

  it('does not create a transport when SMTP configuration is incomplete', async () => {
    const createTransport = jest.spyOn(nodemailer, 'createTransport');

    try {
      const provider = new NodemailerEmailProvider({
        get: jest.fn(),
      } as unknown as ConfigService);

      await provider.send({
        to: { email: 'person@example.com' },
        subject: 'Subject',
        text: 'Text',
        html: '<p>Text</p>',
      });

      expect(createTransport).not.toHaveBeenCalled();
    } finally {
      createTransport.mockRestore();
    }
  });
});

function configFor(overrides: Record<string, string> = {}) {
  const values: Record<string, string> = {
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: '587',
    SMTP_SECURE: 'false',
    SMTP_FROM_EMAIL: 'noreply@example.com',
    SMTP_FROM_NAME: 'Nexus',
    SMTP_ENABLED: 'true',
    SMTP_TIMEOUT_MS: '10000',
    ...overrides,
  };
  return { get: jest.fn((key: string) => values[key]) };
}
