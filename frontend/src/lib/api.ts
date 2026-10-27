import axios from 'axios'

const TOKEN_KEY = 'fyp_token'

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = tokenStore.get()
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error?.response?.status
    const message = error?.response?.data?.message || error?.message || 'Request failed'

    // Only a genuine session-expiry 401 should wipe the stored token. A 401
    // thrown while the API is cold-starting must not log users out.
    const expiryRe = /expired|invalid|inactive|token.*invalid|authentication required/i
    const isSessionExpiry =
      status === 401 && !String(error?.config?.url || '').includes('/auth/login') && expiryRe.test(message)

    if (status === 401 && !isSessionExpiry) {
      // Cold-start race or token-transient failure — surface a retryable
      // error instead of killing the session.
      return Promise.reject(Object.assign(new Error('Service is warming up, retry in a moment'), { retryable: true }))
    }
    if (isSessionExpiry) {
      tokenStore.clear()
    }
    return Promise.reject(new Error(message))
  }
)

export default api
