/**
 * Barra de comandos tipo Spotlight.
 *
 * - Sin prefijo: busca en Google, en tus apps y en el resto de destinos web.
 * - Con prefijo ("yt ", "nota ", "rec "...): el prefijo se convierte en una
 *   etiqueta y solo queda el texto. Retroceso con el campo vacío la quita.
 * - Las filas las calcula el proceso principal; aquí solo se pintan y se
 *   indica cuál se eligió. El texto se pinta siempre con `textContent`.
 * - Con la etiqueta "IA" y la IA lista, la lista se cambia por la conversación.
 */
import { animate } from 'motion'
import { formatAccelerator } from '../../shared/accelerator'
import { t } from '../../shared/i18n'
import type { ChatProvider, ChatSnapshot, CommandMeta, ExecuteResponse, IconSpec, ResultView } from '../../shared/ipc'
import { animateCrisp } from '../shared/crisp'
import { localizeDocument } from '../shared/i18nDom'
import './bar.css'
import { createChatView } from './chat'

const ROW_HEIGHT = 52
const MAX_VISIBLE_ROWS = 6
const LIST_PADDING = 8
const DEFAULT_PLACEHOLDER = t('Busca, abre apps o pídeselo a la IA: yt, nota, rec, pomo, ia…', 'Search, open apps or ask the AI: yt, note, rec, pomo, ai…')
const AI_COMMAND = 'ai'
/** Comandos que, sin filas que enseñar, pasan a la conversación (y quién responde). */
const CHAT_COMMANDS: Record<string, ChatProvider> = { ai: 'local', claude: 'claude' }
const activeProvider = (): ChatProvider | null => (active ? (CHAT_COMMANDS[active.id] ?? null) : null)
/** La conversación de otro proveedor no se enseña: al escribir se empieza una nueva. */
function forActive(snapshot: ChatSnapshot): ChatSnapshot {
  const provider = activeProvider()
  return provider && snapshot.provider !== provider ? { provider, messages: [], streaming: false } : snapshot
}
/** Si una acción tarda más que esto, la fila muestra que está trabajando. */
const LOADING_DELAY_MS = 150

// Muelles de motion: `visualDuration` es lo que dura a la vista y `bounce` el rebote.
const SPRING_OPEN = { type: 'spring', visualDuration: 0.38, bounce: 0.28 } as const
const SPRING_UI = { type: 'spring', visualDuration: 0.28, bounce: 0.18 } as const
const SPRING_CLOSE = { type: 'spring', visualDuration: 0.16, bounce: 0 } as const

const api = window.mascota.bar
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const backdrop = el<HTMLDivElement>('backdrop')
const panel = el<HTMLDivElement>('panel')
const input = el<HTMLInputElement>('input')
const chip = el<HTMLSpanElement>('chip')
const wrap = el<HTMLDivElement>('results-wrap')
const list = el<HTMLUListElement>('results')
const highlight = el<HTMLDivElement>('highlight')
const message = el<HTMLParagraphElement>('message')
const shortcutHint = el<HTMLSpanElement>('shortcut-hint')
const secondaryHint = el<HTMLSpanElement>('secondary-hint')
const chatEl = el<HTMLDivElement>('chat')

let commands: CommandMeta[] = []
let active: CommandMeta | null = null
let items: ResultView[] = []
let selected = 0
let seq = 0
let shownSeq = -1
let busy = false
/** Vista de conversación (etiqueta IA con la IA lista). */
let chatMode = false
const chat = createChatView(
  chatEl,
  (index) => window.mascota.ai.copy(index),
  () => {
    if (chatMode) resize()
  }
)
const ai = window.mascota.ai
ai.onUpdate((snapshot) => chat.render(forActive(snapshot)))
ai.onDelta(({ index, delta }) => chat.appendDelta(index, delta))
/** Cambia con cada apertura: invalida cierres que ya estaban en curso. */
let session = 0

