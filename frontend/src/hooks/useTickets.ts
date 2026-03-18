import { useCallback, useState } from 'react'
import { api } from '@/lib/api'
import type { Ticket } from '@/types'

interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export function useTickets() {
  const [data, setData] = useState<Ticket[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await api.get<PaginatedResponse<Ticket>>('/tickets')
      setData(response.data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { data, isLoading, error, refresh }
}
