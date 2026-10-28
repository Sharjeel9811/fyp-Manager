/**
 * Mail delivery. The free-tier deployment has no SMTP credentials, so system
 * mail (password resets, team invites) is queued into the durable MailOutbox
 * collection. The admin "Mail" page lists those messages and lets staff copy
 * links to the recipient. When SMTP credentials are configured later, drain()
 * can be pointed at a real transport without changing any call sites.
 */
import { MailOutbox } from '../models'

export interface QueuedMail {
  to: string
  subject: string
  body: string
  links?: string[]
}

export async function queueMail({ to, subject, body, links = [] }: QueuedMail): Promise<void> {
  try {
    await MailOutbox.create({ to, subject, body, links })
  } catch (err) {
    // Never block the primary flow on mail: resets already persisted their
    // token, so re-requesting generates a fresh one.
    console.error('[mailer] queue failed:', (err as Error).message)
  }
}
