// Minimal local typings for nodemailer (the package ships without @types and
// we avoid adding a new dev dependency). Only the surface this project uses.
declare module 'nodemailer' {
  export interface SendMailOptions {
    from?: string
    to: string
    subject: string
    text?: string
    html?: string
  }
  export interface Transporter {
    sendMail(options: SendMailOptions): Promise<unknown>
  }
  export interface TransportOptions {
    host: string
    port: number
    secure?: boolean
    auth?: { user: string; pass: string }
    connectionTimeout?: number
    greetingTimeout?: number
    socketTimeout?: number
  }
  export function createTransport(options: TransportOptions): Transporter
  const _default: { createTransport: typeof createTransport }
  export default _default
}
