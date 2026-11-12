/**
 * Ventana de ajustes. Los cambios se aplican al momento: la vista previa se
 * actualiza aquí y el proceso principal (que valida todo) los guarda y se los
 * pasa al robot del escritorio.
 *
 * Tres pestañas: Apariencia, Personalidad y General. La vista previa del robot
 * queda siempre arriba para ver cada cambio.
 */
import { animate } from 'motion'
import {
  ACCESSORIES,
  ACCESSORY_THEMES,
  AI_TONES,
  CHATTINESS,
  COLOR_PRESETS,
  sanitizeName,
  skinById,
  SKINS,
  SLOT_NAMES,
  type AccessoryId,
  type AccessoryTheme,
  type Appearance,
  toggleAccessory,
  type SettingsView
} from '../../shared/appearance'
import { ASSISTANTS } from '../../shared/assistants'
import { LANGUAGES, t, tx, type Localized } from '../../shared/i18n'
import { applyAppearance } from '../robot/appearance'
import { createRobot } from '../robot/robot'
import { mountRobot } from '../robot/robotSvg'
import { animateCrisp } from '../shared/crisp'
import { localizeDocument } from '../shared/i18nDom'
import './settings.css'

const api = window.mascota.settings
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const SPRING = { type: 'spring', visualDuration: 0.32, bounce: 0.22 } as const
const TAB_KEY = 'settings-tab'

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

/** Control segmentado con una pastilla que se desliza con muelle. */
function segmented<T extends string>(root: HTMLElement, options: readonly { id: T; name: Localized }[], onPick: (id: T) => void) {
  const pill = h('span', 'segmented-pill')
  root.append(pill)
  const buttons = options.map((o) => {
    const b = h('button', 'segment', tx(o.name))
    b.type = 'button'
    b.setAttribute('role', root.getAttribute('role') === 'tablist' ? 'tab' : 'radio')
    b.addEventListener('click', () => onPick(o.id))
    root.append(b)
    return b
  })
  let first = true
  let current: T | null = null
  const set = (selected: T) => {
    current = selected
    const i = Math.max(0, options.findIndex((o) => o.id === selected))
    buttons.forEach((b, j) => b.setAttribute('aria-checked', String(i === j)))
    const target = buttons[i]
    // Oculto (pestaña sin mostrar): se coloca al enseñarlo.
    if (!target.offsetWidth) return
    animate(pill, { x: target.offsetLeft - 3, width: target.offsetWidth }, first ? { duration: 0 } : SPRING)
    first = false
  }
  // Al cambiar de tamaño (o al dejar de estar oculto), recolocar sin animar.
  new ResizeObserver(() => {
    if (current === null) return
    first = true
    set(current)
  }).observe(root)
  return set
}

// --- Pestañas ------------------------------------------------------------------------
type Tab = 'look' | 'personality' | 'general'
const TABS: readonly { id: Tab; name: Localized }[] = [
  { id: 'look', name: { es: 'Apariencia', en: 'Look' } },
  { id: 'personality', name: { es: 'Personalidad', en: 'Personality' } },
  { id: 'general', name: { es: 'General', en: 'General' } }
]
const scroll = el<HTMLElement>('scroll')
const panels = [...document.querySelectorAll<HTMLElement>('[data-panel]')]
const setTabPill = segmented(el('tabs'), TABS, (id) => showTab(id))

