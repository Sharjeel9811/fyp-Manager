import { useState } from 'react'
import { Mail, Building2, BadgeCheck, Bell, Check, Lock, Trash2, Camera } from 'lucide-react'
import { PageHeader, ErrorState, SkeletonPage, EmptyState } from '@/components/shared/Common'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Avatar } from '@/components/ui/Feedback'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { relativeTime, titleCase } from '@/lib/format'
import { useApiQuery, useApiMutation } from '@/hooks/useApi'
import { useAuth } from '@/context/AuthContext'
import api, { tokenStore } from '@/lib/api'

const textareaClass =
  'w-full rounded-xl border border-navy-200 bg-white px-3.5 py-2.5 text-sm text-navy-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-500/10'

function passwordStrength(value: string) {
  let score = 0
  if (value.length >= 6) score++
  if (value.length >= 10) score++
  if (/\d/.test(value) && /[a-zA-Z]/.test(value)) score++
  if (/[^a-zA-Z0-9]/.test(value)) score++
  return score
}

export function ProfilePage({ role }: { role: 'STUDENT' | 'SUPERVISOR' | 'ADMIN' }) {
  const { user, updateUser } = useAuth()
  const [message, setMessage] = useState('')
  const [pwMessage, setPwMessage] = useState('')
  const [newPassword, setNewPassword] = useState('')

  const saveProfile = useApiMutation((payload: any) => api.put('/auth/me', payload))
  const changePassword = useApiMutation((payload: any) => api.put('/auth/password', payload))
  const uploadAvatar = useApiMutation((dataUrl: string) => api.put('/auth/avatar', { dataUrl }))
  const removeAvatar = useApiMutation(() => api.delete('/auth/avatar'))
  const [avatarMessage, setAvatarMessage] = useState('')

  if (!user) return <SkeletonPage />

  /**
   * Resize whatever the user picked to a 256×256 square JPEG in the browser
   * (canvas keeps the centre crop), so the upload is always < 200 KB and the
   * backend never has to guard against multi-megabyte photo payloads.
   */
  const handleAvatarFile = async (file: File | undefined) => {
    setAvatarMessage('')
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setAvatarMessage('Please choose an image file')
      return
    }
    try {
      const bitmapUrl = URL.createObjectURL(file)
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image()
        el.onload = () => resolve(el)
        el.onerror = () => reject(new Error('Could not read the image'))
        el.src = bitmapUrl
      })
      const size = 256
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas is not available')
      // Centre-crop to square: scale the smaller edge, trim the longer.
      const scale = Math.max(size / img.width, size / img.height)
      const w = img.width * scale
      const h = img.height * scale
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h)
      URL.revokeObjectURL(bitmapUrl)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
      const res: any = await uploadAvatar.mutateAsync(dataUrl)
      if (res.data?.user) updateUser(res.data.user)
      setAvatarMessage(res.data?.message || 'Profile picture updated')
    } catch (err: any) {
      setAvatarMessage(err?.message || 'Could not upload the picture')
    }
  }

  const handleProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setMessage('')
    const form = new FormData(e.currentTarget)
    const payload: any = {
      firstName: form.get('firstName'),
      lastName: form.get('lastName'),
      phone: form.get('phone'),
    }
    if (role === 'STUDENT') payload.bio = form.get('bio')
    else if (role === 'SUPERVISOR') payload.researchInterests = form.get('bio')
    try {
      const res: any = await saveProfile.mutateAsync(payload)
      if (res.data?.user) updateUser(res.data.user)
      setMessage(res.data?.message || 'Profile updated')
    } catch (err: any) {
      setMessage(err.message)
    }
  }

  const handlePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setPwMessage('')
    const form = new FormData(e.currentTarget)
    const nextPassword = String(form.get('newPassword') || '')
    if (nextPassword !== String(form.get('confirm') || '')) {
      setPwMessage('Passwords do not match')
      return
    }
    try {
      const res: any = await changePassword.mutateAsync({ currentPassword: form.get('currentPassword'), newPassword: nextPassword })
      if (res.data?.token) tokenStore.set(res.data.token)
      if (res.data?.user) updateUser(res.data.user)
      setPwMessage(res.data?.message || 'Password updated')
      setNewPassword('')
      ;(e.target as HTMLFormElement).reset()
    } catch (err: any) {
      setPwMessage(err.message)
    }
  }

  return (
    <div>
      <PageHeader eyebrow="Account" title="My profile" description="Manage your personal and academic information." />
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="p-6">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <Avatar first={user.firstName} last={user.lastName} size="lg" src={user.avatar ?? undefined} />
              <label
                className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-brand-600 text-white ring-2 ring-white transition-colors hover:bg-brand-700"
                title="Upload a profile picture"
              >
                <Camera className="h-4 w-4" />
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg"
                  className="sr-only"
                  onChange={async (e) => {
                    await handleAvatarFile(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
              </label>
            </div>
            <h2 className="mt-3 text-lg font-semibold text-navy-900">{user.firstName} {user.lastName}</h2>
            <p className="text-sm text-navy-500">{user.studentId || user.employeeId || '—'}</p>
            <Badge variant="brand" className="mt-2">{titleCase(role)}</Badge>
            {avatarMessage && <p className="mt-2 text-xs font-medium text-brand-700">{avatarMessage}</p>}
            {user.avatar && (
              <button
                className="mt-2 inline-flex items-center gap-1 text-xs text-red-600 hover:underline"
                onClick={async () => {
                  try {
                    const res: any = await removeAvatar.mutateAsync()
                    if (res.data?.user) updateUser(res.data.user)
                    setAvatarMessage(res.data?.message || 'Profile picture removed')
                  } catch (err: any) {
                    setAvatarMessage(err.message)
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5" /> Remove picture
              </button>
            )}
            <div className="mt-5 w-full space-y-2.5 text-left text-sm">
              <div className="flex items-center gap-2 text-navy-600"><Mail className="h-4 w-4 text-navy-400" /> {user.email}</div>
              <div className="flex items-center gap-2 text-navy-600"><Building2 className="h-4 w-4 text-navy-400" /> {user.department || 'No department'}</div>
              <div className="flex items-center gap-2 text-navy-600">
                <BadgeCheck className={cn('h-4 w-4', user.emailVerified ? 'text-emerald-500' : 'text-navy-300')} />
                {user.emailVerified ? 'Email verified' : 'Email not verified'}
              </div>
            </div>
          </div>
        </Card>
        <div className="space-y-5 lg:col-span-2">
          <Card className="p-6">
            <h3 className="text-base font-semibold text-navy-900">Personal information</h3>
            <p className="mt-1 text-sm text-navy-500">Update your details. Changes are saved to your account.</p>
            <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={handleProfile}>
              <Input label="First name" name="firstName" defaultValue={user.firstName} required />
              <Input label="Last name" name="lastName" defaultValue={user.lastName} required />
              <Input label="Email" type="email" defaultValue={user.email} icon={<Mail className="h-4 w-4" />} disabled hint="Contact the FYP Office to change your email." />
              <Input label={role === 'STUDENT' ? 'Student ID' : role === 'SUPERVISOR' ? 'Employee ID' : 'Account ID'} defaultValue={user.studentId || user.employeeId || user.id} disabled />
              <Input label="Department" defaultValue={user.department || '—'} disabled />
              <Input label="Phone" name="phone" defaultValue={user.phone || ''} />
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-sm font-medium text-navy-700">
                  {role === 'SUPERVISOR' ? 'Research interests' : 'Bio'}
                </label>
                <textarea rows={4} name="bio" defaultValue={user.bio || ''} className={textareaClass} />
              </div>
              <div className="flex items-center gap-3 sm:col-span-2">
                <Button type="submit" loading={saveProfile.isPending}>Save changes</Button>
                {message && <span className="text-sm font-medium text-brand-700">{message}</span>}
              </div>
            </form>
          </Card>

          <Card className="p-6">
            <h3 className="flex items-center gap-2 text-base font-semibold text-navy-900"><Lock className="h-4 w-4 text-navy-400" /> Change password</h3>
            <p className="mt-1 text-sm text-navy-500">Updates take effect immediately. All other active sessions are signed out.</p>
            <form className="mt-4 grid gap-4 sm:grid-cols-3" onSubmit={handlePassword}>
              <Input label="Current password" type="password" name="currentPassword" required autoComplete="current-password" />
              <Input
                label="New password"
                type="password"
                name="newPassword"
                minLength={6}
                required
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
              <Input label="Confirm password" type="password" name="confirm" minLength={6} required autoComplete="new-password" />
              <div className="sm:col-span-3">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((step) => (
                    <span
                      key={step}
                      className={cn(
                        'h-1.5 flex-1 rounded-full transition-colors',
                        passwordStrength(newPassword) >= step
                          ? step <= 2 ? 'bg-amber-400' : 'bg-emerald-500'
                          : 'bg-navy-100'
                      )}
                    />
                  ))}
                </div>
                <p className="mt-1.5 text-xs text-navy-400">Use at least 8 characters with a number and a symbol for a stronger password.</p>
              </div>
              <div className="flex items-center gap-3 sm:col-span-3">
                <Button type="submit" variant="outline" loading={changePassword.isPending}>Update password</Button>
                {pwMessage && <span className="text-sm font-medium text-brand-700">{pwMessage}</span>}
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  )
}

export function NotificationsPage() {
  const { data, isLoading, error, refetch } = useApiQuery<any>(['notifications'], '/notifications', { refetchInterval: 15_000 })
  const markAll = useApiMutation(() => api.patch('/notifications/read-all'), [['notifications']])
  const markOne = useApiMutation((id: string) => api.patch(`/notifications/${id}/read`), [['notifications']])
  const remove = useApiMutation((id: string) => api.delete(`/notifications/${id}`), [['notifications']])

  if (isLoading) return <SkeletonPage />
  if (error) return <ErrorState message={(error as Error).message} onRetry={() => refetch()} />

  const items: any[] = data?.notifications ?? []
  const unread: number = data?.unread ?? 0

  return (
    <div>
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        description="Deadlines, feedback, approvals, and schedule changes."
        actions={
          <Button variant="outline" size="sm" loading={markAll.isPending} disabled={unread === 0} onClick={() => markAll.mutate()}>
            <Check className="h-4 w-4" /> Mark all read
          </Button>
        }
      />
      {items.length === 0 ? (
        <EmptyState icon={Bell} title="You're all caught up" description="New notifications will appear here." />
      ) : (
        <Card>
          <ul className="divide-y divide-navy-100">
            {items.map((n) => (
              <li key={n.id} className={cn('flex gap-4 p-4 transition-colors hover:bg-navy-50/60', n.unread && 'bg-brand-50/20')}>
                <button
                  onClick={() => n.unread && markOne.mutate(n.id)}
                  className={cn('mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', n.unread ? 'bg-brand-100 text-brand-600' : 'bg-navy-100 text-navy-400')}
                  aria-label={n.unread ? 'Mark as read' : 'Read'}
                >
                  <Bell className="h-4 w-4" />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-navy-900">{n.title}</p>
                    {n.unread && <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />}
                  </div>
                  <p className="mt-0.5 text-sm text-navy-500">{n.message}</p>
                  <p className="mt-1 text-xs text-navy-400">{relativeTime(n.time)}</p>
                </div>
                <button
                  onClick={() => remove.mutate(n.id)}
                  className="self-start rounded-lg p-2 text-navy-400 hover:bg-red-50 hover:text-red-600"
                  aria-label="Delete notification"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
