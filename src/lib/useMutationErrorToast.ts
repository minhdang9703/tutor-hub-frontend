import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { ApiClientError } from '../api/client'

export function showApiError(error: unknown) {
  if (error instanceof ApiClientError) {
    const detail = typeof error.details?.['message'] === 'string' ? `: ${error.details['message']}` : ''
    toast.error(`${error.message}${detail}`)
    return
  }
  if (error instanceof Error) toast.error(error.message)
}

export function useMutationErrorToast() {
  const queryClient = useQueryClient()

  useEffect(() => {
    const unsubscribe = queryClient.getMutationCache().subscribe((event) => {
      if (event?.type === 'updated') {
        const mutation = event.mutation
        const state = mutation.state
        if (state.status === 'error' && !state.isPaused && !errorShown.has(mutation)) {
          errorShown.add(mutation)
          showApiError(state.error)
        }
      }
      if (event?.type === 'removed') errorShown.delete(event.mutation)
    })
    return unsubscribe
  }, [queryClient])
}

const errorShown = new WeakSet<object>()
