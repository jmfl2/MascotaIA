/**
 * IA local: estado de Ollama, arranque, descarga del modelo e interpretación
 * de lenguaje natural. Todo es opcional: si Ollama no está, la app funciona
 * igual y las filas de la barra explican qué falta.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { delimiter, dirname, join } from 'node:path'
import type { AiStatus, Outcome } from '../../commands'
import { createOllamaClient, MODEL_NAME, OllamaError } from '../../ai/ollama'
import { interpretSystemPrompt, INTERPRET_SCHEMA, parseInterpretation } from '../../ai/prompts'
import { showBubble, toast, updateBubble } from '../bubbleWindow'
import { robotMood } from '../robotMood'
import { getConfig, setConfig } from '../store'

export const client = createOllamaClient()

let status: AiStatus = { state: 'checking', model: getConfig().aiModel, models: [] }
let refreshing: Promise<AiStatus> | null = null
const listeners = new Set<(s: AiStatus) => void>()

function setStatus(next: AiStatus): void {
  status = next
  for (const cb of listeners) cb(status)
}

export function onAiStatusChange(cb: (s: AiStatus) => void): void {
  listeners.add(cb)
}

export function aiStatus(): AiStatus {
  return status
}

/** Ruta de ollama.exe si está instalado (instalador oficial o en el PATH). */
function findOllamaExe(): string | null {
  const candidates = [
    join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Ollama', 'ollama.exe'),
    ...(process.env.PATH ?? '').split(delimiter).map((dir) => join(dir, 'ollama.exe'))
  ]
  return candidates.find((p) => p && existsSync(p)) ?? null
}

/** ¿Está descargado el modelo? ("gemma3" equivale a "gemma3:latest"). */
function hasModel(models: string[], model: string): boolean {
  const full = model.includes(':') ? model : `${model}:latest`
  return models.includes(full) || models.includes(model)
}

/** Vuelve a comprobar Ollama (sin bloquear a quien ya esté comprobando). */
export function refreshAiStatus(): Promise<AiStatus> {
  if (status.state === 'pulling') return Promise.resolve(status)
  refreshing ??= (async () => {
    const model = getConfig().aiModel
    try {
      await client.version(1200)
      const models = await client.listModels()
      setStatus({ state: hasModel(models, model) ? 'ready' : 'no-model', model, models })
    } catch {
      setStatus({ state: findOllamaExe() ? 'not-running' : 'not-installed', model, models: [] })
    }
    return status
  })().finally(() => {
    refreshing = null
  })
  return refreshing
}

