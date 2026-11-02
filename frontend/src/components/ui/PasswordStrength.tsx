import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Password strength meter shared by the sign-up and reset-password forms.
 *
 * Bands mirror the server policy (8+ characters, at least one letter and one
 * digit); the fourth rule is advisory only and never blocks submission.
 */
export const strengthBands = [
  { label: 'Too weak', bar: 'bg-red-500', text: 'text-red-600' },
  { label: 'Too weak', bar: 'bg-red-500', text: 'text-red-600' },
  { label: 'Fair', bar: 'bg-amber-500', text: 'text-amber-600' },
  { label: 'Good', bar: 'bg-brand-500', text: 'text-brand-600' },
  { label: 'Strong', bar: 'bg-emerald-500', text: 'text-emerald-600' },
]

export function passwordRules(password: string) {
  return [
    { key: 'length', label: '8+ characters', ok: password.length >= 8 },
    { key: 'letter', label: 'A letter', ok: /[a-zA-Z]/.test(password) },
    { key: 'number', label: 'A number', ok: /\d/.test(password) },
    { key: 'long', label: '12+ for extra safety', ok: password.length >= 12 },
  ]
}

export function PasswordStrength({ password, capsLock }: { password: string; capsLock?: boolean }) {
  const rules = passwordRules(password)
  const score = rules.filter((r) => r.ok).length
  const band = strengthBands[score]

  return (
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
  )
}
