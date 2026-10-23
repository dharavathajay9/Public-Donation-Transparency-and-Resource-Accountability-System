import { useCallback, useEffect, useState } from 'react'

export class ApiError extends Error {
  status: number
  code: string

  constructor(message: string, status: number, code: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  if (init?.body && !headers.has('content-type')) headers.set('content-type', 'application/json')

  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    ...init,
    headers,
  })

  if (!response.ok) {
    let message = 'Something went wrong. Please try again.'
    let code = 'ERROR'
    try {
      const payload = (await response.json()) as { error?: { message?: string; code?: string } }
      message = payload.error?.message ?? message
      code = payload.error?.code ?? code
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(message, response.status, code)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export const api = {
  get: <T,>(path: string, init?: RequestInit) => request<T>(path, init),
  post: <T,>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T,>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
}

export interface ApiState<T> {
  data: T | null
  error: string | null
  loading: boolean
  reload: () => void
}

export function useApi<T>(path: string | null): ApiState<T> {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(Boolean(path))
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    if (!path) {
      setData(null)
      setLoading(false)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    request<T>(path, { signal: controller.signal })
      .then((payload) => {
        setData(payload)
        setError(null)
      })
      .catch((cause: unknown) => {
        const name = (cause as { name?: string } | null)?.name
        if (name === 'AbortError') return
        setError(cause instanceof Error ? cause.message : 'Unable to load data.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [path, nonce])

  const reload = useCallback(() => setNonce((value) => value + 1), [])
  return { data, error, loading, reload }
}

export async function downloadCsv(type: string): Promise<void> {
  const response = await fetch(`/api/export?type=${encodeURIComponent(type)}`, {
    credentials: 'same-origin',
  })
  if (!response.ok) throw new Error('Export failed. Please try again.')
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `trustledger-${type}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
