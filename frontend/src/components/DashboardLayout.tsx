import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, FolderKanban, FileText, Users, ListChecks, UploadCloud,
  MessageSquare, Award, Bell, UserCircle, FileSearch, ClipboardCheck, Activity,
  CalendarDays, BarChart3, Building2, GraduationCap, ShieldCheck, ScrollText,
  Settings, LogOut, Menu, X, ChevronDown, BookOpen, HelpCircle, CheckCheck, Search, Radio,
  Copy,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth, type Role } from '@/context/AuthContext'
import { Avatar } from '@/components/ui/Feedback'
import { CommandPalette } from '@/components/CommandPalette'
import { PageTransition } from '@/components/motion/PageTransition'
import api from '@/lib/api'
import { relativeTime } from '@/lib/format'

type NavItem = { label: string; to: string; icon: typeof LayoutDashboard }
type NavGroup = { title: string; items: NavItem[] }

const navByRole: Record<Role, NavGroup[]> = {
  STUDENT: [
    { title: 'Overview', items: [{ label: 'Dashboard', to: '/student/dashboard', icon: LayoutDashboard }] },
    {
      title: 'My Project',
      items: [
        { label: 'Project Workspace', to: '/student/project', icon: FolderKanban },
        { label: 'Proposal', to: '/student/proposal', icon: FileText },
        { label: 'Team', to: '/student/team', icon: Users },
        { label: 'Milestones', to: '/student/milestones', icon: ListChecks },
        { label: 'Submissions', to: '/student/submissions', icon: UploadCloud },
      ],
    },
    {
      title: 'Insights',
      items: [
        { label: 'Feedback', to: '/student/feedback', icon: MessageSquare },
        { label: 'Evaluations', to: '/student/evaluations', icon: Award },
        { label: 'Live Defense', to: '/student/defense', icon: Radio },
        { label: 'Mock Defense', to: '/student/mock-defense', icon: GraduationCap },
        { label: 'Notifications', to: '/student/notifications', icon: Bell },
        { label: 'Profile', to: '/student/profile', icon: UserCircle },
      ],
    },
  ],
  SUPERVISOR: [
    { title: 'Overview', items: [{ label: 'Dashboard', to: '/supervisor/dashboard', icon: LayoutDashboard }] },
    {
      title: 'Supervision',
      items: [
        { label: 'Assigned Projects', to: '/supervisor/projects', icon: FolderKanban },
        { label: 'Proposal Reviews', to: '/supervisor/proposal-reviews', icon: FileSearch },
        { label: 'Submission Reviews', to: '/supervisor/submission-reviews', icon: ClipboardCheck },
        { label: 'Milestones', to: '/supervisor/milestones', icon: ListChecks },
        { label: 'Project Health', to: '/supervisor/health', icon: Activity },
      ],
    },
    {
      title: 'Evaluation',
      items: [
        { label: 'Schedule', to: '/supervisor/schedule', icon: CalendarDays },
        { label: 'Live Defense', to: '/supervisor/defense', icon: Radio },
        { label: 'Reports', to: '/supervisor/reports', icon: BarChart3 },
        { label: 'Profile', to: '/supervisor/profile', icon: UserCircle },
      ],
    },
  ],
  ADMIN: [
    { title: 'Overview', items: [{ label: 'Dashboard', to: '/admin/dashboard', icon: LayoutDashboard }] },
    {
      title: 'Management',
      items: [
        { label: 'Users', to: '/admin/users', icon: Users },
        { label: 'Departments', to: '/admin/departments', icon: Building2 },
        { label: 'Academic Sessions', to: '/admin/sessions', icon: GraduationCap },
        { label: 'Projects', to: '/admin/projects', icon: FolderKanban },
        { label: 'Proposals', to: '/admin/proposals', icon: FileText },
        { label: 'Supervisor Assignments', to: '/admin/assignments', icon: ShieldCheck },
        { label: 'Deadlines', to: '/admin/deadlines', icon: CalendarDays },
      ],
    },
    {
      title: 'Evaluation',
      items: [
        { label: 'Evaluations', to: '/admin/evaluations', icon: Award },
        { label: 'Live Defense', to: '/admin/defense', icon: Radio },
        { label: 'Similarity Check', to: '/admin/similarity', icon: Copy },
        { label: 'Reports', to: '/admin/reports', icon: BarChart3 },
      ],
    },
    {
      title: 'System',
      items: [
        { label: 'Audit Logs', to: '/admin/audit-logs', icon: ScrollText },
        { label: 'Settings', to: '/admin/settings', icon: Settings },
      ],
    },
  ],
}