/** Cambia el modelo (desde la bandeja). */
export function setAiModel(model: string): void {
  if (!MODEL_NAME.test(model)) return
  setConfig({ aiModel: model })
  void refreshAiStatus()
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Arranca el servidor de Ollama (`ollama serve`) en segundo plano y sin ventana.
 * No se usa "ollama app.exe" (la app de bandeja): lanzada desde aquí, su
 * servidor interno no llegaba a arrancar. El servidor es lo único que hace falta.
 */
export async function startOllama(): Promise<Outcome> {
  const exe = findOllamaExe()
  if (!exe) return { kind: 'error', message: 'Ollama no está instalado' }
  try {
    const child = spawn(exe, ['serve'], { cwd: dirname(exe), detached: true, stdio: 'ignore', windowsHide: true })
    child.on('error', (err) => console.warn('[ia] No se pudo arrancar Ollama:', err))
    child.unref()
  } catch {
    return { kind: 'error', message: 'No se pudo arrancar Ollama' }
  }
  for (let i = 0; i < 20; i++) {
    await wait(750)
    const s = await refreshAiStatus()
    if (s.state !== 'not-running') return { kind: 'refresh' }
  }
  return { kind: 'error', message: 'Ollama no responde. Prueba a abrirlo desde el menú Inicio.' }
}

/** Descarga el modelo elegido mostrando el progreso en el bocadillo. */
export async function pullModel(): Promise<Outcome> {
  if (status.state === 'pulling') return { kind: 'close', toast: 'Ya lo estoy descargando' }
  const model = getConfig().aiModel
  setStatus({ ...status, state: 'pulling', model, progress: 0 })
  const bubbleId = showBubble({ kind: 'info', title: `Descargando ${model}…`, text: 'Preparando', timeoutMs: null })

  let lastShown = -1
  void client
    .pull(model, (p) => {
      const progress = p.total ? (p.completed ?? 0) / p.total : status.progress ?? 0
      const percent = Math.floor(progress * 100)
      if (percent === lastShown) return
      lastShown = percent
      setStatus({ ...status, progress })
      const gb = p.total ? ` de ${(p.total / 1e9).toFixed(1)} GB` : ''
      if (bubbleId) updateBubble(bubbleId, { text: `${percent} %${gb}` })
    })
    .then(async () => {
      setStatus({ ...status, state: 'checking' })
      await refreshAiStatus()
      robotMood.flash('happy')
      toast(`✨ ${model} listo para usar`)
    })
    .catch(async (err) => {
      setStatus({ ...status, state: 'checking' })
      await refreshAiStatus()
      robotMood.flash('confused')
      toast(err instanceof OllamaError ? `No se pudo descargar: ${err.userMessage}` : 'No se pudo descargar el modelo')
    })
  return { kind: 'close' }
}

let warmedAt = 0
let warming = false
const WARM_EVERY_MS = 8 * 60_000

/**
 * Precalienta el modelo (lo carga en la GPU) si la IA está lista y no se ha
 * usado hace poco. Se llama al abrir la barra: así, cuando se pide algo, el
 * modelo ya está cargado. Ollama lo libera solo tras unos minutos sin uso.
 */
export function warmUpModel(): void {
  if (status.state !== 'ready' || warming || Date.now() - warmedAt < WARM_EVERY_MS) return
  warming = true
  void client
    .warmup(status.model)
    .then(() => {
      warmedAt = Date.now()
    })
    .catch(() => {})
    .finally(() => {
      warming = false
    })
}

/** Marca el modelo como "en uso" (las peticiones normales también lo mantienen cargado). */
export function markModelUsed(): void {
  warmedAt = Date.now()
}

/** Mensaje para el usuario cuando la IA no está disponible. */
export function unavailableMessage(s: AiStatus = status): string {
  switch (s.state) {
    case 'not-installed':
      return 'La IA local necesita Ollama (ollama.com)'
    case 'not-running':
      return 'Ollama está parado: arráncalo desde la barra («ia») o la bandeja'
    case 'no-model':
      return `Falta el modelo ${s.model}: descárgalo desde la barra («ia»)`
    case 'pulling':
      return 'Espera a que termine la descarga del modelo'
    default:
      return 'La IA no está disponible'
  }
}

/**
 * Lenguaje natural -> comando. La IA solo elige comando y texto; el resultado
 * se muestra en la barra como si lo hubieras escrito, y tú confirmas con Intro.
 */
export async function interpret(text: string): Promise<Outcome> {
  const s = await refreshAiStatus()
  if (s.state !== 'ready') return { kind: 'error', message: unavailableMessage(s) }

  robotMood.setThinking(true)
  try {
    const raw = await client.chat({
      model: s.model,
      messages: [
        { role: 'system', content: interpretSystemPrompt(new Date()) },
        { role: 'user', content: text.slice(0, 1000) }
      ],
      format: INTERPRET_SCHEMA,
      options: { temperature: 0 },
      // La primera vez el modelo tiene que cargarse en la GPU (puede tardar bastante).
      firstByteTimeoutMs: 120_000
    })
    markModelUsed()
    const result = parseInterpretation(raw)
    if (!result) return { kind: 'error', message: 'No supe interpretarlo. Prueba a decirlo de otra forma.' }
    if (result.command === 'none') return { kind: 'chat', task: 'chat', text }
    return { kind: 'activate', commandId: result.command, text: result.query }
  } catch (err) {
    return { kind: 'error', message: err instanceof OllamaError ? err.userMessage : 'La IA falló' }
  } finally {
    robotMood.setThinking(false)
  }
}
