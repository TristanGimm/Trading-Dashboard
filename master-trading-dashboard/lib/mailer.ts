import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import nodemailer, { type Transporter } from 'nodemailer';

export type Mail = { to: string; subject: string; text: string; html?: string };
export type MailResult = { delivered: boolean; transport: 'smtp' | 'file' | 'console'; reason?: string };

// Only the host/user/pass transport is cached; a URL transport is cheap to build.
let cached: { key: string; transport: Transporter; from: string } | null = null;

function smtpConfig() {
  const url = process.env.SMTP_URL;
  const host = process.env.SMTP_HOST;
  const from = process.env.MAIL_FROM;
  if (!from) return null;
  if (url) return { transport: nodemailer.createTransport(url), from };
  if (!host) return null;
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const key = `${host}:${port}:${secure}:${process.env.SMTP_USER || ''}`;
  if (cached?.key !== key) {
    cached = {
      key,
      from,
      transport: nodemailer.createTransport({
        host,
        port,
        secure,
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' }
          : undefined,
      }),
    };
  }
  return { transport: cached.transport, from };
}

/**
 * Deliver an email. Without SMTP configuration nothing is silently dropped:
 * the message is appended to MAIL_DIR (or logged) and the caller is told it was
 * not delivered, so a reset link is never presented as sent when it was not.
 */
export async function sendMail(mail: Mail): Promise<MailResult> {
  const config = smtpConfig();
  if (config) {
    try {
      await config.transport.sendMail({ from: config.from, ...mail });
      return { delivered: true, transport: 'smtp' };
    } catch (error) {
      console.error('SMTP delivery failed:', error instanceof Error ? error.message : error);
      return { delivered: false, transport: 'smtp', reason: 'The mail server rejected the message.' };
    }
  }

  const dir = process.env.MAIL_DIR;
  if (dir) {
    try {
      await mkdir(dir, { recursive: true, mode: 0o700 });
      const stamp = new Date().toISOString();
      await appendFile(
        path.join(dir, 'outbox.log'),
        `\n===== ${stamp} → ${mail.to}\nSubject: ${mail.subject}\n\n${mail.text}\n`,
        { mode: 0o600 },
      );
      return { delivered: false, transport: 'file', reason: 'Email is not configured; the message was written to the local outbox.' };
    } catch (error) {
      console.error('Could not write the outbox file:', error);
    }
  }

  console.info(`[mail] ${mail.subject} → ${mail.to}\n${mail.text}`);
  return { delivered: false, transport: 'console', reason: 'Email is not configured.' };
}

/** True when links may be shown in the UI (local development only). */
export function mailDebugAllowed(): boolean {
  return process.env.MAIL_DEBUG === 'true' || (process.env.NODE_ENV !== 'production' && process.env.MAIL_DEBUG !== 'false');
}
