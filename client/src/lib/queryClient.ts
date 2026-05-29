import { QueryClient } from '@tanstack/vue-query'

// Cliente de TanStack Query. Mas adelante se le puede agregar persistencia
// (@tanstack/query-persist-client) para soporte offline de lecturas.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 min
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
