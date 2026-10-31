import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Mail, Lock, Eye, EyeOff, ArrowRight, GraduationCap, Users, ShieldCheck } from 'lucide-react'
import { AuthLayout } from '@/components/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { fadeUp } from '@/components/motion/Reveal'
import { cn } from '@/lib/utils'
import { homeForRole, useAuth } from '@/context/AuthContext'

const demos = [
  { role: 'Student', email: 'student@fypmanager.com', icon: GraduationCap, tone: 'text-brand-600 bg-brand-50 ring-brand-200' },
  { role: 'Supervisor', email: 'supervisor@fypmanager.com', icon: Users, tone: 'text-sky-600 bg-sky-50 ring-sky-200' },
  { role: 'Admin', email: 'admin@fypmanager.com', icon: ShieldCheck, tone: 'text-navy-700 bg-navy-100 ring-navy-200' },
]

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  const { login, user, loading: authLoading } = useAuth()

  useEffect(() => {
    if (!authLoading && user) navigate(homeForRole(user.role), { replace: true })
  }, [authLoading, user, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!email || !password) {
      setError('Enter your email and password to continue.')
      return
    }
    setLoading(true)
    try {
      const loggedIn = await login(email, password)
      navigate(homeForRole(loggedIn.role), { replace: true })
    } catch (err: any) {
      setError(err.message || 'Unable to sign in')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout title="Welcome back" subtitle="Sign in to continue managing your final year project.">
      <motion.form onSubmit={handleSubmit} className="space-y-5" {...fadeUp}>
        <Input
          label="Email address"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@university.edu"
          icon={<Mail className="h-4 w-4" />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div>
          <div className="relative">
            <Input
              label="Password"
              type={show ? 'text' : 'password'}
              name="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              icon={<Lock className="h-4 w-4" />}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pr-11"
            />
            <button
              type="button"
              onClick={() => setShow((v) => !v)}
              className="absolute right-3 top-[34px] rounded-md p-1.5 text-navy-400 hover:bg-navy-100 hover:text-navy-700"
              aria-label={show ? 'Hide password' : 'Show password'}
            >
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-navy-600">
            <input type="checkbox" className="h-4 w-4 rounded border-navy-300 text-brand-600 focus:ring-brand-500" />
            Remember me
          </label>
          <Link to="/forgot-password" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
            Forgot password?
          </Link>
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
          {!loading && <>Sign in <ArrowRight className="h-4 w-4" /></>}
        </Button>
      </motion.form>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.18, duration: 0.4 }}
        className="mt-7"
      >
        <div className="relative">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-navy-200" /></div>
          <div className="relative flex justify-center"><span className="bg-white px-3 text-xs font-medium uppercase tracking-wide text-navy-400">Demo accounts</span></div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {demos.map((d, i) => (
            <motion.button
              key={d.role}
              type="button"
              onClick={() => { setEmail(d.email); setPassword('password123') }}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.97 }}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.24 + i * 0.05, duration: 0.3 }}
              className={cn('flex flex-col items-center gap-1.5 rounded-xl border bg-white px-2 py-3 text-xs font-semibold ring-1 ring-inset transition-shadow hover:shadow-soft', d.tone)}
            >
              <d.icon className="h-4 w-4" />
              {d.role}
            </motion.button>
          ))}
        </div>
        <p className="mt-2 text-center text-[11px] text-navy-400">Click a role to autofill demo credentials (password123).</p>
      </motion.div>

      <p className="mt-8 text-center text-sm text-navy-500">
        Don't have an account?{' '}
        <Link to="/register" className="font-semibold text-brand-600 hover:text-brand-700">Create one</Link>
      </p>
    </AuthLayout>
  )
}
