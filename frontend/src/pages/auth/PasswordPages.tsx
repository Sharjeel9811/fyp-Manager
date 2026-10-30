import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Mail, ArrowLeft, CheckCircle2, AlertTriangle, Loader2, Lock } from 'lucide-react'
import { AuthLayout } from '@/components/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import api from '@/lib/api'

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
      {sent ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
          <h3 className="mt-3 text-base font-semibold text-emerald-900">Check your email</h3>
          <p className="mt-1 text-sm text-emerald-700">{sentMsg || `A reset link is on its way to ${sentTo}.`}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input label="Email address" type="email" name="email" placeholder="you@university.edu" icon={<Mail className="h-4 w-4" />} required />
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
          <Button type="submit" size="lg" className="w-full" loading={loading}>Send reset link</Button>
        </form>
      )}
      <Link to="/login" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand-600 hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" /> Back to sign in
      </Link>
    </AuthLayout>
  )
}

export function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') || ''
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const password = String(form.get('password') || '')
    const confirm = String(form.get('confirm') || '')
    setError('')
    if (password !== confirm) return setError('Passwords do not match')
    if (password.length < 6) return setError('Password must be at least 6 characters')
    setLoading(true)
    try {
      await api.post('/auth/reset-password', { token, password })
      setDone(true)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Choose a new password" subtitle="Make it strong and unique to your account.">
      {done ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
            <h3 className="mt-3 text-base font-semibold text-emerald-900">Password updated</h3>
            <p className="mt-1 text-sm text-emerald-700">You can now sign in with your new password.</p>
          </div>
          <Link to="/login"><Button className="w-full" size="lg">Sign in</Button></Link>
        </div>
      ) : !token ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-amber-600" />
          <h3 className="mt-3 text-base font-semibold text-amber-900">Missing reset token</h3>
          <p className="mt-1 text-sm text-amber-700">Open the reset link from your email, or request a new one.</p>
          <Link to="/forgot-password" className="mt-4 block"><Button variant="outline" className="w-full">Request new link</Button></Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input label="New password" type="password" name="password" placeholder="At least 8 characters with letters and numbers" icon={<Lock className="h-4 w-4" />} required minLength={8} />
          <Input label="Confirm password" type="password" name="confirm" placeholder="Re-enter password" icon={<Lock className="h-4 w-4" />} required minLength={6} />
          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{error}</p>}
          <Button type="submit" size="lg" className="w-full" loading={loading}>Update password</Button>
        </form>
      )}
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
    <AuthLayout title="Verify your email" subtitle="One quick step to activate your FYP Manager account.">
      {state === 'verifying' ? (
        <div className="flex flex-col items-center py-10 text-navy-500">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
          <p className="mt-3 text-sm font-medium">Verifying your email…</p>
        </div>
      ) : state === 'success' ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
          <h3 className="mt-3 text-base font-semibold text-emerald-900">Email verified</h3>
          <p className="mt-1 text-sm text-emerald-700">Your account is active. You can sign in now.</p>
          <Link to="/login" className="mt-4 block"><Button className="w-full">Go to sign in</Button></Link>
        </div>
      ) : state === 'error' ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
          <AlertTriangle className="mx-auto h-10 w-10 text-red-600" />
          <h3 className="mt-3 text-base font-semibold text-red-900">Verification failed</h3>
          <p className="mt-1 text-sm text-red-700">{message || 'The link is invalid or has expired.'}</p>
          <Link to="/login" className="mt-4 block"><Button variant="outline" className="w-full">Back to sign in</Button></Link>
        </div>
      ) : (
        <div className="rounded-2xl border border-navy-200 bg-white p-8 text-center shadow-soft">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50">
            <Mail className="h-7 w-7 text-brand-600" />
          </span>
          <h3 className="mt-4 text-base font-semibold text-navy-900">Verification link sent</h3>
          <p className="mt-1 text-sm text-navy-500">Open the email we sent and click the link to verify. It expires in 24 hours.</p>
          <Link to="/login" className="mt-6 block"><Button className="w-full" size="lg">Go to sign in</Button></Link>
        </div>
      )}
    </AuthLayout>
  )
}
