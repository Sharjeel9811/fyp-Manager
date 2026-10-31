import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Mail, ArrowLeft, ArrowRight, AlertTriangle, Loader2, Lock, Eye, EyeOff,
  KeyRound, ShieldCheck, Check, X,
} from 'lucide-react'
import { AuthLayout } from '@/components/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SuccessCheck, Swap } from '@/components/motion/Reveal'
import { cn } from '@/lib/utils'
import api from '@/lib/api'
import { dispatchQueuedMail } from '@/lib/mail'

export function ForgotPassword() {
  const [sent, setSent] = useState(false)
  const [sentTo, setSentTo] = useState('')
  const [sentMsg, setSentMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const email = String(new FormData(e.currentTarget).get('email') || '')
    setError('')
    setLoading(true)
    try {
      const { data } = await api.post('/auth/forgot-password', { email })
      dispatchQueuedMail(data)
      setSentTo(email)
      setSentMsg(data.message || 'Reset link sent')
      setSent(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Reset your password" subtitle="Enter your account email and we'll send a secure reset link.">
      <Swap step={sent ? 'sent' : 'form'}>
        {sent ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50 to-white p-7 text-center">
              <motion.span
                initial={{ scale: 0.75, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"
              >
                <Mail className="h-7 w-7" />
              </motion.span>
              <h3 className="mt-4 text-base font-semibold text-navy-900">Check your email</h3>
              <p className="mt-1 text-sm text-navy-600">{sentMsg || 'A reset link is on its way.'}</p>
              <p className="mx-auto mt-3 inline-block max-w-full truncate rounded-lg bg-white px-3 py-1.5 font-mono text-xs text-navy-700 ring-1 ring-inset ring-navy-200">
                {sentTo}
              </p>
              <p className="mt-4 text-xs leading-relaxed text-navy-500">
                The link works once and expires in one hour. If it doesn't arrive in a minute or two, check spam or send another.
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setSent(false)}>
                Use another email
              </Button>
              <Link to="/login" className="flex-1">
                <Button variant="ghost" className="w-full">Back to sign in</Button>
              </Link>
            </div>
          </div>
        ) : (
          <div>
            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="Email address"
                type="email"
                name="email"
                autoComplete="email"
                placeholder="you@university.edu"
                icon={<Mail className="h-4 w-4" />}
                hint="Use the address you registered with — that's where the link goes."
                required
              />
              <AnimatePresence initial={false}>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                    role="alert"
                    className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>
              <Button type="submit" size="lg" className="w-full" loading={loading}>
                {!loading && <>Send reset link <ArrowRight className="h-4 w-4" /></>}
              </Button>
            </form>
          </div>
        )}
      </Swap>

      {!sent && (
        <Link to="/login" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-700">
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>
      )}
    </AuthLayout>
  )
}

/** Password strength bands, tuned to the server policy (8+ chars, letter, digit). */
const strengthBands = [
  { label: 'Too weak', bar: 'bg-red-500', text: 'text-red-600' },
  { label: 'Too weak', bar: 'bg-red-500', text: 'text-red-600' },
  { label: 'Fair', bar: 'bg-amber-500', text: 'text-amber-600' },
  { label: 'Good', bar: 'bg-brand-500', text: 'text-brand-600' },
  { label: 'Strong', bar: 'bg-emerald-500', text: 'text-emerald-600' },
]

export function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [invalidLink, setInvalidLink] = useState(false)
  const [done, setDone] = useState(false)

  const rules = useMemo(
    () => [
      { key: 'length', label: '8+ characters', ok: password.length >= 8 },
      { key: 'letter', label: 'A letter', ok: /[a-zA-Z]/.test(password) },
      { key: 'number', label: 'A number', ok: /\d/.test(password) },
      { key: 'long', label: '12+ for extra safety', ok: password.length >= 12 },
    ],
    [password],
  )
  const score = rules.filter((r) => r.ok).length
  const band = strengthBands[score]
  const match = confirm.length > 0 && confirm === password
  const canSubmit = rules.slice(0, 3).every((r) => r.ok) && match

  const watchCaps = (e: React.KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(e.getModifierState?.('CapsLock') ?? false)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    if (!rules[0].ok || !rules[1].ok || !rules[2].ok) {
      setError('Use at least 8 characters, including a letter and a number.')
      return
    }
    if (password !== confirm) {
      setError('The two passwords do not match.')
      return
    }
    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, password })
      setDone(true)
    } catch (err: any) {
      const message = err?.message || 'Could not update your password'
      // A used/expired link is a state, not a typo: offer a fresh one.
      if (/invalid|expired/i.test(message)) setInvalidLink(true)
      else setError(message)
    } finally {
      setLoading(false)
    }
  }

  const state = !token || invalidLink ? 'invalid' : done ? 'done' : 'form'

  return (
    <AuthLayout
      title={state === 'invalid' ? 'Reset link unavailable' : state === 'done' ? 'Password updated' : 'Choose a new password'}
      subtitle={
        state === 'invalid'
          ? 'This link has already been used or has expired.'
          : state === 'done'
            ? 'Your account is secure again.'
            : 'Make it strong and unique to your account.'
      }
    >
      <Swap step={state}>
        {state === 'invalid' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-amber-200 bg-gradient-to-b from-amber-50 to-white p-7 text-center">
              <motion.span
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600"
              >
                <KeyRound className="h-7 w-7" />
              </motion.span>
              <h3 className="mt-4 text-base font-semibold text-navy-900">This reset link isn't valid</h3>
              <p className="mt-1 text-sm leading-relaxed text-navy-600">
                Reset links work once and expire after one hour. Request a fresh link and open the newest email we send.
              </p>
            </div>
            <Link to="/forgot-password" className="block">
              <Button size="lg" className="w-full">Request a new link <ArrowRight className="h-4 w-4" /></Button>
            </Link>
            <Link to="/login" className="block text-center text-sm font-semibold text-brand-600 hover:text-brand-700">
              Back to sign in
            </Link>
          </div>
        )}

        {state === 'done' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50 to-white p-7 text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <SuccessCheck className="h-10 w-10 text-emerald-600" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-navy-900">Password updated</h3>
              <p className="mt-1 text-sm text-navy-600">You can now sign in with your new password.</p>
              <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-emerald-700">
                <ShieldCheck className="h-3.5 w-3.5" /> Other devices were signed out for your security.
              </p>
            </div>
            <Link to="/login" className="block">
              <Button size="lg" className="w-full">Continue to sign in <ArrowRight className="h-4 w-4" /></Button>
            </Link>
          </div>
        )}

        {state === 'form' && (
          <div>
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-navy-200/80 bg-gradient-to-b from-brand-50 to-white p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-glow">
                <KeyRound className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-navy-900">One-time reset link</p>
                <p className="mt-0.5 text-xs leading-relaxed text-navy-500">
                  Expires one hour after it was sent and stops working once the password is changed.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <div className="relative">
                  <Input
                    label="New password"
                    type={showPw ? 'text' : 'password'}
                    name="password"
                    autoComplete="new-password"
                    placeholder="At least 8 characters with letters and numbers"
                    icon={<Lock className="h-4 w-4" />}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={watchCaps}
                    onKeyUp={watchCaps}
                    onBlur={() => setCapsLock(false)}
                    className="pr-11"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    className="absolute right-3 top-[34px] rounded-md p-1.5 text-navy-400 transition-colors hover:bg-navy-100 hover:text-navy-700"
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {/* Strength meter */}
                <div className="mt-2.5">
                  <div className="flex items-center gap-2">
                    <div className="flex flex-1 gap-1.5" aria-hidden="true">
                      {[0, 1, 2, 3].map((i) => (
                        <span
                          key={i}
                          className={cn(
                            'h-1.5 flex-1 rounded-full transition-all duration-300 ease-out',
                            i < score ? band.bar : 'bg-navy-100',
                            i < score ? 'opacity-100' : 'opacity-70',
                          )}
                        />
                      ))}
                    </div>
                    <span
                      aria-live="polite"
                      className={cn('w-[72px] text-right text-[11px] font-semibold transition-colors', password ? band.text : 'text-navy-400')}
                    >
                      {password ? band.label : 'Strength'}
                    </span>
                  </div>
                  <ul className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5">
                    {rules.map((r) => (
                      <li key={r.key} className="flex items-center gap-1.5 text-[11px]">
                        <span
                          className={cn(
                            'flex h-3.5 w-3.5 items-center justify-center rounded-full transition-colors duration-200',
                            r.ok ? 'bg-emerald-100 text-emerald-600' : 'bg-navy-100 text-navy-400',
                          )}
                        >
                          {r.ok ? <Check className="h-2.5 w-2.5" strokeWidth={3.5} /> : <span className="h-1 w-1 rounded-full bg-current" />}
                        </span>
                        <span className={r.ok ? 'text-navy-600' : 'text-navy-400'}>{r.label}</span>
                      </li>
                    ))}
                  </ul>
                  <AnimatePresence>
                    {capsLock && (
                      <motion.p
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700"
                      >
                        <AlertTriangle className="h-3 w-3" /> Caps Lock is on
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              <div>
                <div className="relative">
                  <Input
                    label="Confirm new password"
                    type={showConfirm ? 'text' : 'password'}
                    name="confirm"
                    autoComplete="new-password"
                    placeholder="Re-enter your new password"
                    icon={<Lock className="h-4 w-4" />}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    onKeyDown={watchCaps}
                    onKeyUp={watchCaps}
                    className="pr-11"
                    required
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-3 top-[34px] rounded-md p-1.5 text-navy-400 transition-colors hover:bg-navy-100 hover:text-navy-700"
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <AnimatePresence>
                  {confirm.length > 0 && (
                    <motion.p
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.18 }}
                      className={cn('mt-1.5 flex items-center gap-1.5 text-xs font-medium', match ? 'text-emerald-600' : 'text-amber-600')}
                    >
                      {match ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                      {match ? 'Passwords match' : 'Passwords do not match yet'}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <AnimatePresence initial={false}>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                    role="alert"
                    className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              <Button type="submit" size="lg" className="w-full" loading={loading}>
                {!loading && <>Update password <ArrowRight className="h-4 w-4" /></>}
              </Button>
              {!canSubmit && (password.length > 0 || confirm.length > 0) && (
                <p className="text-center text-[11px] text-navy-400">
                  Finish all three password requirements and confirm it to continue.
                </p>
              )}
            </form>

            <p className="mt-6 text-center text-sm text-navy-500">
              Remembered it?{' '}
              <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">Sign in instead</Link>
            </p>
          </div>
        )}
      </Swap>
    </AuthLayout>
  )
}

export function VerifyEmail() {
  const [params] = useSearchParams()
  const token = params.get('token')
  const [state, setState] = useState<'idle' | 'verifying' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) return
    setState('verifying')
    api.get(`/auth/verify-email/${token}`)
      .then(() => setState('success'))
      .catch((err) => { setMessage(err.message); setState('error') })
  }, [token])

  return (
    <AuthLayout
      title={state === 'success' ? 'Email verified' : state === 'error' ? 'Verification failed' : 'Verify your email'}
      subtitle={state === 'success' ? 'Your account is active.' : 'One quick step to activate your FYP Manager account.'}
    >
      <Swap step={state === 'verifying' || state === 'idle' ? 'checking' : state === 'success' ? 'ok' : 'err'}>
        {state === 'verifying' || state === 'idle' ? (
          <div className="flex flex-col items-center py-10 text-navy-500">
            <span className="relative flex h-16 w-16 items-center justify-center">
              <span className="absolute inset-0 animate-ping rounded-full bg-brand-100" />
              <Loader2 className="relative h-8 w-8 animate-spin text-brand-600" />
            </span>
            <p className="mt-4 text-sm font-medium">Verifying your email…</p>
          </div>
        ) : state === 'success' ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50 to-white p-7 text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <SuccessCheck className="h-10 w-10 text-emerald-600" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-navy-900">Email verified</h3>
              <p className="mt-1 text-sm text-navy-600">Your account is active. You can sign in now.</p>
            </div>
            <Link to="/login" className="block"><Button size="lg" className="w-full">Go to sign in</Button></Link>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-2xl border border-red-200 bg-gradient-to-b from-red-50 to-white p-7 text-center">
              <motion.span
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-100 text-red-600"
              >
                <AlertTriangle className="h-7 w-7" />
              </motion.span>
              <h3 className="mt-4 text-base font-semibold text-navy-900">Verification failed</h3>
              <p className="mt-1 text-sm text-navy-600">{message || 'The link is invalid or has expired.'}</p>
            </div>
            <Link to="/login" className="block"><Button variant="outline" className="w-full">Back to sign in</Button></Link>
          </div>
        )}
      </Swap>
    </AuthLayout>
  )
}