const roleLabel: Record<Role, string> = {
  STUDENT: 'Student Workspace',
  SUPERVISOR: 'Supervisor Console',
  ADMIN: 'Administration',
}

interface NotificationItem {
  id: string
  title: string
  message: string
  unread: boolean
  time: string
}

export function DashboardLayout({ role }: { role: Role }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenu, setUserMenu] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, logout } = useAuth()
  const groups = navByRole[role]
  const commandItems = groups.flatMap((group) => group.items.map((item) => ({ ...item, group: group.title })))

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen((open) => !open)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => (await api.get('/notifications')).data,
    refetchInterval: 15_000,
  })
  const notifications: NotificationItem[] = data?.notifications ?? []
  const unread: number = data?.unread ?? 0

  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })
  const markAllRead = useMutation({
    mutationFn: () => api.patch('/notifications/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  })

  const allItems = groups.flatMap((g) => g.items)
  const current = allItems.find((i) => location.pathname.startsWith(i.to))

  const handleSignOut = async () => {
    await logout()
    queryClient.clear()
    navigate('/login', { replace: true })
  }

  const identifier = user?.studentId || user?.employeeId || ''

  const SidebarContent = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600 shadow-lg shadow-brand-500/30">
          <BookOpen className="h-5 w-5 text-white" />
        </span>
        <div className="leading-tight">
          <p className="font-display text-[15px] font-bold text-white">FYP Manager</p>
          <p className="text-[11px] font-medium text-navy-400">{roleLabel[role]}</p>
        </div>
      </div>

      <nav className="mt-2 flex-1 space-y-6 overflow-y-auto px-3 pb-4">
        {groups.map((group) => (
          <div key={group.title}>
            <p className="mb-1.5 px-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-navy-500">
              {group.title}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = location.pathname.startsWith(item.to)
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={() => setMobileOpen(false)}
                      className={cn(
                        'group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors',
                        active
                          ? 'bg-white/10 text-white'
                          : 'text-navy-300 hover:bg-white/5 hover:text-white',
                      )}
                    >
                      {active && (
                        <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-brand-400" />
                      )}
                      <item.icon className={cn('h-4 w-4 shrink-0', active ? 'text-brand-300' : 'text-navy-400 group-hover:text-navy-200')} />
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-2.5 rounded-xl bg-white/5 p-2.5">
          <Avatar first={user?.firstName ?? ''} last={user?.lastName ?? ''} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-white">{user?.firstName} {user?.lastName}</p>
            <p className="truncate text-[11px] text-navy-400">{identifier}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="rounded-lg p-1.5 text-navy-400 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-navy-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-navy-950 lg:flex">
        {SidebarContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-navy-950/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-navy-950 shadow-2xl animate-fade-in">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-4 z-10 rounded-lg p-2 text-navy-300 hover:bg-white/10 hover:text-white"
              aria-label="Close menu"
            >
              <X className="h-5 w-5" />
            </button>
            {SidebarContent}
          </aside>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-navy-200/70 bg-white/80 backdrop-blur-xl">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-navy-600 hover:bg-navy-100 lg:hidden"
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium text-navy-400">{roleLabel[role]}</p>
              <h2 className="truncate text-[15px] font-semibold text-navy-900">
                {current?.label ?? 'Dashboard'}
              </h2>
            </div>

            <button
              onClick={() => setPaletteOpen(true)}
              className="hidden items-center gap-2 rounded-xl border border-navy-200 bg-white px-3 py-2 text-xs font-medium text-navy-500 shadow-sm transition-colors hover:border-navy-300 hover:text-navy-800 sm:flex"
              aria-label="Open command palette"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Search</span>
              <kbd className="hidden rounded border border-navy-200 bg-navy-50 px-1.5 py-0.5 font-mono text-[10px] text-navy-400 md:inline">Ctrl K</kbd>
            </button>

            <div className="relative">
              <button
                onClick={() => { setNotifOpen((v) => !v); setUserMenu(false) }}
                className="relative rounded-xl p-2.5 text-navy-500 transition-colors hover:bg-navy-100 hover:text-navy-800"
                aria-label="Notifications"
                aria-expanded={notifOpen}
              >
                <Bell className="h-5 w-5" />
                {unread > 0 && (
                  <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>
              {notifOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setNotifOpen(false)} />
                  <div className="absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-2xl border border-navy-200 bg-white shadow-lift animate-fade-in">
                    <div className="flex items-center justify-between border-b border-navy-100 px-4 py-3">
                      <p className="text-sm font-semibold text-navy-900">Notifications</p>
                      {unread > 0 ? (
                        <button
                          onClick={() => markAllRead.mutate()}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-700"
                        >
                          <CheckCheck className="h-3.5 w-3.5" /> Mark all read
                        </button>
                      ) : (
                        <span className="text-[11px] font-medium text-navy-400">All caught up</span>
                      )}
                    </div>
                    <ul className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 && (
                        <li className="px-4 py-8 text-center text-xs text-navy-400">No notifications yet.</li>
                      )}
                      {notifications.slice(0, 6).map((n) => (
                        <li
                          key={n.id}
                          onClick={() => n.unread && markRead.mutate(n.id)}
                          className="flex cursor-pointer gap-3 border-b border-navy-50 px-4 py-3 hover:bg-navy-50/60"
                        >
                          <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.unread ? 'bg-brand-500' : 'bg-navy-300')} />
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-navy-900">{n.title}</p>
                            <p className="mt-0.5 line-clamp-2 text-xs text-navy-500">{n.message}</p>
                            <p className="mt-1 text-[11px] text-navy-400">{relativeTime(n.time)}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div className="p-2">
                      <Link
                        to={`/${role.toLowerCase()}/notifications`}
                        onClick={() => setNotifOpen(false)}
                        className="block rounded-lg px-3 py-2 text-center text-sm font-semibold text-brand-600 hover:bg-brand-50"
                      >
                        View all notifications
                      </Link>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => { setUserMenu((v) => !v); setNotifOpen(false) }}
                className="flex items-center gap-2 rounded-xl p-1 pr-2 transition-colors hover:bg-navy-100"
                aria-label="Account menu"
                aria-expanded={userMenu}
              >
                <Avatar first={user?.firstName ?? ''} last={user?.lastName ?? ''} size="sm" />
                <ChevronDown className="hidden h-4 w-4 text-navy-500 sm:block" />
              </button>
              {userMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setUserMenu(false)} />
                  <div className="absolute right-0 z-40 mt-2 w-60 overflow-hidden rounded-2xl border border-navy-200 bg-white shadow-lift animate-fade-in">
                    <div className="border-b border-navy-100 px-4 py-3">
                      <p className="text-sm font-semibold text-navy-900">{user?.firstName} {user?.lastName}</p>
                      <p className="truncate text-xs text-navy-500">{user?.email}</p>
                    </div>
                    <div className="p-1.5">
                      <Link to={`/${role.toLowerCase()}/profile`} onClick={() => setUserMenu(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-navy-700 hover:bg-navy-100">
                        <UserCircle className="h-4 w-4 text-navy-400" /> My profile
                      </Link>
                      <Link to={`/${role.toLowerCase()}/notifications`} onClick={() => setUserMenu(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-navy-700 hover:bg-navy-100">
                        <Bell className="h-4 w-4 text-navy-400" /> Notifications
                      </Link>
                      <div className="my-1 h-px bg-navy-100" />
                      <button onClick={handleSignOut} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                        <LogOut className="h-4 w-4" /> Sign out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
          <AnimatePresence mode="wait" initial={false}>
            <PageTransition key={location.pathname}>
              <Outlet />
            </PageTransition>
          </AnimatePresence>
        </main>
      </div>

      <button
        onClick={() => navigate(`/${role.toLowerCase()}/notifications`)}
        className="fixed bottom-5 right-5 z-20 hidden items-center gap-2 rounded-full bg-navy-900 px-4 py-2.5 text-sm font-medium text-white shadow-lift transition-transform hover:scale-105 lg:flex"
      >
        <HelpCircle className="h-4 w-4" /> Help &amp; Support
      </button>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} items={commandItems} />
    </div>
  )
}
