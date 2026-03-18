import { useCallback, useState } from 'react'
import { api } from '@/lib/api'
import type { Pesee, PaginatedResponse } from '@/types'

export interface PeseesParams {
  page?: number
  limit?: number
  dateDebut?: string
  dateFin?: string
  search?: string
  mouvement?: 'ENTREE' | 'SORTIE'
}

const DEFAULT_PAGINATION = { page: 1, limit: 20, total: 0, pages: 0 }
const DEFAULT_STATS = { entreesCount: 0, entreesKg: 0, sortiesCount: 0, sortiesKg: 0 }

export function usePesees() {
  const [data, setData] = useState<Pesee[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState(DEFAULT_PAGINATION)
  const [stats, setStats] = useState(DEFAULT_STATS)

  const refresh = useCallback(async (params?: PeseesParams) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await api.get<PaginatedResponse<Pesee>>('/pesees', { params })
      setData(response.data.data)
      setPagination(response.data.pagination)
      setStats(response.data.stats ?? DEFAULT_STATS)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { data, isLoading, error, pagination, stats, refresh }
}
