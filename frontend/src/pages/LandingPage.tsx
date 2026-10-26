import { Link } from 'react-router-dom'
import {
  BookOpen, ArrowRight, ShieldCheck, Users, FileText, ListChecks, Award, Activity,
  BarChart3, CheckCircle2, GraduationCap, Sparkles, Lock, Bell,
  LayoutDashboard, TrendingUp, Clock, CircleDot,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

const features = [
  { icon: FileText, title: 'Proposal workflow', desc: 'Draft, submit, review, and revise proposals with a full status timeline and version history.', tone: 'text-brand-600 bg-brand-50' },
  { icon: Users, title: 'Teams & supervision', desc: 'Form teams, request supervisors, and manage allocations with clear capacity rules.', tone: 'text-sky-600 bg-sky-50' },
  { icon: ListChecks, title: 'Milestones & deadlines', desc: 'Plan deliverables, track completion, and surface overdue work before it becomes a problem.', tone: 'text-emerald-600 bg-emerald-50' },
  { icon: UploadCloudIcon, title: 'Private submissions', desc: 'Store reports and presentations securely with versioning and scoped access.', tone: 'text-indigo-600 bg-indigo-50' },
  { icon: Award, title: 'Rubric-based grading', desc: 'Score against weighted criteria and release results only when approved.', tone: 'text-amber-600 bg-amber-50' },
  { icon: Activity, title: 'Project Health Monitor', desc: 'Explainable, rule-based risk scoring flags projects that may need support.', tone: 'text-rose-600 bg-rose-50' },
]

function UploadCloudIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
      <path d="M12 12v9" /><path d="m16 16-4-4-4 4" />
    </svg>
  )
}

const roles = [
  {
    role: 'Students', icon: GraduationCap, accent: 'from-brand-500 to-indigo-600',
    points: ['Submit and track proposals', 'Manage milestones & deliverables', 'Receive structured feedback', 'View released evaluations'],
  },
  {
    role: 'Supervisors', icon: Users, accent: 'from-sky-500 to-cyan-600',
    points: ['Review assigned projects', 'Approve or request revisions', 'Monitor project health', 'Schedule defenses & grade'],
  },
  {
    role: 'Coordinators', icon: ShieldCheck, accent: 'from-navy-700 to-navy-900',
    points: ['Manage users & sessions', 'Assign supervisors with audit trail', 'Configure rubrics & deadlines', 'Export university-wide reports'],
  },
]