function showTab(id: Tab, animated = true): void {
  setTabPill(id)
  for (const panel of panels) {
    const visible = panel.dataset.panel === id
    if (visible === !panel.hidden) continue
    panel.hidden = !visible
    if (visible && animated) animateCrisp(panel, { opacity: [0, 1], y: [8, 0] }, { type: 'spring', visualDuration: 0.26, bounce: 0 })
  }
  scroll.scrollTop = 0
  try {
    localStorage.setItem(TAB_KEY, id)
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
}

function savedTab(): Tab {
  try {
    const saved = localStorage.getItem(TAB_KEY)
    if (TABS.some((tab) => tab.id === saved)) return saved as Tab
  } catch {
    /* sin almacenamiento */
  }
  return 'look'
}

// --- Cuerpo (skins) -----------------------------------------------------------------------
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

// --- Colores de ojos y accesorios -----------------------------------------------------------
/**
 * Fila de colores: "Auto" (el de la skin), los predefinidos y uno a mano con el
 * selector del sistema. Mientras se arrastra en el selector, la vista previa
 * cambia al momento y el guardado se agrupa.
 */
function colorRow(root: HTMLElement, key: 'eyeColor' | 'accessoryColor') {
  const auto = h('button', 'dot dot-auto')
  auto.type = 'button'
  auto.setAttribute('role', 'radio')
  auto.title = t('Automático: el de la skin', 'Automatic: the skin color')
  auto.append(h('span', 'dot-label', t('Auto', 'Auto')))
  auto.addEventListener('click', () => pick(null))
  root.append(auto)

  const presets = COLOR_PRESETS.map(({ color, name }) => {
    const b = h('button', 'dot')
    b.type = 'button'
    b.setAttribute('role', 'radio')
    b.title = tx(name)
    b.setAttribute('aria-label', tx(name))
    b.style.setProperty('--dot', color)
    b.addEventListener('click', () => pick(color))
    root.append(b)
    return { b, color }
  })

  const custom = h('label', 'dot dot-custom')
  custom.title = t('Elegir otro color', 'Pick another color')
  const input = h('input', 'dot-input')
  input.type = 'color'
  input.setAttribute('aria-label', t('Otro color', 'Other color'))
  custom.append(input)
  root.append(custom)

  let saveTimer: number | undefined
  input.addEventListener('input', () => {
    if (!view) return
    view = { ...view, appearance: { ...view.appearance, [key]: input.value.toLowerCase() } }
    render()
    window.clearTimeout(saveTimer)
    saveTimer = window.setTimeout(() => view && api.update({ appearance: view.appearance }), 150)
  })

  function pick(color: string | null): void {
    if (!view) return
    updateAppearance({ ...view.appearance, [key]: color })
    robot.setState('happy')
  }

  return (appearance: Appearance) => {
    const value = appearance[key]
    const isPreset = presets.some((p) => p.color === value)
    auto.setAttribute('aria-checked', String(value === null))
    for (const p of presets) p.b.setAttribute('aria-checked', String(p.color === value))
    custom.setAttribute('aria-checked', String(value !== null && !isPreset))
    custom.style.setProperty('--dot', value !== null && !isPreset ? value : 'transparent')
    // El "Auto" enseña el color que pondría la skin.
    const skin = skinById(appearance.skin).colors
    auto.style.setProperty('--dot', key === 'eyeColor' ? skin.eye : skin.accessory)
    if (value && document.activeElement !== input) input.value = value
  }
}
const renderEyeColors = colorRow(el('eye-colors'), 'eyeColor')
const renderAccColors = colorRow(el('acc-colors'), 'accessoryColor')

// --- Accesorios por tema -----------------------------------------------------------------
type ThemeFilter = AccessoryTheme | 'todos'
const THEME_FILTERS: readonly { id: ThemeFilter; name: Localized }[] = [{ id: 'todos', name: { es: 'Todos', en: 'All' } }, ...ACCESSORY_THEMES]
let themeFilter: ThemeFilter = 'todos'

const accessoriesEl = el<HTMLDivElement>('accessories')
const chips = ACCESSORIES.map((acc) => {
  const chip = h('button', 'chip')
  chip.type = 'button'
  chip.dataset.id = acc.id
  chip.dataset.theme = acc.theme
  chip.append(h('span', 'chip-name', tx(acc.name)), h('span', 'chip-slot', tx(SLOT_NAMES[acc.slot])))
  chip.addEventListener('click', () => {
    if (!view) return
    updateAppearance({ ...view.appearance, accessories: toggleAccessory(view.appearance.accessories, acc.id) })
    robot.setState('happy')
  })
  accessoriesEl.append(chip)
  return chip
})

const setThemePill = segmented(el('acc-themes'), THEME_FILTERS, (id) => {
  themeFilter = id
  setThemePill(id)
  filterChips()
})
function filterChips(): void {
  for (const chip of chips) chip.hidden = themeFilter !== 'todos' && chip.dataset.theme !== themeFilter
}

el<HTMLButtonElement>('clear-acc').addEventListener('click', () => {
  if (!view || !view.appearance.accessories.length) return
  updateAppearance({ ...view.appearance, accessories: [] })
})

/** Combinación al azar: una skin y entre 1 y 3 accesorios de zonas distintas. */
el<HTMLButtonElement>('surprise').addEventListener('click', () => {
  if (!view) return
  const pickOne = <T>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]
  let accessories: AccessoryId[] = []
  const wanted = 1 + Math.floor(Math.random() * 3)
  for (let i = 0; i < 12 && accessories.length < wanted; i++) {
    const acc = pickOne(ACCESSORIES)
    if (!accessories.includes(acc.id)) accessories = toggleAccessory(accessories, acc.id)
  }
  updateAppearance({ ...view.appearance, skin: pickOne(SKINS).id, accessories, eyeColor: null, accessoryColor: null })
  robot.setState('happy')
})

