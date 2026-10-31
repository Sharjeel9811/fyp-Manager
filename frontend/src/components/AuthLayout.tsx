import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { BookOpen, CheckCircle2, ShieldCheck, Sparkles } from 'lucide-react'
import { easeOut, Stagger, StaggerItem } from '@/components/motion/Reveal'

export function AuthLayout({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode
  title: string
  subtitle: string
}) {
  return (
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-2">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.45, ease: easeOut }}
        className="relative hidden overflow-hidden bg-navy-950 lg:flex lg:flex-col"
      >
        <div className="absolute inset-0 grid-mask opacity-40" />
        <div className="absolute -left-24 top-1/3 h-72 w-72 animate-float rounded-full bg-brand-600/30 blur-3xl" />
        <div className="absolute -right-16 bottom-0 h-72 w-72 animate-float rounded-full bg-sky-500/20 blur-3xl [animation-delay:2s]" />
        <div className="absolute right-1/4 top-10 h-40 w-40 animate-float rounded-full bg-indigo-400/10 blur-2xl [animation-delay:4s]" />

        <div className="relative flex h-full flex-col p-12">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: easeOut }}
          >
            <Link to="/" className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600 shadow-lg shadow-brand-500/30">
                <BookOpen className="h-5 w-5 text-white" />
              </span>
              <span className="font-display text-lg font-bold text-white">FYP Manager</span>
            </Link>
          </motion.div>

          <Stagger className="my-auto max-w-md" delay={0.1} gap={0.08}>
            <StaggerItem>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-brand-200">
                <Sparkles className="h-3.5 w-3.5" /> The FYP operating system
              </span>
            </StaggerItem>
            <StaggerItem>
              <h1 className="mt-6 font-display text-4xl font-bold leading-tight tracking-tight text-white">
                Every project, <br /> every deadline, <br />
                <span className="bg-gradient-to-r from-brand-300 to-sky-300 bg-clip-text text-transparent">one workspace.</span>
              </h1>
            </StaggerItem>
            <StaggerItem>
              <p className="mt-5 text-[15px] leading-relaxed text-navy-300">
                Proposals, teams, milestones, feedback, evaluations, and explainable project health — connected end to end.
              </p>
            </StaggerItem>
            <StaggerItem>
              <ul className="mt-8 space-y-3">
                {[
                  'Structured proposal review workflow',
                  'Private, versioned submissions',
                  'Rule-based project health monitoring',
                  'Role-based access enforced on the server',
                ].map((t) => (
                  <li key={t} className="flex items-center gap-2.5 text-sm text-navy-200">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-brand-400" /> {t}
                  </li>
                ))}
              </ul>
            </StaggerItem>
          </Stagger>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.45, duration: 0.4 }}
            className="flex items-center gap-2 text-xs text-navy-400"
          >
            <ShieldCheck className="h-4 w-4" /> Secure academic records, audited end to end
          </motion.div>
        </div>
      </motion.div>

      <div className="relative flex min-h-screen flex-col overflow-hidden">
        {/* Soft page glow behind the form; purely decorative. */}
        <div className="pointer-events-none absolute -top-24 right-0 h-64 w-64 rounded-full bg-brand-500/10 blur-3xl" />

        <div className="relative flex items-center justify-between p-6 lg:hidden">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600">
              <BookOpen className="h-5 w-5 text-white" />
            </span>
            <span className="font-display text-base font-bold text-navy-900">FYP Manager</span>
          </Link>
          <Link to="/" className="text-sm font-medium text-navy-500 hover:text-navy-900">Home</Link>
        </div>

        <div className="relative flex flex-1 items-center justify-center px-5 py-8 sm:px-8">
          <div className="w-full max-w-md">
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: easeOut }}
              className="mb-8"
            >
              <h2 className="font-display text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">{title}</h2>
              <p className="mt-2 text-sm text-navy-500">{subtitle}</p>
            </motion.div>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
