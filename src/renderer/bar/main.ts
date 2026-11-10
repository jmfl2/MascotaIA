/**
 * Barra de comandos tipo Spotlight.
 *
 * - Sin prefijo: busca en Google (y ofrece el resto de comandos debajo).
 * - Con prefijo ("yt ", "maps "...): el prefijo se convierte en una etiqueta
 *   y solo queda el texto a buscar. Retroceso con el campo vacío la quita.
 * - El renderer solo propone; el proceso principal valida y abre la URL.
 *
 * El texto del usuario se pinta siempre con `textContent`, nunca como HTML.
 */
import { animate } from 'motion'
import { COMMANDS, parseInput, sanitizeQuery, type CommandModule } from '../../commands'
import { formatAccelerator } from '../../shared/accelerator'
import './bar.css'

type Item = { kind: 'run'; command: CommandModule; query: string } | { kind: 'pick'; command: CommandModule }

const ROW_HEIGHT = 52
const DEFAULT_PLACEHOLDER = 'Busca en Google, o usa yt, maps, gh, trad…'

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

let active: CommandModule | null = null
let items: Item[] = []
let selected = 0
let running = false
/** Cambia con cada apertura: invalida cierres que ya estaban en curso. */
let session = 0

// --- Iconos (los trazados son estáticos y vienen del código, no del usuario) ---
const SVG_NS = 'http://www.w3.org/2000/svg'
function icon(command: CommandModule): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('aria-hidden', 'true')
  const path = document.createElementNS(SVG_NS, 'path')
  path.setAttribute('d', command.iconPath)
  svg.append(path)
  return svg
}

function h<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

// --- Modelo -------------------------------------------------------------------
function computeItems(): Item[] {
  const text = input.value
  if (active) {
    return sanitizeQuery(text) ? [{ kind: 'run', command: active, query: text }] : []
  }
  if (!sanitizeQuery(text)) return COMMANDS.map((command) => ({ kind: 'pick', command }))
  return COMMANDS.map((command) => ({ kind: 'run', command, query: text }))
}

function rowTitle(item: Item): string {
  if (item.kind === 'pick') return item.command.name
  return sanitizeQuery(item.query)
}

function rowSubtitle(item: Item): string {
  if (item.kind === 'pick') return item.command.hint
  return `${item.command.name} · ${item.command.hint}`
}

// --- Pintado ------------------------------------------------------------------
function render(): void {
  items = computeItems()
  selected = Math.min(selected, Math.max(0, items.length - 1))

  list.replaceChildren(
    ...items.map((item, i) => {
      const li = h('li', 'row')
      li.setAttribute('role', 'option')
      li.id = `opt-${i}`
      li.style.setProperty('--row-color', item.command.accent)

      const iconBox = h('span', 'row-icon')
      iconBox.append(icon(item.command))
      const text = h('span', 'row-text')
      text.append(h('span', 'row-title', rowTitle(item)), h('span', 'row-subtitle', rowSubtitle(item)))
      const kbd = h('kbd', 'row-kbd', i === selected ? '↵' : item.command.prefixes[0])

      li.append(iconBox, text, kbd)
      li.addEventListener('mousemove', () => select(i))
      li.addEventListener('click', () => {
        select(i)
        void execute()
      })
      return li
    })
  )
  updateSelection(false)
  resize()
}

function select(i: number): void {
  if (i === selected || i < 0 || i >= items.length) return
  selected = i
  updateSelection(true)
}

/** Mueve la pastilla de selección (con muelle) y actualiza la tecla ↵. */
function updateSelection(animated: boolean): void {
  list.querySelectorAll<HTMLElement>('.row').forEach((row, i) => {
    row.setAttribute('aria-selected', String(i === selected))
    const kbd = row.querySelector('.row-kbd')
    if (kbd) kbd.textContent = i === selected ? '↵' : items[i].command.prefixes[0]
  })
  input.setAttribute('aria-activedescendant', items.length ? `opt-${selected}` : '')
  const target = { y: selected * ROW_HEIGHT, opacity: items.length ? 1 : 0 }
  animate(highlight, target, animated ? SPRING_UI : { duration: 0 })
}

/** Ajusta la altura de la lista con un muelle. */
function resize(): void {
  const hasMessage = message.textContent !== ''
  const height = (items.length ? list.scrollHeight : 0) + (hasMessage ? message.scrollHeight : 0)
  wrap.classList.toggle('has-content', height > 0)
  animate(wrap, { height }, SPRING_UI)
}

function setMessage(text: string): void {
  message.textContent = text
  resize()
}

// --- Etiqueta de comando --------------------------------------------------------
function activate(command: CommandModule, rest: string): void {
  active = command
  chip.replaceChildren(icon(command), document.createTextNode(command.name))
  chip.style.setProperty('--chip-color', command.accent)
  chip.hidden = false
  input.value = rest
  input.placeholder = command.placeholder
  selected = 0
  animate(chip, { scale: [0.6, 1], opacity: [0, 1] }, { type: 'spring', visualDuration: 0.3, bounce: 0.4 })
  render()
}

function deactivate(): void {
  active = null
  chip.hidden = true
  input.placeholder = DEFAULT_PLACEHOLDER
  selected = 0
  render()
}

// --- Acciones -----------------------------------------------------------------
function shake(): void {
  animate(panel, { x: [0, -10, 9, -6, 4, 0] }, { duration: 0.4, ease: 'easeOut' })
}

async function execute(): Promise<void> {
  if (running) return
  const item = items[selected]

  if (!item) {
    setMessage('Escribe algo para buscar')
    shake()
    api.reportError()
    return
  }
  if (item.kind === 'pick') {
    activate(item.command, input.value)
    return
  }

  running = true
  try {
    const result = await api.run(item.command.id, item.query)
    if (!result.ok) {
      setMessage(result.error)
      shake()
    }
  } finally {
    running = false
  }
}

input.addEventListener('input', () => {
  if (message.textContent) message.textContent = ''
  if (!active) {
    const parsed = parseInput(input.value)
    if (parsed.command) {
      activate(parsed.command, parsed.query)
      return
    }
  }
  selected = 0
  render()
})

input.addEventListener('keydown', (e) => {
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      select(Math.min(items.length - 1, selected + 1))
      break
    case 'ArrowUp':
      e.preventDefault()
      select(Math.max(0, selected - 1))
      break
    case 'Enter':
      e.preventDefault()
      void execute()
      break
    case 'Tab': {
      // Tab fija el comando de la fila elegida, conservando el texto.
      e.preventDefault()
      const item = items[selected]
      if (item && !active) activate(item.command, input.value)
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

// --- Abrir y cerrar (los pide el proceso principal) -------------------------------
api.onOpen(() => {
  session++
  message.textContent = ''
  void api.getInfo().then((info) => {
    if (info) shortcutHint.textContent = `${formatAccelerator(info.shortcut)} para abrir`
  })
  render()
  animate(panel, { opacity: [0, 1], scale: [0.94, 1], y: [-14, 0] }, {
    ...SPRING_OPEN,
    opacity: { duration: 0.16, ease: 'easeOut' }
  })
  input.focus()
  input.select()
})

api.onClose(() => {
  const mySession = session
  void animate(panel, { opacity: 0, scale: 0.97, y: -6 }, SPRING_CLOSE).finished.then(() => {
    // Si se volvió a abrir durante la animación, no ocultamos.
    if (mySession === session) api.hidden()
  })
})

input.placeholder = DEFAULT_PLACEHOLDER
render()