// --- Iconos ---------------------------------------------------------------------
const SVG_NS = 'http://www.w3.org/2000/svg'
function glyph(path: string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('aria-hidden', 'true')
  const p = document.createElementNS(SVG_NS, 'path')
  p.setAttribute('d', path)
  svg.append(p)
  return svg
}

function iconBox(icon: IconSpec): HTMLElement {
  const box = h('span', 'row-icon')
  if (icon.kind === 'image' && icon.src.startsWith('data:image/')) {
    box.classList.add('is-image')
    const img = document.createElement('img')
    img.src = icon.src
    img.alt = ''
    box.append(img)
  } else if (icon.kind === 'glyph') {
    box.style.setProperty('--row-color', icon.accent)
    box.append(glyph(icon.path))
  }
  return box
}

function h<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

// --- Consultas al proceso principal ----------------------------------------------
async function refreshResults(): Promise<void> {
  const mySeq = ++seq
  const res = await api.query({ seq: mySeq, commandId: active?.id ?? null, text: input.value })
  // Si mientras tanto se escribió algo más, esta respuesta ya no sirve.
  if (res.seq !== seq) return
  shownSeq = res.seq
  items = res.items
  selected = Math.min(selected, Math.max(0, items.length - 1))
  // Si la fila elegida es solo informativa, pasa a la primera que haga algo.
  if (items[selected]?.disabled) {
    const firstEnabled = items.findIndex((it) => !it.disabled)
    if (firstEnabled >= 0) selected = firstEnabled
  }
  const wasChat = chatMode
  chatMode = activeProvider() !== null && items.length === 0
  if (chatMode && !wasChat) {
    const snapshot = await ai.snapshot()
    if (snapshot) chat.render(forActive(snapshot))
  }
  render()
}

// --- Pintado ----------------------------------------------------------------------
function render(): void {
  panel.classList.toggle('is-chat', chatMode)
  list.hidden = chatMode
  chatEl.hidden = !chatMode
  if (chatMode) {
    secondaryHint.hidden = true
    resize()
    return
  }
  list.replaceChildren(
    highlight,
    ...items.map((item, i) => {
      const li = h('li', item.disabled ? 'row is-disabled' : 'row')
      li.setAttribute('role', 'option')
      li.id = `opt-${i}`
      const text = h('span', 'row-text')
      text.append(h('span', 'row-title', item.title))
      if (item.subtitle) text.append(h('span', 'row-subtitle', item.subtitle))
      li.append(iconBox(item.icon), text, h('kbd', 'row-kbd'))
      li.addEventListener('mousemove', (e) => {
        if (pointerMoved(e)) select(i)
      })
      li.addEventListener('click', () => {
        select(i)
        void execute(false)
      })
      return li
    })
  )
  updateSelection(false)
  resize()
}

/**
 * Chromium lanza `mousemove` sintéticos cuando la lista se repinta bajo un
 * cursor quieto; si les hiciéramos caso, la fila bajo el ratón "robaría" la
 * selección hecha con el teclado. Solo cuenta si el ratón se movió de verdad.
 */
let lastPointer = { x: Number.NaN, y: Number.NaN }
function pointerMoved(e: MouseEvent): boolean {
  if (e.screenX === lastPointer.x && e.screenY === lastPointer.y) return false
  const first = Number.isNaN(lastPointer.x)
  lastPointer = { x: e.screenX, y: e.screenY }
  return !first
}

function select(i: number): void {
  if (i === selected || i < 0 || i >= items.length) return
  selected = i
  updateSelection(true)
}

