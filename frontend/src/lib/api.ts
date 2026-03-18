import axios from 'axios'
import { AUTH_TOKEN_KEY } from '@/hooks/useAuth'

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000/api'

export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY)

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

// Redirection /login désactivée temporairement
api.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
)
