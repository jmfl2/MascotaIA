/**
 * Cliente mínimo de la API local de Ollama (https://github.com/ollama/ollama/blob/main/docs/api.md).
 *
 * - Solo habla con 127.0.0.1: la dirección no es configurable, así nada sale de tu PC.
 * - `fetch` se inyecta para poder probarlo sin Ollama.
 * - Todos los errores se convierten en `OllamaError` con un `code` y un mensaje
 *   en español pensado para enseñárselo al usuario.
 */
import { NdjsonSplitter } from './ndjson'

export const OLLAMA_URL = 'http://127.0.0.1:11434'

/**
 * Tamaño de contexto común a todas las peticiones. Si cambia entre una petición
 * y otra, Ollama recarga el modelo (segundos de espera), así que es fijo.
 */
export const CONTEXT_SIZE = 8192

export type OllamaErrorCode = 'unreachable' | 'timeout' | 'model-missing' | 'aborted' | 'bad-response'

const MESSAGES: Record<OllamaErrorCode, string> = {
  unreachable: 'Ollama no está en marcha',
  timeout: 'La IA tardó demasiado en responder',
  'model-missing': 'El modelo no está descargado',
  aborted: 'Cancelado',
  'bad-response': 'Respuesta inesperada de Ollama'
}

export class OllamaError extends Error {
  constructor(
    readonly code: OllamaErrorCode,
    detail?: string
  ) {
    super(detail ? `${MESSAGES[code]}: ${detail}` : MESSAGES[code])
  }
  get userMessage(): string {
    return MESSAGES[this.code]
  }
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatOptions {
  model: string
  messages: ChatMessage[]
  /** Esquema JSON para salida estructurada (o 'json'). */
  format?: Record<string, unknown> | 'json'
  /** Parámetros del modelo: temperature, num_ctx... */
  options?: Record<string, unknown>
  signal?: AbortSignal
  /** Tiempo máximo hasta recibir el primer dato (incluye cargar el modelo). */
  firstByteTimeoutMs?: number
  /** Cuánto tiempo mantiene Ollama el modelo en memoria después. */
  keepAlive?: string
}

export interface PullProgress {
  status: string
  completed?: number
  total?: number
}

type FetchFn = typeof fetch

export function createOllamaClient(fetchFn: FetchFn = fetch, baseUrl = OLLAMA_URL) {
  /** fetch con tiempo límite y cancelación externa, traduciendo los errores. */
  async function request(path: string, init: RequestInit & { timeoutMs: number; signal?: AbortSignal }): Promise<Response> {
    const controller = new AbortController()
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, init.timeoutMs)
    const onAbort = () => controller.abort()
    init.signal?.addEventListener('abort', onAbort, { once: true })
    try {
      const res = await fetchFn(`${baseUrl}${path}`, { ...init, signal: controller.signal })
      if (res.status === 404) {
        const body = await res.text().catch(() => '')
        throw new OllamaError('model-missing', body.slice(0, 200))
      }
      if (!res.ok) throw new OllamaError('bad-response', `HTTP ${res.status}`)
      return res
    } catch (err) {
      if (err instanceof OllamaError) throw err
      if (init.signal?.aborted) throw new OllamaError('aborted')
      if (timedOut) throw new OllamaError('timeout')
      throw new OllamaError('unreachable')
    } finally {
      clearTimeout(timer)
      init.signal?.removeEventListener('abort', onAbort)
    }
  }

  /** Lee un cuerpo NDJSON y llama a `onObject` con cada objeto. */
  async function readStream(res: Response, onObject: (obj: Record<string, unknown>) => void, signal?: AbortSignal) {
    if (!res.body) throw new OllamaError('bad-response', 'sin cuerpo')
    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    const splitter = new NdjsonSplitter()
    const handle = (objs: unknown[]) => {
      for (const o of objs) {
        if (!o || typeof o !== 'object') continue
        const obj = o as Record<string, unknown>
        if (typeof obj.error === 'string') {
          throw new OllamaError(/not found/i.test(obj.error) ? 'model-missing' : 'bad-response', obj.error.slice(0, 200))
        }
        onObject(obj)
      }
    }
    try {
      for (;;) {
        if (signal?.aborted) throw new OllamaError('aborted')
        const { done, value } = await reader.read()
        if (done) break
        handle(splitter.push(decoder.decode(value, { stream: true })))
      }
      handle(splitter.flush())
    } catch (err) {
      if (err instanceof OllamaError) throw err
      if (signal?.aborted) throw new OllamaError('aborted')
      throw new OllamaError('unreachable')
    } finally {
      reader.releaseLock()
    }
  }

  return {
    async version(timeoutMs = 1500): Promise<string> {
      const res = await request('/api/version', { method: 'GET', timeoutMs })
      const data = (await res.json()) as { version?: unknown }
      return typeof data.version === 'string' ? data.version : '?'
    },

    async listModels(timeoutMs = 3000): Promise<string[]> {
      const res = await request('/api/tags', { method: 'GET', timeoutMs })
      const data = (await res.json()) as { models?: Array<{ name?: unknown }> }
      return (data.models ?? []).map((m) => m.name).filter((n): n is string => typeof n === 'string')
    },

    /**
     * Chat en streaming. `onDelta` recibe cada trozo de texto; devuelve el texto completo.
     */
    async chat(opts: ChatOptions, onDelta: (delta: string) => void = () => {}): Promise<string> {
      const res = await request('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: opts.model,
          messages: opts.messages,
          stream: true,
          format: opts.format,
          options: { num_ctx: CONTEXT_SIZE, ...opts.options },
          keep_alive: opts.keepAlive ?? '10m'
        }),
        signal: opts.signal,
        timeoutMs: opts.firstByteTimeoutMs ?? 60_000
      })
      let full = ''
      await readStream(
        res,
        (obj) => {
          const message = obj.message as { content?: unknown } | undefined
          if (typeof message?.content === 'string' && message.content) {
            full += message.content
            onDelta(message.content)
          }
        },
        opts.signal
      )
      return full
    },

    /** Carga el modelo en memoria sin generar nada, para que la primera respuesta sea rápida. */
    async warmup(model: string, keepAlive = '10m'): Promise<void> {
      await request('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, keep_alive: keepAlive, options: { num_ctx: CONTEXT_SIZE } }),
        timeoutMs: 180_000
      })
    },

    /** Descarga un modelo informando del progreso. */
    async pull(model: string, onProgress: (p: PullProgress) => void, signal?: AbortSignal): Promise<void> {
      const res = await request('/api/pull', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, stream: true }),
        signal,
        timeoutMs: 30_000
      })
      await readStream(
        res,
        (obj) => {
          onProgress({
            status: typeof obj.status === 'string' ? obj.status : '',
            completed: typeof obj.completed === 'number' ? obj.completed : undefined,
            total: typeof obj.total === 'number' ? obj.total : undefined
          })
        },
        signal
      )
    }
  }
}

export type OllamaClient = ReturnType<typeof createOllamaClient>

/** Nombre de modelo válido para Ollama (p. ej. "gemma3:4b", "library/qwen2.5:7b"). */
export const MODEL_NAME = /^[A-Za-z0-9][\w.\-/]{0,80}(?::[\w.\-]{1,40})?$/