/** Mueve la pastilla de selección (con muelle), actualiza las teclas y las pistas. */
function updateSelection(animated: boolean): void {
  list.querySelectorAll<HTMLElement>('.row').forEach((row, i) => {
    row.setAttribute('aria-selected', String(i === selected))
    const kbd = row.querySelector('.row-kbd')
    if (kbd) kbd.textContent = i === selected && !items[i].disabled ? '↵' : (items[i].badge ?? '')
  })
  input.setAttribute('aria-activedescendant', items.length ? `opt-${selected}` : '')
  animate(highlight, { y: selected * ROW_HEIGHT, opacity: items.length ? 1 : 0 }, animated ? SPRING_UI : { duration: 0 })
  list.querySelector<HTMLElement>(`#opt-${selected}`)?.scrollIntoView({ block: 'nearest' })

  const secondary = items[selected]?.secondaryLabel
  secondaryHint.hidden = !secondary
  if (secondary) secondaryHint.lastChild!.textContent = ` ${secondary}`
}

/** Ajusta la altura de la lista con un muelle. */
function resize(): void {
  const rows = Math.min(items.length, MAX_VISIBLE_ROWS)
  const listHeight = chatMode ? chatEl.offsetHeight : rows ? rows * ROW_HEIGHT + LIST_PADDING * 2 : 0
  const height = listHeight + (message.textContent ? message.scrollHeight : 0)
  if (!chatMode) list.style.height = `${listHeight}px`
  wrap.classList.toggle('has-content', height > 0)
  animate(wrap, { height }, SPRING_UI)
}

function setMessage(text: string): void {
  message.textContent = text
  resize()
}

// --- Etiqueta de comando ----------------------------------------------------------
function activate(command: CommandMeta, rest: string): void {
  active = command
  chip.replaceChildren(glyph(command.iconPath), document.createTextNode(command.name))
  chip.style.setProperty('--chip-color', command.accent)
  chip.hidden = false
  input.value = rest
  input.placeholder = command.placeholder
  selected = 0
  animateCrisp(chip, { scale: [0.6, 1], opacity: [0, 1] }, { type: 'spring', visualDuration: 0.3, bounce: 0.4 })
  void refreshResults()
}

function deactivate(): void {
  active = null
  chip.hidden = true
  input.placeholder = DEFAULT_PLACEHOLDER
  selected = 0
  void refreshResults()
}

/** "yt gatos" -> etiqueta YouTube + "gatos" (solo con espacio tras el prefijo). */
function detectPrefix(): boolean {
  const match = /^(\S+)\s+([\s\S]*)$/.exec(input.value.trimStart())
  if (!match) return false
  const prefix = match[1].toLowerCase()
  const command = commands.find((c) => c.prefixes.includes(prefix))
  if (!command) return false
  activate(command, match[2])
  return true
}

// --- Acciones -----------------------------------------------------------------------
function shake(): void {
  animateCrisp(panel, { x: [0, -10, 9, -6, 4, 0] }, { duration: 0.4, ease: 'easeOut' })
}

async function execute(secondary: boolean): Promise<void> {
  if (busy) return
  if (!items[selected]) {
    setMessage(active ? t('Escribe algo primero', 'Type something first') : t('Escribe algo para buscar', 'Type something to search'))
    shake()
    api.reportError()
    return
  }
  if (secondary && !items[selected].secondaryLabel) return

  busy = true
  const row = list.querySelector<HTMLElement>(`#opt-${selected}`)
  const loading = window.setTimeout(() => row?.classList.add('is-loading'), LOADING_DELAY_MS)
  let res: ExecuteResponse
  try {
    res = await api.execute({ seq: shownSeq, index: selected, secondary })
  } finally {
    busy = false
    window.clearTimeout(loading)
    row?.classList.remove('is-loading')
  }
  handle(res)
}

function handle(res: ExecuteResponse): void {
  switch (res.kind) {
    case 'error':
      setMessage(res.message)
      shake()
      break
    case 'activate': {
      const command = commands.find((c) => c.id === res.commandId)
      if (command) activate(command, res.text ?? input.value)
      break
    }
    case 'refresh':
    case 'stale':
      void refreshResults()
      break
    case 'close':
      break // el proceso principal cierra la barra
  }
}

