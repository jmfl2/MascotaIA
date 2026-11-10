/**
 * Ventana de ajustes. Los cambios se aplican al momento: la vista previa se
 * actualiza aquí y el proceso principal (que valida todo) los guarda y se los
 * pasa al robot del escritorio.
 */
import { animate } from 'motion'
import {
  ACCESSORIES,
  AI_TONES,
  CHATTINESS,
  sanitizeName,
  SKINS,
  type AccessoryId,
  toggleAccessory,
  type SettingsView
} from '../../shared/appearance'
import { LANGUAGES, tx, type Localized } from '../../shared/i18n'
import { localizeDocument } from '../shared/i18nDom'
import { applyAppearance } from '../robot/appearance'
import { createRobot } from '../robot/robot'
import { mountRobot } from '../robot/robotSvg'
import './settings.css'

const api = window.mascota.settings
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const SPRING = { type: 'spring', visualDuration: 0.32, bounce: 0.22 } as const

let view: SettingsView | null = null

localizeDocument()

// --- Vista previa: el mismo robot del escritorio, que sigue al ratón ------------------
const preview = el<HTMLDivElement>('preview')
const svg = mountRobot(preview)
const robot = createRobot(svg, {
  dragStart: () => {},
  dragEnd: async () => ({ moved: false }), // un clic: se asoma
  click: () => robot.setState('happy'),
  dropFiles: () => {}
})
window.addEventListener('mousemove', (e) => {
  const r = preview.getBoundingClientRect()
  robot.setCursor({ dx: e.clientX - (r.left + r.width / 2), dy: e.clientY - (r.top + r.height * 0.51) })
})
preview.addEventListener('mouseenter', () => robot.setHover(true))
preview.addEventListener('mouseleave', () => robot.setHover(false))

function h<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text?: string) {
  const node = document.createElement(tag)
  node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

// --- Construcción de los controles ------------------------------------------------------
const skinsEl = el<HTMLDivElement>('skins')
for (const skin of SKINS) {
  const button = h('button', 'swatch')
  button.type = 'button'
  button.setAttribute('role', 'radio')
  button.dataset.id = skin.id
  const dot = h('span', 'swatch-dot')
  dot.style.background = `linear-gradient(180deg, ${skin.colors.bodyTop}, ${skin.colors.bodyBottom})`
  dot.style.setProperty('--dot-screen', skin.colors.screenBottom)
  dot.style.setProperty('--dot-eye', skin.colors.eye)
  button.append(dot, document.createTextNode(tx(skin.name)))
  button.addEventListener('click', () => {
    if (!view) return
    updateAppearance({ ...view.appearance, skin: skin.id })
    robot.setState('happy')
  })
  skinsEl.append(button)
}

const accessoriesEl = el<HTMLDivElement>('accessories')
for (const acc of ACCESSORIES) {
  const chip = h('button', 'chip', tx(acc.name))
  chip.type = 'button'
  chip.dataset.id = acc.id
  chip.addEventListener('click', () => {
    if (!view) return
    updateAppearance({ ...view.appearance, accessories: toggleAccessory(view.appearance.accessories, acc.id) })
    robot.setState('happy')
  })
  accessoriesEl.append(chip)
}

/** Control segmentado con una pastilla que se desliza con muelle. */
function segmented<T extends string>(root: HTMLElement, options: readonly { id: T; name: Localized }[], onPick: (id: T) => void) {
  const pill = h('span', 'segmented-pill')
  root.append(pill)
  const buttons = options.map((o) => {
    const b = h('button', 'segment', tx(o.name))
    b.type = 'button'
    b.setAttribute('role', 'radio')
    b.addEventListener('click', () => onPick(o.id))
    root.append(b)
    return b
  })
  let first = true
  return (selected: T) => {
    const i = Math.max(0, options.findIndex((o) => o.id === selected))
    buttons.forEach((b, j) => b.setAttribute('aria-checked', String(i === j)))
    const target = buttons[i]
    const props = { x: target.offsetLeft - 3, width: target.offsetWidth }
    animate(pill, props, first ? { duration: 0 } : SPRING)
    first = false
  }
}

const hint = el<HTMLParagraphElement>('chattiness-hint')
const setChattiness = segmented(el('chattiness'), CHATTINESS, (id) => updatePersonality({ chattiness: id }))
const setTone = segmented(el('tone'), AI_TONES, (id) => updatePersonality({ aiTone: id }))
// Al cambiar de idioma, el proceso principal recarga esta ventana con los textos nuevos.
const setLanguage = segmented(el('language'), LANGUAGES, (id) => {
  if (view && view.language !== id) api.update({ language: id })
})

const nameInput = el<HTMLInputElement>('name')
const heroName = el<HTMLParagraphElement>('hero-name')
let nameTimer: number | undefined
nameInput.addEventListener('input', () => {
  heroName.textContent = sanitizeName(nameInput.value)
  window.clearTimeout(nameTimer)
  nameTimer = window.setTimeout(() => updatePersonality({ name: nameInput.value }), 400)
})

for (const key of ['dockTop', 'linkGuard', 'clipboardEnabled', 'startWithWindows'] as const) {
  el<HTMLInputElement>(key).addEventListener('change', (e) => api.update({ [key]: (e.target as HTMLInputElement).checked }))
}

// --- Cambios ---------------------------------------------------------------------------
function updateAppearance(appearance: SettingsView['appearance']): void {
  if (!view) return
  view = { ...view, appearance }
  render()
  api.update({ appearance })
}

function updatePersonality(patch: Partial<SettingsView['personality']>): void {
  if (!view) return
  view = { ...view, personality: { ...view.personality, ...patch } }
  render()
  api.update({ personality: view.personality })
}

function render(): void {
  if (!view) return
  applyAppearance(svg, view.appearance)
  skinsEl.querySelectorAll<HTMLElement>('.swatch').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.id === view!.appearance.skin)))
  accessoriesEl
    .querySelectorAll<HTMLElement>('.chip')
    .forEach((c) => c.setAttribute('aria-pressed', String(view!.appearance.accessories.includes(c.dataset.id as AccessoryId))))

  if (document.activeElement !== nameInput) nameInput.value = view.personality.name
  heroName.textContent = view.personality.name
  setChattiness(view.personality.chattiness)
  const chattiness = CHATTINESS.find((c) => c.id === view!.personality.chattiness)
  hint.textContent = chattiness ? tx(chattiness.hint) : ''
  setTone(view.personality.aiTone)
  setLanguage(view.language)

  el<HTMLInputElement>('dockTop').checked = view.dockTop
  el<HTMLInputElement>('linkGuard').checked = view.linkGuard
  el<HTMLInputElement>('clipboardEnabled').checked = view.clipboardEnabled
  el<HTMLInputElement>('startWithWindows').checked = view.startWithWindows
}

// --- Abrir y cerrar ----------------------------------------------------------------------
const windowEl = el<HTMLDivElement>('window')
function close(): void {
  void animate(windowEl, { opacity: 0, scale: 0.97 }, { type: 'spring', visualDuration: 0.16, bounce: 0 }).finished.then(() => api.close())
}
el<HTMLButtonElement>('close').addEventListener('click', close)
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') close()
})

api.onChanged((next) => {
  view = next
  render()
})

void api.get().then((initial) => {
  if (!initial) return
  view = initial
  render()
  animate(windowEl, { opacity: [0, 1], scale: [0.96, 1], y: [10, 0] }, { type: 'spring', visualDuration: 0.38, bounce: 0.25 })
})
