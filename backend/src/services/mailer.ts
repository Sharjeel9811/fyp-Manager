/**
 * Mail delivery.
 *
 * Signup/reset must never wait on Gmail, so the pipeline is split in two:
 *
 *   1. `enqueueMail()` writes one MailOutbox row (single fast insert) and hands
 *      back a one-time dispatch token. The HTTP request responds immediately.
 *   2. `deliverMail()` performs the SMTP send and records the outcome. It runs
 *      from a follow-up `POST /auth/dispatch-mail` request made by the client
 *      right after the form submits, so the serverless function has its own
 *      execution budget and the work cannot be frozen mid-send.
 *
 * If SMTP is missing or the send fails, the row stays in the outbox and the
 * admin "Mail" page lists it so staff can relay the code/link manually.
 *
 * No new dependencies: nodemailer is already part of the backend.
 */
import nodemailer, { type Transporter } from 'nodemailer'
import { randomUUID } from 'crypto'
import { MailOutbox } from '../models'

export interface QueuedMail {
  to: string
  subject: string
  body: string
  links?: string[]
}

/** Handle returned to the caller so it can trigger delivery separately. */
export interface MailHandle {
  id: string
  token: string
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
        // A slow relay must fail fast so the dispatch request can report the
        // outbox fallback instead of hanging until the platform kills it.
        connectionTimeout: 4_000,
        greetingTimeout: 4_000,
        socketTimeout: 6_000,
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

/**
 * Persist a message for delivery. One insert, no network I/O — safe to await
 * inside a request that must answer instantly.
 */
export async function enqueueMail({ to, subject, body, links = [] }: QueuedMail): Promise<MailHandle | null> {
  try {
    const token = randomUUID()
    const doc: any = await MailOutbox.create({
      to,
      subject,
      body,
      links,
      status: 'queued',
      attempts: 0,
      dispatchToken: token,
    })
    return { id: String(doc._id), token }
  } catch (err) {
    // Never block the primary flow on mail: the OTP/reset token is already
    // persisted, so the user can request another message.
    console.error('[mailer] enqueue failed:', (err as Error).message)
    return null
  }
}

/**
 * Attempt delivery of one queued message. Idempotent: only the first caller
 * claims the row, so a duplicated dispatch request cannot send twice.
 */
export async function deliverMail(id: string, token?: string): Promise<boolean> {
  const match: Record<string, unknown> = { _id: id, attempts: { $lt: 3 } }
  if (token) match.dispatchToken = token
  // A row left in "sending" by a killed function becomes retryable after a
  // minute instead of being stuck forever.
  match.$or = [
    { status: 'queued' },
    { status: 'failed' },
    { status: 'sending', updatedAt: { $lt: new Date(Date.now() - 60_000) } },
  ]

  let claim: any = null
  try {
    claim = await MailOutbox.findOneAndUpdate(
      match,
      { $set: { status: 'sending' }, $inc: { attempts: 1 } },
      { new: true }
    )
  } catch (err) {
    console.error('[mailer] claim failed:', (err as Error).message)
    return false
  }
  if (!claim) return false

  const t = getTransport()
  if (!t) {
    await MailOutbox.updateOne(
      { _id: id },
      { $set: { status: 'failed', deliveryError: 'SMTP is not configured — relay this message manually' } }
    ).catch(() => {})
    return false
  }

  try {
    await Promise.race([
      t.sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER || process.env.MAIL_USER,
        to: claim.to,
        subject: claim.subject,
        text: claim.body,
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('SMTP attempt timed out')), 7_000)),
    ])
    // Drop the plaintext body/code once delivered: the recipient has it, and
    // the credential should not linger in the database or the admin page.
    await MailOutbox.updateOne(
      { _id: id },
      { $set: { status: 'sent', sentAt: new Date(), links: [] }, $unset: { body: '', dispatchToken: '' } }
    ).catch(() => {})
    return true
  } catch (err) {
    const message = (err as Error).message || 'SMTP send failed'
    console.error('[mailer] SMTP send failed, keeping in outbox:', message)
    await MailOutbox.updateOne(
      { _id: id },
      { $set: { status: 'failed', deliveryError: message.slice(0, 300) } }
    ).catch(() => {})
    return false
  }
}

/**
 * Enqueue and try to deliver right away. Used where latency doesn't matter
 * (nothing currently) and by tests/tools.
 */
export async function queueMail(mail: QueuedMail): Promise<boolean> {
  const handle = await enqueueMail(mail)
  if (!handle) return false
  return deliverMail(handle.id)
}
