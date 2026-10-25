import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'

export function useApiQuery<T = any>(key: unknown[], url: string, options: { enabled?: boolean; refetchInterval?: number } = {}) {
  return useQuery<T>({
    queryKey: key,
    queryFn: async () => (await api.get<T>(url)).data,
    ...options,
  })
}

export function useApiMutation<TVariables = any, TData = any>(
  fn: (variables: TVariables) => Promise<TData>,
  invalidate: unknown[][] = []
) {
  const queryClient = useQueryClient()
  return useMutation<TData, Error, TVariables>({
    mutationFn: fn,
    onSuccess: () => invalidate.forEach((key) => queryClient.invalidateQueries({ queryKey: key })),
  })
}
