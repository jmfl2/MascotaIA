/**
 * Claude por la API de Anthropic (SDK oficial), para el chat de la barra.
 *
 * - Modelo: Claude Opus 5.5, con su pensamiento adaptativo (siempre activo en
 *   este modelo) y esfuerzo bajo: en un chat rápido responde antes y gasta menos.
 * - Respuesta en streaming: el texto aparece en la barra según llega.
 * - Si los filtros de seguridad rechazan la petición, la API la repite sola con
 *   el modelo de respaldo recomendado (`fallbacks: "default"`).
 */
import Anthropic from '@anthropic-ai/sdk'
import { t } from '../../shared/i18n'

export const CLAUDE_MODEL = 'claude-opus-5-5'

export type ClaudeResult = 'done' | 'refusal' | 'max_tokens'

/** Error con un mensaje ya listo para enseñar en la barra. */
export class ClaudeError extends Error {
  constructor(
    readonly userMessage: string,
    readonly aborted = false
  ) {
    super(userMessage)
  }
}

let client: Anthropic | null = null
let clientKey = ''

function clientFor(apiKey: string): Anthropic {
  if (!client || clientKey !== apiKey) {
    client = new Anthropic({ apiKey, maxRetries: 2 })
    clientKey = apiKey
  }
  return client
}

/** Traduce los errores del SDK (de más concreto a más general). */
function toUserError(err: unknown): ClaudeError {
  if (err instanceof Anthropic.APIUserAbortError) return new ClaudeError(t('Detenido.', 'Stopped.'), true)
  if (err instanceof Anthropic.AuthenticationError) {
    return new ClaudeError(t('La clave de API no es válida. Revísala en Ajustes → General.', 'The API key is not valid. Check it in Settings → General.'))
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return new ClaudeError(t('Tu clave no tiene permiso para usar este modelo.', "Your key isn't allowed to use this model."))
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new ClaudeError(t('Demasiadas peticiones o sin saldo en la API. Prueba en un momento.', 'Too many requests or no API credit. Try again shortly.'))
  }
  if (err instanceof Anthropic.BadRequestError) {
    return new ClaudeError(`${t('Claude rechazó la petición', 'Claude rejected the request')}: ${err.message}`.slice(0, 300))
  }
  if (err instanceof Anthropic.InternalServerError) {
    return new ClaudeError(t('Claude está saturado ahora mismo. Prueba en un momento.', 'Claude is overloaded right now. Try again shortly.'))
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new ClaudeError(t('No hay conexión con Anthropic. ¿Tienes internet?', "Can't reach Anthropic. Are you online?"))
  }
  if (err instanceof Anthropic.APIError) {
    return new ClaudeError(`${t('Error de la API', 'API error')} ${err.status ?? ''}`.trim())
  }
  return new ClaudeError(t('Claude falló', 'Claude failed'))
}

export interface ClaudeChatRequest {
  apiKey: string
  system: string
  messages: Anthropic.Beta.BetaMessageParam[]
  signal: AbortSignal
  onText(delta: string): void
}

/** Pide una respuesta en streaming. Lanza ClaudeError con el mensaje para el usuario. */
export async function streamClaude(req: ClaudeChatRequest): Promise<ClaudeResult> {
  try {
    const stream = clientFor(req.apiKey).beta.messages.stream(
      {
        model: CLAUDE_MODEL,
        max_tokens: 64000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: 'low' },
        // Caché automática: al seguir preguntando sobre lo mismo (p. ej. un PDF) no se paga entero cada vez.
        cache_control: { type: 'ephemeral' },
        system: req.system,
        messages: req.messages
      },
      { signal: req.signal }
    )
    stream.on('text', (delta) => req.onText(delta))
    const final = await stream.finalMessage()
    if (final.stop_reason === 'refusal') return 'refusal'
    if (final.stop_reason === 'max_tokens') return 'max_tokens'
    return 'done'
  } catch (err) {
    throw toUserError(err)
  }
}
