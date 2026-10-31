import api from './api'

export interface QueuedMailHandle {
  mailId?: string
  mailToken?: string
}

/**
 * Kick off SMTP delivery for a message the API just queued.
 *
 * Signup/reset answer as soon as the message is persisted, so the user never
 * waits on Gmail. This follow-up request performs the actual send in its own
 * execution budget. It is intentionally fire-and-forget: the form has already
 * moved on, and a failure simply leaves the message in the admin outbox.
 */
export function dispatchQueuedMail(data: QueuedMailHandle | null | undefined): void {
  if (!data?.mailId || !data?.mailToken) return
  void api.post('/auth/dispatch-mail', { id: data.mailId, token: data.mailToken }).catch(() => {
    // Deliberately ignored — the message stays visible under Admin → Mail.
  })
}
