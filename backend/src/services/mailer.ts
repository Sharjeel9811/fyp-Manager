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

function getTransport(): Transporter | null {
  if (transport !== undefined) return transport
  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  if (!host || !user || !pass) {
    transport = null
    return transport
  }
  const port = Number(process.env.SMTP_PORT || 587)
  transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    // Serverless functions are short-lived; don't wait forever on a dead port.
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  })
  return transport
}

export function mailTransportConfigured(): boolean {
  return !!getTransport()
}

export async function queueMail({ to, subject, body, links = [] }: QueuedMail): Promise<boolean> {
  const t = getTransport()
  if (t) {
    try {
      await t.sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER,
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
