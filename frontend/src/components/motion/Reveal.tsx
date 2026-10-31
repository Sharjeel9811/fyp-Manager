import { motion, useReducedMotion } from 'framer-motion'

/**
 * Shared motion primitives.
 *
 * Everything here is deliberately small (8–18px travel, 0.2–0.5s) so the app
 * feels responsive rather than animated. Framer's global `reducedMotion="user"`
 * (set in main.tsx) plus the local `useReducedMotion` checks keep the UI calm
 * for anyone who asks their OS for less movement.
 */

export const easeOut = [0.22, 1, 0.36, 1] as const

export const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.35, ease: easeOut },
}

export const popIn = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
  transition: { duration: 0.3, ease: easeOut },
}

/** Fade + rise when an element scrolls into view (once). */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 18,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
  y?: number
}) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={reduce ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-70px' }}
      transition={{ duration: 0.5, delay, ease: easeOut }}
    >
      {children}
    </motion.div>
  )
}

/** Parent that staggers its `StaggerItem` children into view. */
export function Stagger({
  children,
  className,
  delay = 0,
  gap = 0.06,
}: {
  children: React.ReactNode
  className?: string
  delay?: number
  gap?: number
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="show"
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: gap, delayChildren: delay } },
      }}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <motion.div
      className={className}
      variants={{
        hidden: { opacity: 0, y: 10 },
        show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: easeOut } },
      }}
    >
      {children}
    </motion.div>
  )
}

/** Animated success tick used by the auth result screens. */
export function SuccessCheck({ className = 'h-12 w-12 text-emerald-600' }: { className?: string }) {
  const reduce = useReducedMotion()
  return (
    <svg viewBox="0 0 52 52" className={className} fill="none" aria-hidden="true">
      <motion.circle
        cx="26"
        cy="26"
        r="24"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeOpacity="0.3"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
      />
      <motion.path
        d="M15 27.5 22.5 35 37 19.5"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.4, delay: 0.25, ease: 'easeOut' }}
      />
    </svg>
  )
}