const steps = [
  { n: '01', title: 'Set up the academic session', desc: 'Coordinators configure departments, semesters, stages, and deadlines once — everything flows from there.' },
  { n: '02', title: 'Students propose & form teams', desc: 'Teams submit structured proposals, request supervisors, and track review status in real time.' },
  { n: '03', title: 'Supervisors guide the work', desc: 'Milestones, submissions, and feedback stay in one workspace, with revision history preserved.' },
  { n: '04', title: 'Evaluate & defend', desc: 'Panel scoring uses weighted rubrics; results stay private until an authorized release.' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-navy-800">
      <header className="sticky top-0 z-40 nav-blur">
        <div className="container-page flex h-16 items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600 shadow-lg shadow-brand-500/25">
              <BookOpen className="h-5 w-5 text-white" />
            </span>
            <span className="font-display text-lg font-bold tracking-tight text-navy-900">FYP Manager</span>
          </Link>
          <nav className="hidden items-center gap-8 md:flex">
            <a href="#features" className="text-sm font-medium text-navy-600 hover:text-navy-900">Features</a>
            <a href="#workflow" className="text-sm font-medium text-navy-600 hover:text-navy-900">How it works</a>
            <a href="#roles" className="text-sm font-medium text-navy-600 hover:text-navy-900">Roles</a>
            <a href="#security" className="text-sm font-medium text-navy-600 hover:text-navy-900">Security</a>
          </nav>
          <div className="flex items-center gap-2.5">
            <Link to="/login"><Button variant="ghost" size="sm">Sign in</Button></Link>
            <Link to="/register"><Button size="sm">Get started <ArrowRight className="h-4 w-4" /></Button></Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-0 grid-mask" />
        <div className="absolute inset-x-0 top-0 h-[520px] hero-glow" />
        <div className="container-page relative pt-16 pb-20 sm:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="animate-fade-up">
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50/80 px-3 py-1 text-xs font-semibold text-brand-700">
                <Sparkles className="h-3.5 w-3.5" /> Purpose-built for university FYP programmes
              </span>
            </div>
            <h1 className="mt-6 animate-fade-up animate-delay-100 font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-navy-900 sm:text-6xl">
              Run final year projects <span className="text-gradient">without the chaos</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl animate-fade-up animate-delay-200 text-lg leading-relaxed text-navy-500">
              One secure platform for proposals, teams, milestones, submissions, evaluations, and project health — connecting students, supervisors, and coordinators from kickoff to defense.
            </p>
            <div className="mt-8 flex animate-fade-up animate-delay-300 flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/register"><Button size="lg" className="w-full sm:w-auto">Start free <ArrowRight className="h-4 w-4" /></Button></Link>
              <Link to="/login"><Button variant="outline" size="lg" className="w-full sm:w-auto">Explore a demo account</Button></Link>
            </div>
            <p className="mt-4 animate-fade-up animate-delay-400 text-xs text-navy-400">
              No credit card required · Demo data included · Role-based access
            </p>
          </div>

          <div className="relative mx-auto mt-14 max-w-5xl animate-fade-up animate-delay-500">
            <div className="overflow-hidden rounded-3xl border border-navy-200/80 bg-white shadow-[0_40px_80px_-30px_rgba(15,23,42,0.35)]">
              <div className="flex items-center gap-2 border-b border-navy-100 bg-navy-50/70 px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                <span className="ml-3 rounded-md bg-white px-3 py-1 text-[11px] font-medium text-navy-400 ring-1 ring-navy-200">
                  app.fypmanager.edu / supervisor / dashboard
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-[190px_1fr]">
                <div className="hidden flex-col gap-1.5 bg-navy-950 p-3 sm:flex">
                  <div className="mb-2 flex items-center gap-2 px-1.5 py-1">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-indigo-600">
                      <BookOpen className="h-3.5 w-3.5 text-white" />
                    </span>
                    <span className="text-xs font-bold text-white">FYP Manager</span>
                  </div>
                  {[
                    { icon: LayoutDashboard, label: 'Dashboard', active: true },
                    { icon: PackageIcon, label: 'Projects' },
                    { icon: FileText, label: 'Reviews' },
                    { icon: Activity, label: 'Health' },
                    { icon: BarChart3, label: 'Reports' },
                  ].map((i) => (
                    <div key={i.label} className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] ${i.active ? 'bg-white/10 text-white' : 'text-navy-400'}`}>
                      <i.icon className="h-3.5 w-3.5" /> {i.label}
                    </div>
                  ))}
                </div>
                <div className="bg-navy-50/60 p-4 sm:p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-medium text-navy-400">Supervisor Console</p>
                      <p className="text-sm font-bold text-navy-900">Good morning, Dr. Smith</p>
                    </div>
                    <Badge variant="success"><CircleDot className="h-3 w-3" /> 4 projects</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    {[
                      { label: 'Assigned', value: '4', icon: Users, tone: 'text-brand-600 bg-brand-50' },
                      { label: 'Pending', value: '3', icon: Clock, tone: 'text-amber-600 bg-amber-50' },
                      { label: 'At risk', value: '1', icon: Activity, tone: 'text-red-600 bg-red-50' },
                    ].map((s) => (
                      <div key={s.label} className="rounded-xl border border-navy-200/70 bg-white p-3">
                        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${s.tone}`}><s.icon className="h-3.5 w-3.5" /></span>
                        <p className="mt-2 text-lg font-bold text-navy-900">{s.value}</p>
                        <p className="text-[10px] text-navy-400">{s.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 rounded-xl border border-navy-200/70 bg-white p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold text-navy-700">Project health overview</p>
                      <span className="text-[10px] text-navy-400">Last 6 months</span>
                    </div>
                    <div className="mt-3 flex items-end gap-1.5">
                      {[38, 52, 44, 66, 58, 74, 62, 80, 70, 88, 76, 92].map((h, i) => (
                        <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-brand-200 to-brand-500" style={{ height: `${h * 0.55}px` }} />
                      ))}
                    </div>
                  </div>
                  <div className="mt-3 space-y-1.5">
                    {[
                      { title: 'AI-Powered Chatbot', health: 'MEDIUM', pct: 62 },
                      { title: 'Smart Campus Dashboard', health: 'LOW', pct: 40 },
                    ].map((p) => (
                      <div key={p.title} className="flex items-center gap-2 rounded-lg border border-navy-200/70 bg-white px-2.5 py-2">
                        <span className={`h-1.5 w-1.5 rounded-full ${p.health === 'LOW' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                        <span className="flex-1 truncate text-[11px] font-medium text-navy-700">{p.title}</span>
                        <span className="text-[10px] text-navy-400">{p.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <div className="pointer-events-none absolute -bottom-6 left-1/2 h-24 w-3/4 -translate-x-1/2 rounded-full bg-brand-500/20 blur-3xl" />
          </div>
        </div>
      </section>

      <section className="border-y border-navy-100 bg-navy-50/50">
        <div className="container-page grid grid-cols-2 gap-6 py-8 sm:grid-cols-4">
          {[
            { value: '48+', label: 'Active projects' },
            { value: '96', label: 'Students onboard' },
            { value: '14', label: 'Supervisors' },
            { value: '6', label: 'Departments' },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p className="font-display text-2xl font-bold text-navy-900 sm:text-3xl">{s.value}</p>
              <p className="mt-1 text-xs font-medium text-navy-500 sm:text-sm">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="container-page py-20 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Everything in one place</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">
            From first proposal to final defense
          </h2>
          <p className="mt-4 text-navy-500">
            Replace scattered spreadsheets, email threads, and shared drives with a single structured workflow.
          </p>
        </div>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="group rounded-2xl border border-navy-200/80 bg-white p-6 shadow-soft transition-all hover:-translate-y-1 hover:shadow-lift">
              <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${f.tone}`}>
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-base font-semibold text-navy-900">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-navy-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="workflow" className="bg-navy-950 py-20 sm:py-28">
        <div className="container-page">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-400">A clear workflow</p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Everyone knows what happens next
            </h2>
            <p className="mt-4 text-navy-300">
              A guided lifecycle keeps students, supervisors, and coordinators aligned at every stage.
            </p>
          </div>
          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {steps.map((s) => (
              <div key={s.n} className="relative rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                <span className="font-display text-3xl font-extrabold text-brand-400/40">{s.n}</span>
                <h3 className="mt-3 text-base font-semibold text-white">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-navy-300">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="roles" className="container-page py-20 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Built for every role</p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">
            Purposeful experiences, not one-size-fits-all
          </h2>
        </div>
        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {roles.map((r) => (
            <div key={r.role} className="overflow-hidden rounded-2xl border border-navy-200/80 bg-white shadow-soft">
              <div className={`bg-gradient-to-br ${r.accent} p-6`}>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
                  <r.icon className="h-5 w-5 text-white" />
                </span>
                <h3 className="mt-4 text-lg font-bold text-white">{r.role}</h3>
              </div>
              <ul className="space-y-3 p-6">
                {r.points.map((p) => (
                  <li key={p} className="flex items-start gap-2.5 text-sm text-navy-600">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /> {p}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-navy-50/60 py-20 sm:py-28">
        <div className="container-page grid items-center gap-12 lg:grid-cols-2">
          <div>
            <Badge variant="danger"><Activity className="h-3.5 w-3.5" /> Flagship feature</Badge>
            <h2 className="mt-4 font-display text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">
              Project Health Monitor
            </h2>
            <p className="mt-4 text-navy-500">
              An explainable, rule-based engine reviews overdue milestones, missed deadlines, inactivity, and repeated revisions to surface projects that may need support — with the reasons and suggested next steps, never a black box.
            </p>
            <ul className="mt-6 space-y-3">
              {['Transparent scoring with visible reasons', 'Configurable thresholds and recalculated on change', 'Supports supervisors — never labels students'].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-sm font-medium text-navy-700">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" /> {t}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-3xl border border-navy-200/80 bg-white p-6 shadow-lift">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-navy-400">Overall project health</p>
                <p className="mt-1 font-display text-2xl font-bold text-navy-900">Needs attention</p>
              </div>
              <span className="flex h-14 w-14 flex-col items-center justify-center rounded-2xl bg-amber-50 ring-1 ring-amber-200">
                <span className="text-lg font-bold text-amber-600">48</span>
                <span className="text-[9px] font-semibold uppercase text-amber-500">Medium</span>
              </span>
            </div>
            <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-navy-100">
              <div className="h-full w-[48%] rounded-full bg-gradient-to-r from-amber-400 to-amber-500" />
            </div>
            <div className="mt-5 space-y-2.5">
              {[
                '1 overdue milestone',
                'No update in 16 days',
                '2 outstanding revision requests',
              ].map((r) => (
                <div key={r} className="flex items-center gap-2.5 rounded-lg bg-amber-50/60 px-3 py-2 text-xs font-medium text-amber-800">
                  <CircleDot className="h-3.5 w-3.5" /> {r}
                </div>
              ))}
            </div>
            <div className="mt-4 rounded-xl border border-navy-200 bg-navy-50/60 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-navy-400">Recommended next steps</p>
              <p className="mt-1.5 text-xs text-navy-600">Schedule a check-in with the supervisor and resubmit the corrected presentation.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="security" className="container-page py-20 sm:py-28">
        <div className="grid items-start gap-12 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">Security by design</p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-navy-900 sm:text-4xl">
              Academic records deserve real protection
            </h2>
            <p className="mt-4 text-navy-500">
              Authorization is enforced on the backend for every operation, not hidden behind frontend routes. Confidential submissions stay private, and administrative changes are always traceable.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: Lock, title: 'Hashed credentials', desc: 'Argon2id password hashing, no plaintext secrets.' },
              { icon: ShieldCheck, title: 'Resource-level auth', desc: 'Role and ownership checks on every request.' },
              { icon: Bell, title: 'Audit trail', desc: 'Workflow transitions and admin actions recorded.' },
              { icon: TrendingUp, title: 'Private files', desc: 'Scoped downloads, no public submission URLs.' },
            ].map((s) => (
              <div key={s.title} className="rounded-2xl border border-navy-200/80 bg-white p-5 shadow-soft">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-900 text-white">
                  <s.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-3 text-sm font-semibold text-navy-900">{s.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-navy-500">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page pb-24">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-700 via-indigo-700 to-navy-900 px-8 py-14 text-center shadow-glow sm:px-16">
          <div className="absolute inset-0 opacity-20 grid-mask" />
          <div className="relative">
            <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to bring order to your FYP programme?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-brand-100">
              Set up a session, invite your cohort, and manage everything from proposal to defense in one place.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/register"><Button size="lg" className="bg-white text-brand-700 hover:bg-brand-50">Create your account <ArrowRight className="h-4 w-4" /></Button></Link>
              <Link to="/login"><Button size="lg" variant="ghost" className="text-white hover:bg-white/10">Sign in to demo</Button></Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-navy-100 bg-white">
        <div className="container-page py-12">
          <div className="grid gap-10 md:grid-cols-4">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600">
                  <BookOpen className="h-5 w-5 text-white" />
                </span>
                <span className="font-display text-lg font-bold text-navy-900">FYP Manager</span>
              </div>
              <p className="mt-4 max-w-sm text-sm leading-relaxed text-navy-500">
                A centralized academic project management platform for universities — secure, structured, and transparent.
              </p>
            </div>
            <div>
              <p className="text-sm font-semibold text-navy-900">Product</p>
              <ul className="mt-3 space-y-2 text-sm text-navy-500">
                <li><a href="#features" className="hover:text-brand-600">Features</a></li>
                <li><a href="#workflow" className="hover:text-brand-600">Workflow</a></li>
                <li><a href="#roles" className="hover:text-brand-600">Roles</a></li>
                <li><a href="#security" className="hover:text-brand-600">Security</a></li>
              </ul>
            </div>
            <div>
              <p className="text-sm font-semibold text-navy-900">Get started</p>
              <ul className="mt-3 space-y-2 text-sm text-navy-500">
                <li><Link to="/login" className="hover:text-brand-600">Sign in</Link></li>
                <li><Link to="/register" className="hover:text-brand-600">Create account</Link></li>
                <li><Link to="/forgot-password" className="hover:text-brand-600">Reset password</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-navy-100 pt-6 sm:flex-row">
            <p className="text-xs text-navy-400">© {new Date().getFullYear()} FYP Manager. Demonstration project.</p>
            <p className="text-xs text-navy-400">Built with React, TypeScript, Express & PostgreSQL</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

function PackageIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="m7.5 4.27 9 5.15" /><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" />
    </svg>
  )
}
