/**
 * Mail delivery. Uses SMTP when credentials are configured (SMTP_HOST,
 * SMTP_PORT, SMTP_USER, SMTP_PASS, optional MAIL_FROM); otherwise system mail
 * (password resets, signup OTPs) is queued into the durable MailOutbox
 * collection, which the admin "Mail" page lists so staff can relay links.
 *
 * No new dependencies: nodemailer is already part of the backend.
 */
import nodemailer, { type Transporter } from 'nodemailer'
import { MailOutbox } from '../models'

export interface QueuedMail {
  to: string
  subject: string
  body: string
  links?: string[]
}

let transport: Transporter | null | undefined

function resolveSettings() {
  // Custom SMTP host wins; otherwise MAIL_SERVICE=gmail maps to Gmail's
  // submission endpoint. Both credential naming styles are accepted.
  const service = String(process.env.MAIL_SERVICE || '').toLowerCase()
  const user = process.env.SMTP_USER || process.env.MAIL_USER
  const pass = process.env.SMTP_PASS || process.env.MAIL_PASS
  if (!user || !pass) return null
  if (process.env.SMTP_HOST) {
    const port = Number(process.env.SMTP_PORT || 587)
    return { host: process.env.SMTP_HOST, port, secure: port === 465, auth: { user, pass } }
  }
  if (service === 'gmail') {
    return { host: 'smtp.gmail.com', port: 465, secure: true, auth: { user, pass } }
  }
  return null
}

function getTransport(): Transporter | null {
  if (transport !== undefined) return transport
  const settings = resolveSettings()
  transport = settings
    ? nodemailer.createTransport({
        ...settings,
        // Serverless functions are short-lived; don't wait forever on a dead port.
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
      })
    : null
  return transport
}

export function mailTransportConfigured(): boolean {
  return !!getTransport()
}

/** App display name used in mail copy/subjects (APP_NAME env). */
export function appName(): string {
  return process.env.APP_NAME || 'FYP Manager'
}

export async function queueMail({ to, subject, body, links = [] }: QueuedMail): Promise<boolean> {
  const t = getTransport()
  if (t) {
    try {
      await t.sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER || process.env.MAIL_USER,
        to,
        subject,
        text: body,
      })
      return true
    } catch (err) {
      // Fall through to the outbox so the message isn't lost.
      console.error('[mailer] SMTP send failed, queuing instead:', (err as Error).message)
    }
  }

  try {
    await MailOutbox.create({ to, subject, body, links })
    return false
  } catch (err) {
    // Never block the primary flow on mail: resets already persisted their
    // token, so re-requesting generates a fresh one.
    console.error('[mailer] queue failed:', (err as Error).message)
    return false
  }
}
