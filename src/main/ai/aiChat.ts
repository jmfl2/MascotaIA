/**
 * Conversación con la IA (en memoria: no se guarda en disco).
 *
 * El proceso principal es la fuente de verdad: la barra recibe una foto de la
 * conversación (IPC.aiUpdate) y los trozos de texto según llegan (IPC.aiDelta).
 */
import { t } from '../../shared/i18n'
import type { AiTask } from '../../commands'
import { chatSystemPrompt, taskDisplay, taskPrompt } from '../../ai/prompts'
import { getClaudeKey } from '../claudeKey'
import { ClaudeError, streamClaude } from './claudeClient'
import { OllamaError, type ChatMessage } from '../../ai/ollama'
import { IPC, type ChatProvider, type ChatSnapshot } from '../../shared/ipc'
import { getBarWindow } from '../barWindow'
import { toast } from '../bubbleWindow'
import { robotMood } from '../robotMood'
import { clipboardWatcher } from '../services/clipboardWatcher'
import { getConfig } from '../store'
import { client, markModelUsed, refreshAiStatus, unavailableMessage } from './aiService'

interface Message {
  role: 'user' | 'assistant'
  /** Lo que se ve en la barra. */
  display: string
  /** Lo que se envía al modelo. */
  content: string
  error?: boolean
}

/** Mensajes que se envían al modelo como contexto. */
const MAX_HISTORY = 16
const MAX_INPUT = 20_000

let messages: Message[] = []
let controller: AbortController | null = null
/** Quién responde en esta conversación; al cambiar, se empieza otra. */
let provider: ChatProvider = 'local'

function send(channel: string, payload: unknown): void {
  const wc = getBarWindow()?.webContents
  if (wc && !wc.isDestroyed()) wc.send(channel, payload)
}

export function chatSnapshot(): ChatSnapshot {
  return {
    provider,
    messages: messages.map((m) => ({ role: m.role, text: m.display, error: m.error })),
    streaming: controller !== null
  }
}

function broadcast(): void {
  send(IPC.aiUpdate, chatSnapshot())
}

export async function sendToAi(task: AiTask, rawText: string, which: ChatProvider = 'local'): Promise<void> {
  const text = rawText.trim().slice(0, MAX_INPUT)
  if (!text) return
  stopAi()
  if (which !== provider) {
    provider = which
    messages = []
  }

  messages.push({ role: 'user', display: taskDisplay(task, text), content: taskPrompt(task, text) })
  const answer: Message = { role: 'assistant', display: '', content: '' }
  messages.push(answer)
  const index = messages.length - 1
  const myController = new AbortController()
  controller = myController
  broadcast()

  if (which === 'claude') {
    await answerWithClaude(answer, index, myController)
    return
  }

  const status = await refreshAiStatus()
  if (status.state !== 'ready') {
    answer.display = unavailableMessage(status)
    answer.error = true
    controller = null
    broadcast()
    robotMood.flash('confused')
    return
  }

  // Historial sin errores ni la respuesta vacía que estamos rellenando.
  const history: ChatMessage[] = messages
    .slice(0, -1)
    .filter((m) => !m.error)
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content }))

  robotMood.setThinking(true)
  try {
    await client.chat(
      {
        model: status.model,
        messages: [{ role: 'system', content: chatSystemPrompt(new Date(), getConfig().personality) }, ...history],
        options: { temperature: 0.6 },
        signal: myController.signal,
        firstByteTimeoutMs: 120_000
      },
      (delta) => {
        answer.content += delta
        answer.display = answer.content
        send(IPC.aiDelta, { index, delta })
      }
    )
    markModelUsed()
    robotMood.flash('happy')
  } catch (err) {
    if (err instanceof OllamaError && err.code === 'aborted') {
      answer.display = answer.content ? `${answer.content} …` : 'Detenido.'
    } else {
      answer.display = err instanceof OllamaError ? err.userMessage : t('La IA falló', 'The AI failed')
      answer.error = true
      robotMood.flash('confused')
    }
  } finally {
    if (controller === myController) controller = null
    robotMood.setThinking(false)
    broadcast()
  }
}

/** Historial para el modelo: sin errores ni la respuesta vacía que se está rellenando. */
function historyForModel(): Array<{ role: 'user' | 'assistant'; content: string }> {
  return messages
    .slice(0, -1)
    .filter((m) => !m.error && m.content)
    .slice(-MAX_HISTORY)
    .map((m) => ({ role: m.role, content: m.content }))
}

async function answerWithClaude(answer: Message, index: number, myController: AbortController): Promise<void> {
  const apiKey = getClaudeKey()
  if (!apiKey) {
    answer.display = t('Falta la clave de API de Anthropic: ponla en Ajustes → General.', 'The Anthropic API key is missing: add it in Settings → General.')
    answer.error = true
    controller = null
    broadcast()
    robotMood.flash('confused')
    return
  }
  robotMood.setThinking(true)
  try {
    const result = await streamClaude({
      apiKey,
      system: chatSystemPrompt(new Date(), getConfig().personality, 'claude'),
      messages: historyForModel(),
      signal: myController.signal,
      onText: (delta) => {
        answer.content += delta
        answer.display = answer.content
        send(IPC.aiDelta, { index, delta })
      }
    })
    if (result === 'refusal') {
      const note = t('Claude no puede ayudar con esto.', "Claude can't help with this.")
      answer.display = answer.content ? `${answer.content}\n\n_${note}_` : note
      answer.error = !answer.content
    } else if (result === 'max_tokens') {
      answer.display = `${answer.content} …`
    }
    robotMood.flash('happy')
  } catch (err) {
    const e = err instanceof ClaudeError ? err : new ClaudeError(t('Claude falló', 'Claude failed'))
    if (e.aborted) {
      answer.display = answer.content ? `${answer.content} …` : e.userMessage
    } else {
      answer.display = e.userMessage
      answer.error = true
      robotMood.flash('confused')
    }
  } finally {
    if (controller === myController) controller = null
    robotMood.setThinking(false)
    broadcast()
  }
}

export function stopAi(): void {
  controller?.abort()
  controller = null
}

export function resetChat(): void {
  stopAi()
  messages = []
  broadcast()
}

export function copyAnswer(index: number): void {
  const m = messages[index]
  if (m?.role !== 'assistant' || !m.content) return
  clipboardWatcher.copy(m.content)
  toast(t('Respuesta copiada', 'Answer copied'))
}