input.addEventListener('input', () => {
  if (message.textContent) message.textContent = ''
  if (!active && detectPrefix()) return
  selected = 0
  void refreshResults()
})

/** Teclas en la vista de conversación. Devuelve true si la tecla se gestionó. */
function chatKeydown(e: KeyboardEvent): boolean {
  const streaming = chat.snapshot().streaming
  if (e.key === 'Enter') {
    e.preventDefault()
    const text = input.value.trim()
    const provider = activeProvider()
    if (text && !streaming && provider) {
      ai.send(text, provider)
      input.value = ''
    }
    return true
  }
  if (e.key === 'Escape' && streaming) {
    e.preventDefault()
    ai.stop()
    return true
  }
  if ((e.key === 'n' || e.key === 'N') && e.ctrlKey) {
    e.preventDefault()
    ai.reset()
    return true
  }
  return false
}

input.addEventListener('keydown', (e) => {
  if (chatMode && chatKeydown(e)) return
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      select(Math.min(items.length - 1, selected + 1))
      break
    case 'ArrowUp':
      e.preventDefault()
      select(Math.max(0, selected - 1))
      break
    case 'PageDown':
      e.preventDefault()
      select(Math.min(items.length - 1, selected + MAX_VISIBLE_ROWS))
      break
    case 'PageUp':
      e.preventDefault()
      select(Math.max(0, selected - MAX_VISIBLE_ROWS))
      break
    case 'Enter':
      e.preventDefault()
      void execute(false)
      break
    case 'Delete':
      // Supr: acción secundaria (borrar nota, cancelar recordatorio...) si la fila la tiene.
      if (items[selected]?.secondaryLabel) {
        e.preventDefault()
        void execute(true)
      }
      break
    case 'Tab': {
      // Tab fija el comando de la fila elegida, conservando el texto.
      e.preventDefault()
      const command = commands.find((c) => c.id === items[selected]?.commandId)
      if (command && !active) activate(command, input.value)
      break
    }
    case 'Backspace':
      if (active && input.selectionStart === 0 && input.selectionEnd === 0) {
        e.preventDefault()
        deactivate()
      }
      break
    case 'Escape':
      e.preventDefault()
      api.requestClose()
      break
  }
})

// Clic en la zona transparente alrededor del panel: cerrar.
backdrop.addEventListener('mousedown', (e) => {
  if (e.target === backdrop) api.requestClose()
})

// El proceso principal pide pasar al chat (p. ej. "Resumir" desde el bocadillo).
api.onEnterChat((commandId) => {
  const command = commands.find((c) => c.id === (commandId in CHAT_COMMANDS ? commandId : AI_COMMAND))
  if (command && active?.id !== command.id) activate(command, '')
})

// --- Abrir y cerrar (los pide el proceso principal) -------------------------------
api.onOpen(() => {
  session++
  message.textContent = ''
  void api.getInfo().then((info) => {
    if (!info) return
    commands = info.commands
    shortcutHint.textContent = t(`${formatAccelerator(info.shortcut)} para abrir`, `${formatAccelerator(info.shortcut)} to open`)
  })
  void refreshResults() // los datos pueden haber cambiado (notas, pomodoro...)
  animateCrisp(panel, { opacity: [0, 1], scale: [0.94, 1], y: [-14, 0] }, { ...SPRING_OPEN, opacity: { duration: 0.16, ease: 'easeOut' } })
  input.focus()
  input.select()
})

api.onClose(() => {
  const mySession = session
  void animateCrisp(panel, { opacity: 0, scale: 0.97, y: -6 }, SPRING_CLOSE).finished.then(() => {
    // Si se volvió a abrir durante la animación, no ocultamos.
    if (mySession === session) api.hidden()
  })
})

localizeDocument()
input.placeholder = DEFAULT_PLACEHOLDER
void api.getInfo().then((info) => {
  if (info) commands = info.commands
})
