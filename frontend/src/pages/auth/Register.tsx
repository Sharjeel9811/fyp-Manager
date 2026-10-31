import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import api from '@/lib/api'
import { dispatchQueuedMail } from '@/lib/mail'
import { Mail, Lock, User, Building2, GraduationCap, Users, Check, ShieldCheck, ArrowRight } from 'lucide-react'
import { AuthLayout } from '@/components/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { SuccessCheck, Swap, popIn } from '@/components/motion/Reveal'
import { cn } from '@/lib/utils'
import { homeForRole, useAuth } from '@/context/AuthContext'

export default function Register() {
  const navigate = useNavigate()
  const { register, completeSession } = useAuth()
  const [role, setRole] = useState<'STUDENT' | 'SUPERVISOR'>('STUDENT')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  // After "Create account" the account exists but is locked until the email
  // OTP is confirmed — this is the code-entry step.
  const [otpEmail, setOtpEmail] = useState<string | null>(null)
  const [otpMinutes, setOtpMinutes] = useState(5)
  const [otpCode, setOtpCode] = useState('')
  const [otpLoading, setOtpLoading] = useState(false)
  const [resendMsg, setResendMsg] = useState('')

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    const formEl = e.currentTarget
    const form = new FormData(formEl)
    const payload = {
      role,
      firstName: form.get('firstName'),
      lastName: form.get('lastName'),
      email: form.get('email'),
      departmentName: form.get('department'),
      password: form.get('password'),
      ...(role === 'STUDENT'
        ? { studentId: form.get('identifier') }
        : { employeeId: form.get('identifier') }),
    }
    setLoading(true)
    try {
      const user = await register(payload)
      setDone(true)
      setTimeout(() => navigate(homeForRole(user.role), { replace: true }), 600)
    } catch (err: any) {
      if (err.needsVerification) {
        setOtpEmail(String(err.email || form.get('email') || ''))
        setOtpMinutes(Number(err.expiresInMinutes) || 5)
        setOtpCode('')
      } else {
        setError(err.message || 'Registration failed')
      }
    } finally {
      setLoading(false)
    }
  }

  const verifyCode = async () => {
    setError('')
    if (!/^\d{6}$/.test(otpCode.trim())) {
      setError('Enter the 6-digit code')
      return
    }
    setOtpLoading(true)
    try {
      const { data } = await api.post('/auth/verify-otp', { email: otpEmail, code: otpCode.trim() })
      await completeSession(data.token)
      setDone(true)
      setTimeout(() => navigate(homeForRole(data.user.role), { replace: true }), 600)
    } catch (err: any) {
      setError(err.message || 'Verification failed')
    } finally {
      setOtpLoading(false)
    }
  }

  const resendCode = async () => {
    setResendMsg('')
    try {
      const { data } = await api.post('/auth/resend-otp', { email: otpEmail })
      dispatchQueuedMail(data)
      setResendMsg(data.message || 'A new code has been sent')
    } catch (err: any) {
      setResendMsg(err.message || 'Could not resend — try again')
    }
  }

  const step = done ? 'done' : otpEmail ? 'otp' : 'form'
  const title = step === 'otp' ? 'Verify your email' : step === 'done' ? 'Account created' : 'Create your account'
  const subtitle =
    step === 'otp'
      ? `We sent a 6-digit code to ${otpEmail}. It expires in ${otpMinutes} minutes.`
      : step === 'done'
        ? "You're all set — taking you to your workspace."
        : "Join your university's FYP workspace in a few steps."

  return (
    <AuthLayout title={title} subtitle={subtitle}>
      <Swap step={step}>
        {step === 'otp' ? (
          <div>
            <div className="mb-5 flex items-start gap-3 rounded-2xl border border-brand-200/70 bg-gradient-to-br from-brand-50 to-white p-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-glow">
                <ShieldCheck className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-navy-900">Check your inbox</p>
                <p className="mt-0.5 text-xs leading-relaxed text-navy-500">
                  Enter the code from the email we just sent. It may take a few seconds to arrive.
                </p>
              </div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); verifyCode() }} className="space-y-4">
              <Input
                label="Verification code"
                name="otp"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="123456"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                icon={<ShieldCheck className="h-4 w-4" />}
                className="text-center font-mono text-lg tracking-[0.45em]"
                autoFocus
                required
              />
              <AnimatePresence initial={false}>
                {error && (
                  <motion.p
                    key={error}
                    initial={{ opacity: 0, x: 0 }}
                    animate={{ opacity: 1, x: [0, -6, 6, -4, 0] }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35 }}
                    role="alert"
                    className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
                  >
                    {error}
                  </motion.p>
                )}
                {!error && resendMsg && (
                  <motion.p
                    key={resendMsg}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="rounded-lg bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700"
                  >
                    {resendMsg}
                  </motion.p>
                )}
              </AnimatePresence>
              <Button type="submit" size="lg" className="w-full" loading={otpLoading}>
                {!otpLoading && <>Verify &amp; continue <ArrowRight className="h-4 w-4" /></>}
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={resendCode}>
                Resend code
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-navy-500">
              Wrong email?{' '}
              <button type="button" className="font-semibold text-brand-600 hover:text-brand-700" onClick={() => { setOtpEmail(null); setError(''); setResendMsg('') }}>
                Start over
              </button>
            </p>
          </div>
        ) : step === 'done' ? (
          <div {...popIn} className="rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50 to-white p-7 text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <SuccessCheck className="h-10 w-10 text-emerald-600" />
            </span>
            <h3 className="mt-4 text-base font-semibold text-navy-900">Registration successful</h3>
            <p className="mt-1 text-sm text-navy-600">Your account is ready. Redirecting to your dashboard…</p>
            <div className="mt-5 h-1 w-full overflow-hidden rounded-full bg-emerald-100">
              <motion.div
                initial={{ x: '-100%' }}
                animate={{ x: '100%' }}
                transition={{ duration: 1.1, repeat: Infinity, ease: 'easeInOut' }}
                className="h-full w-1/2 rounded-full bg-emerald-500"
              />
            </div>
          </div>
        ) : (
          <div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-navy-100 p-1">
                {[
                  { value: 'STUDENT', label: 'Student', icon: GraduationCap },
                  { value: 'SUPERVISOR', label: 'Supervisor', icon: Users },
                ].map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setRole(r.value as 'STUDENT' | 'SUPERVISOR')}
                    className={cn(
                      'relative flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                      role === r.value ? 'text-navy-900' : 'text-navy-500 hover:text-navy-700',
                    )}
                  >
                    {role === r.value && (
                      <motion.span
                        layoutId="role-pill"
                        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                        className="absolute inset-0 rounded-lg bg-white shadow-sm"
                      />
                    )}
                    <span className="relative flex items-center gap-2">
                      <r.icon className="h-4 w-4" /> {r.label}
                    </span>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input label="First name" name="firstName" placeholder="Alice" required />
                <Input label="Last name" name="lastName" placeholder="Johnson" required />
              </div>
              <Input label="University email" type="email" name="email" autoComplete="email" placeholder="you@university.edu" icon={<Mail className="h-4 w-4" />} required />
              <Input
                label={role === 'STUDENT' ? 'Student ID' : 'Employee ID'}
                name="identifier"
                placeholder={role === 'STUDENT' ? 'STU-2021-0142' : 'SUP-014'}
                icon={<User className="h-4 w-4" />}
                required
              />
              <Select label="Department" name="department" defaultValue="" required>
                <option value="" disabled>Select your department</option>
                <option>Computer Science</option>
                <option>Software Engineering</option>
                <option>Data Science</option>
                <option>Cybersecurity</option>
              </Select>
              <Input label="Password" type="password" name="password" autoComplete="new-password" placeholder="At least 8 characters with letters and numbers" icon={<Lock className="h-4 w-4" />} required minLength={8} />
              <p className="-mt-1 flex items-center gap-1.5 text-xs text-navy-400">
                <Building2 className="h-3.5 w-3.5" /> Use your official university email address.
              </p>

              <label className="flex items-start gap-2 text-xs text-navy-500">
                <input type="checkbox" required className="mt-0.5 h-4 w-4 rounded border-navy-300 text-brand-600 focus:ring-brand-500" />
                <span>I agree to the academic integrity policy and terms of use.</span>
              </label>

              <AnimatePresence initial={false}>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    role="alert"
                    className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              <Button type="submit" size="lg" className="w-full" loading={loading}>
                {!loading && <>Create account <Check className="h-4 w-4" /></>}
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-navy-500">
              Already registered?{' '}
              <Link to="/login" className="font-semibold text-brand-600 hover:text-brand-700">Sign in</Link>
            </p>
          </div>
        )}
      </Swap>
    </AuthLayout>
  )
}
