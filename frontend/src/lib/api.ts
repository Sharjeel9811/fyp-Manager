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
    const expiryRe = /expired|invalid token|inactive|authentication required/i
    const warmUpRe = /warming up/i
    const isSessionExpiry =
      status === 401 && !String(error?.config?.url || '').includes('/auth/login') && expiryRe.test(message)

    if (isSessionExpiry) {
      tokenStore.clear()
      return Promise.reject(new Error(message))
    }
    // Backend says it's warming: surface a clearly retryable error.
    if (status === 503 || warmUpRe.test(message)) {
      return Promise.reject(Object.assign(new Error('Service is warming up, retry in a moment'), { retryable: true }))
    }
    // Everything else (e.g. a 401 from a third-party call) keeps its real
    // message — only the token is left intact.
    return Promise.reject(new Error(message))
  }
)

export default api
