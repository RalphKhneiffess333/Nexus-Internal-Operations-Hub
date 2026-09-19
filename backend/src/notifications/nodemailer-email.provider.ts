import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer, { type SendMailOptions } from 'nodemailer';
import type { EmailProvider, OutboundEmail } from './email-provider';

type EmailTransport = {
  sendMail(options: SendMailOptions): Promise<unknown>;
};

@Injectable()
export class NodemailerEmailProvider implements EmailProvider {
  private readonly transporter: EmailTransport | null;
  private readonly fromEmail: string | undefined;
  private readonly fromName: string | undefined;
  private readonly enabled: boolean;

  constructor(config: ConfigService) {
    const host = config.get<string>('SMTP_HOST')?.trim();
    const port = this.readPositiveInteger(config, 'SMTP_PORT', 587);
    const secure = config.get<string>('SMTP_SECURE') === 'true' || port === 465;
    const username = config.get<string>('SMTP_USER')?.trim();
    const password = config.get<string>('SMTP_PASSWORD');
    const timeout = this.readPositiveInteger(config, 'SMTP_TIMEOUT_MS', 10000);
    this.fromEmail = config.get<string>('SMTP_FROM_EMAIL')?.trim() || undefined;
    this.fromName = config.get<string>('SMTP_FROM_NAME')?.trim() || undefined;
    this.enabled = config.get<string>('SMTP_ENABLED') !== 'false';

    if (!this.enabled || !host || !this.fromEmail) {
      this.transporter = null;
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      ...(username && password !== undefined
        ? { auth: { user: username, pass: password } }
        : {}),
      connectionTimeout: timeout,
      greetingTimeout: timeout,
      socketTimeout: timeout,
    });
  }

  async send(message: OutboundEmail): Promise<void> {
    if (!this.transporter || !this.fromEmail) return;

    await this.transporter.sendMail({
      from: {
        address: this.fromEmail,
        ...(this.fromName ? { name: this.fromName } : {}),
      },
      to: message.to.name
        ? { address: message.to.email, name: message.to.name }
        : message.to.email,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }

  private readPositiveInteger(
    config: ConfigService,
    key: string,
    fallback: number,
  ): number {
    const value = Number(config.get<string>(key));
    return Number.isInteger(value) && value > 0 ? value : fallback;
  }
}
