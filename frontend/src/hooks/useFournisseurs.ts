import { useCallback, useState } from 'react'
import { api } from '@/lib/api'
import type { Fournisseur } from '@/types'

export function useFournisseurs() {
  const [data, setData] = useState<Fournisseur[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await api.get<Fournisseur[]>('/fournisseurs')
      setData(response.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de chargement')
    } finally {
      setIsLoading(false)
    }
  }, [])

  return { data, isLoading, error, refresh }
}