// --- Personalidad ------------------------------------------------------------------------
const chattinessHint = el<HTMLParagraphElement>('chattiness-hint')
const toneHint = el<HTMLParagraphElement>('tone-hint')
const setChattiness = segmented(el('chattiness'), CHATTINESS, (id) => updatePersonality({ chattiness: id }))
const setTone = segmented(el('tone'), AI_TONES, (id) => updatePersonality({ aiTone: id }))
// Al cambiar de idioma, el proceso principal recarga esta ventana con los textos nuevos.
const setLanguage = segmented(el('language'), LANGUAGES, (id) => {
  if (view && view.language !== id) api.update({ language: id })
})

const nameInput = el<HTMLInputElement>('name')
const heroName = el<HTMLParagraphElement>('hero-name')
const heroSub = el<HTMLParagraphElement>('hero-sub')
let nameTimer: number | undefined
nameInput.addEventListener('input', () => {
  heroName.textContent = sanitizeName(nameInput.value)
  window.clearTimeout(nameTimer)
  nameTimer = window.setTimeout(() => updatePersonality({ name: nameInput.value }), 400)
})

const setAskAi = segmented(el('ask-ai'), ASSISTANTS, (id) => {
  if (!view || view.askAi === id) return
  view = { ...view, askAi: id }
  render()
  api.update({ askAi: id })
})

// --- Actualizaciones --------------------------------------------------------------------
const updateAction = el<HTMLButtonElement>('update-action')
updateAction.addEventListener('click', () => {
  if (view?.update.state === 'ready') api.update({ installUpdate: true })
  else api.update({ checkUpdates: true })
})

function renderUpdate(): void {
  if (!view) return
  const u = view.update
  el<HTMLSpanElement>('version').textContent = `Mascota ${view.version}`
  const status = el<HTMLSpanElement>('update-status')
  status.textContent =
    u.state === 'dev'
      ? t('Versión de desarrollo: no se actualiza', 'Development build: no updates')
      : u.state === 'checking'
        ? t('Buscando…', 'Checking…')
        : u.state === 'up-to-date'
          ? t('Tienes la última versión', "You're up to date")
          : u.state === 'downloading'
            ? t(`Descargando la ${u.version}… ${Math.round(u.progress * 100)} %`, `Downloading ${u.version}… ${Math.round(u.progress * 100)} %`)
            : u.state === 'ready'
              ? t(`La ${u.version} está lista para instalar`, `${u.version} is ready to install`)
              : u.state === 'error'
                ? `${t('No se pudo comprobar', "Couldn't check")}: ${u.message}`
                : t('Se comprueba al poco de arrancar y cada 6 horas', 'Checked shortly after start and every 6 hours')
  updateAction.hidden = u.state === 'dev' || u.state === 'downloading' || u.state === 'checking'
  updateAction.textContent = u.state === 'ready' ? t('Reiniciar y actualizar', 'Restart and update') : t('Buscar ahora', 'Check now')
}

for (const key of ['dockTop', 'nowPlaying', 'linkGuard', 'clipboardEnabled', 'startWithWindows', 'autoUpdate'] as const) {
  el<HTMLInputElement>(key).addEventListener('change', (e) => api.update({ [key]: (e.target as HTMLInputElement).checked }))
}

// --- Clave de API de Claude ----------------------------------------------------------
const keyForm = el<HTMLFormElement>('key-form')
const keyInput = el<HTMLInputElement>('key-input')
keyForm.addEventListener('submit', (e) => {
  e.preventDefault()
  const key = keyInput.value.trim()
  if (!key) return
  api.update({ claudeApiKey: key })
  keyInput.value = '' // la clave no se queda en la página
})
el<HTMLButtonElement>('key-remove').addEventListener('click', () => api.update({ claudeApiKey: '' }))

