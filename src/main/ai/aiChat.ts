/**
 * Conversación con la IA (en memoria: no se guarda en disco).
 *
 * El proceso principal es la fuente de verdad: la barra recibe una foto de la
 * conversación (IPC.aiUpdate) y los trozos de texto según llegan (IPC.aiDelta).
 */
import type { AiTask } from '../../commands'
import { chatSystemPrompt, taskDisplay, taskPrompt } from '../../ai/prompts'
import { OllamaError, type ChatMessage } from '../../ai/ollama'
import { IPC, type ChatSnapshot } from '../../shared/ipc'
import { getBarWindow } from '../barWindow'
import { toast } from '../bubbleWindow'
import { robotMood } from '../robotMood'
import { clipboardWatcher } from '../services/clipboardWatcher'
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

function send(channel: string, payload: unknown): void {
  const wc = getBarWindow()?.webContents
  if (wc && !wc.isDestroyed()) wc.send(channel, payload)
}

export function chatSnapshot(): ChatSnapshot {
  return {
    messages: messages.map((m) => ({ role: m.role, text: m.display, error: m.error })),
    streaming: controller !== null
  }
}

function broadcast(): void {
  send(IPC.aiUpdate, chatSnapshot())
}

export async function sendToAi(task: AiTask, rawText: string): Promise<void> {
  const text = rawText.trim().slice(0, MAX_INPUT)
  if (!text) return
  stopAi()

  messages.push({ role: 'user', display: taskDisplay(task, text), content: taskPrompt(task, text) })
  const answer: Message = { role: 'assistant', display: '', content: '' }
  messages.push(answer)
  const index = messages.length - 1
  const myController = new AbortController()
  controller = myController
  broadcast()

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
        messages: [{ role: 'system', content: chatSystemPrompt(new Date()) }, ...history],
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
      answer.display = err instanceof OllamaError ? err.userMessage : 'La IA falló'
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
  toast('Respuesta copiada')
}
