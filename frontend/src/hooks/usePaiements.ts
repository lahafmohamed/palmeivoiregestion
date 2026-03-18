import { useCallback, useState } from 'react'
import { api } from '@/lib/api'
import type { Paiement } from '@/types'

interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

export function usePaiements() {
  const [data, setData] = useState<Paiement[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await api.get<PaginatedResponse<Paiement>>('/paiements')
      setData(response.data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { data, isLoading, error, refresh }
}