function renderKey(): void {
  if (!view) return
  const status = el<HTMLSpanElement>('key-status')
  status.textContent =
    view.claudeKey === 'settings'
      ? t('✓ Guardada', '✓ Saved')
      : view.claudeKey === 'env'
        ? t('✓ De ANTHROPIC_API_KEY', '✓ From ANTHROPIC_API_KEY')
        : t('Sin clave', 'No key')
  status.classList.toggle('is-set', view.claudeKey !== null)
  el<HTMLButtonElement>('key-remove').hidden = view.claudeKey !== 'settings'
  keyInput.placeholder = view.claudeKey === 'settings' ? t('Pega otra para cambiarla', 'Paste another to replace it') : 'sk-ant-…'
  const error = el<HTMLParagraphElement>('key-error')
  error.hidden = !view.claudeKeyError
  error.textContent =
    view.claudeKeyError === 'invalid'
      ? t('Esa clave no tiene la forma de una de Anthropic (sk-ant-…).', "That doesn't look like an Anthropic key (sk-ant-…).")
      : view.claudeKeyError === 'no-encryption'
        ? t('Windows no deja cifrarla aquí: no se ha guardado.', "Windows can't encrypt it here: it wasn't saved.")
        : ''
}

// --- Cambios ---------------------------------------------------------------------------
function updateAppearance(appearance: Appearance): void {
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
  const { appearance, personality } = view
  applyAppearance(svg, appearance)
  skinsEl.querySelectorAll<HTMLElement>('.swatch').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.id === appearance.skin)))
  for (const chip of chips) chip.setAttribute('aria-pressed', String(appearance.accessories.includes(chip.dataset.id as AccessoryId)))
  renderEyeColors(appearance)
  renderAccColors(appearance)
  el<HTMLButtonElement>('clear-acc').disabled = !appearance.accessories.length

  if (document.activeElement !== nameInput) nameInput.value = personality.name
  heroName.textContent = personality.name
  const count = appearance.accessories.length
  heroSub.textContent = `${tx(skinById(appearance.skin).name)} · ${
    count === 0 ? t('sin accesorios', 'no accessories') : count === 1 ? t('1 accesorio', '1 accessory') : t(`${count} accesorios`, `${count} accessories`)
  }`

  setChattiness(personality.chattiness)
  const chattiness = CHATTINESS.find((c) => c.id === personality.chattiness)
  chattinessHint.textContent = chattiness ? tx(chattiness.hint) : ''
  setTone(personality.aiTone)
  const tone = AI_TONES.find((c) => c.id === personality.aiTone)
  toneHint.textContent = tone ? tx(tone.hint) : ''
  setLanguage(view.language)
  setAskAi(view.askAi)
  renderKey()
  renderUpdate()
  el<HTMLInputElement>('autoUpdate').checked = view.autoUpdate

  el<HTMLInputElement>('dockTop').checked = view.dockTop
  el<HTMLInputElement>('nowPlaying').checked = view.nowPlaying
  el<HTMLInputElement>('nowPlaying').disabled = !view.dockTop
  el<HTMLInputElement>('linkGuard').checked = view.linkGuard
  el<HTMLInputElement>('clipboardEnabled').checked = view.clipboardEnabled
  el<HTMLInputElement>('startWithWindows').checked = view.startWithWindows
}

// --- Abrir y cerrar ----------------------------------------------------------------------
const windowEl = el<HTMLDivElement>('window')
function close(): void {
  void animateCrisp(windowEl, { opacity: 0, scale: 0.97 }, { type: 'spring', visualDuration: 0.16, bounce: 0 }).finished.then(() => api.close())
}
el<HTMLButtonElement>('close').addEventListener('click', close)
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') close()
})

api.onChanged((next) => {
  view = next
  render()
})

showTab(savedTab(), false)
setThemePill(themeFilter)

void api.get().then((initial) => {
  if (!initial) return
  view = initial
  render()
  animateCrisp(windowEl, { opacity: [0, 1], scale: [0.96, 1], y: [10, 0] }, { type: 'spring', visualDuration: 0.38, bounce: 0.25 })
})
