import type { ReactNode } from 'react'
import { QueryErrorResetBoundary } from '@tanstack/react-query'
import { ErrorBoundary } from 'react-error-boundary'
import { useMutationErrorToast } from '../lib/useMutationErrorToast'

export function QueryErrorReset({ children }: { children: ReactNode }) {
  return (
    <QueryErrorResetBoundary>
      {({ reset }) => (
        <ErrorBoundary
          onReset={reset}
          fallbackRender={({ error, resetErrorBoundary }) => (
            <div className="mx-auto max-w-md rounded-xl border border-red-200 bg-red-50 p-6 text-center">
              <p className="mb-3 text-sm text-red-700">{String((error as Error)?.message ?? error)}</p>
              <button onClick={resetErrorBoundary} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white">
                Thử lại
              </button>
            </div>
          )}
        >
          {children}
        </ErrorBoundary>
      )}
    </QueryErrorResetBoundary>
  )
}

export function MutationErrorToaster() {
  useMutationErrorToast()
  return null
}
