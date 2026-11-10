/**
 * Skins, accesorios y personalidad del robot. Única fuente de verdad: la usan
 * el robot, la ventana de ajustes y el proceso principal (para validar).
 */

export interface SkinColors {
  bodyTop: string
  bodyBottom: string
  bodyEdge: string
  screenTop: string
  screenBottom: string
  eye: string
  cheek: string
  /** Color principal de los accesorios (gorro, pajarita, cascos...). */
  accessory: string
  /** Color oscuro de los accesorios (diadema, montura). */
  accessoryDark: string
}

export interface Skin {
  id: string
  name: string
  colors: SkinColors
}

export const SKINS: readonly Skin[] = [
  {
    id: 'clasico',
    name: 'Clásico',
    colors: { bodyTop: '#ffffff', bodyBottom: '#d7dce6', bodyEdge: '#c3c9d6', screenTop: '#222839', screenBottom: '#0c0f18', eye: '#7ef0ff', cheek: '#ff8fb1', accessory: '#5b8cff', accessoryDark: '#2b2f3a' }
  },
  {
    id: 'medianoche',
    name: 'Medianoche',
    colors: { bodyTop: '#4a5578', bodyBottom: '#1f2640', bodyEdge: '#151a2e', screenTop: '#0d1020', screenBottom: '#05060c', eye: '#ff7ad9', cheek: '#ff9ec7', accessory: '#ffd166', accessoryDark: '#0b0e1a' }
  },
  {
    id: 'menta',
    name: 'Menta',
    colors: { bodyTop: '#f2fffa', bodyBottom: '#a7e8d0', bodyEdge: '#86d3b8', screenTop: '#1d3a34', screenBottom: '#0b1a17', eye: '#b6ffe0', cheek: '#ff9aa2', accessory: '#ff8a5c', accessoryDark: '#24463f' }
  },
  {
    id: 'coral',
    name: 'Coral',
    colors: { bodyTop: '#fff4ef', bodyBottom: '#ffb4a2', bodyEdge: '#f29a85', screenTop: '#3a1f2b', screenBottom: '#1a0c12', eye: '#ffe066', cheek: '#ff6b81', accessory: '#3aa7a3', accessoryDark: '#4a2531' }
  },
  {
    id: 'lavanda',
    name: 'Lavanda',
    colors: { bodyTop: '#fbf8ff', bodyBottom: '#cdbdf5', bodyEdge: '#b6a3ea', screenTop: '#2a2142', screenBottom: '#120d20', eye: '#a6f4ff', cheek: '#ff9ad5', accessory: '#7c5cff', accessoryDark: '#30264d' }
  },
  {
    id: 'grafito',
    name: 'Grafito',
    colors: { bodyTop: '#6b7280', bodyBottom: '#2f343d', bodyEdge: '#23272e', screenTop: '#111318', screenBottom: '#050607', eye: '#7dff9a', cheek: '#ff8f8f', accessory: '#f97316', accessoryDark: '#16181c' }
  }
]

/**
 * Accesorios. Cada uno ocupa una zona del robot y solo cabe uno por zona (una
 * corona y un gorro a la vez se pisarían): al ponerte uno, se quita el otro.
 * Los temáticos (videojuegos, anime, terror) son objetos genéricos que recuerdan
 * a esos mundos, sin logos ni diseños de ninguna obra concreta.
 */
export const ACCESSORIES = [
  { id: 'auriculares', name: 'Auriculares', slot: 'orejas' },
  { id: 'gorro', name: 'Gorro', slot: 'cabeza' },
  { id: 'gafas', name: 'Gafas', slot: 'cara' },
  { id: 'pajarita', name: 'Pajarita', slot: 'cuello' },
  { id: 'corona', name: 'Corona pixel', slot: 'cabeza' },
  { id: 'helice', name: 'Gorra de hélice', slot: 'cabeza' },
  { id: 'bandana', name: 'Bandana', slot: 'cabeza' },
  { id: 'gafas-pixel', name: 'Gafas pixel', slot: 'cara' },
  { id: 'vidas', name: 'Vidas', slot: 'encima' },
  { id: 'espada', name: 'Espada', slot: 'espalda' },
  { id: 'mando', name: 'Mando', slot: 'manos' },
  { id: 'sombrero-paja', name: 'Sombrero de paja', slot: 'cabeza' },
  { id: 'parche', name: 'Parche pirata', slot: 'cara' },
  { id: 'libreta', name: 'Libreta negra', slot: 'manos' },
  { id: 'manzana', name: 'Manzana', slot: 'manos' },
  { id: 'linterna', name: 'Linterna', slot: 'manos' },
  { id: 'vial', name: 'Vial', slot: 'manos' },
  { id: 'gancho', name: 'Gancho', slot: 'espalda' }
] as const
export type AccessoryId = (typeof ACCESSORIES)[number]['id']
export type AccessorySlot = (typeof ACCESSORIES)[number]['slot']

function slotOf(id: AccessoryId): AccessorySlot {
  return ACCESSORIES.find((a) => a.id === id)!.slot
}

/** Pone o quita un accesorio; al ponerlo, quita el que ocupara su misma zona. */
export function toggleAccessory(current: readonly AccessoryId[], id: AccessoryId): AccessoryId[] {
  if (current.includes(id)) return current.filter((a) => a !== id)
  return [...current.filter((a) => slotOf(a) !== slotOf(id)), id]
}

export const CHATTINESS = [
  { id: 'discreto', name: 'Discreto', hint: 'Solo avisos importantes: recordatorios, pomodoro y enlaces peligrosos' },
  { id: 'normal', name: 'Normal', hint: 'Además te ofrece ayuda cuando copias algo' },
  { id: 'hablador', name: 'Hablador', hint: 'Además saluda, te anima y te recuerda descansar' }
] as const
export type Chattiness = (typeof CHATTINESS)[number]['id']

export const AI_TONES = [
  { id: 'cercano', name: 'Cercano' },
  { id: 'formal', name: 'Formal' },
  { id: 'divertido', name: 'Divertido' }
] as const
export type AiTone = (typeof AI_TONES)[number]['id']

export interface Appearance {
  skin: string
  accessories: AccessoryId[]
}

export interface Personality {
  name: string
  chattiness: Chattiness
  aiTone: AiTone
}

export const DEFAULT_APPEARANCE: Appearance = { skin: 'clasico', accessories: [] }
export const DEFAULT_PERSONALITY: Personality = { name: 'Mascota', chattiness: 'normal', aiTone: 'cercano' }
export const MAX_NAME_LENGTH = 20

export function skinById(id: string): Skin {
  return SKINS.find((s) => s.id === id) ?? SKINS[0]
}

/** Nombre limpio: sin caracteres de control ni invisibles, recortado. */
export function sanitizeName(raw: unknown): string {
  if (typeof raw !== 'string') return DEFAULT_PERSONALITY.name
  const clean = [...raw.normalize('NFC').replace(/[\p{Cc}\p{Cf}]/gu, '').replace(/\s+/g, ' ').trim()]
    .slice(0, MAX_NAME_LENGTH)
    .join('')
    .trim()
  return clean || DEFAULT_PERSONALITY.name
}

/** Valida una apariencia que viene de fuera (config.json o la ventana de ajustes). */
export function validateAppearance(raw: unknown): Appearance {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const skin = typeof r.skin === 'string' && SKINS.some((s) => s.id === r.skin) ? r.skin : DEFAULT_APPEARANCE.skin
  const ids = new Set<string>(ACCESSORIES.map((a) => a.id))
  const valid = Array.isArray(r.accessories)
    ? r.accessories.filter((a): a is AccessoryId => typeof a === 'string' && ids.has(a))
    : []
  // Uno por zona: si hay varios (config editada a mano), gana el último.
  const accessories = valid.reduce<AccessoryId[]>((acc, id) => (acc.includes(id) ? acc : toggleAccessory(acc, id)), [])
  return { skin, accessories }
}

export function validatePersonality(raw: unknown): Personality {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const chattiness = CHATTINESS.find((c) => c.id === r.chattiness)?.id ?? DEFAULT_PERSONALITY.chattiness
  const aiTone = AI_TONES.find((t) => t.id === r.aiTone)?.id ?? DEFAULT_PERSONALITY.aiTone
  return { name: sanitizeName(r.name), chattiness, aiTone }
}

/** Variables CSS que pintan el robot con una skin. */
export function skinCssVars(skin: Skin): Record<string, string> {
  const c = skin.colors
  return {
    '--body-top': c.bodyTop,
    '--body-bottom': c.bodyBottom,
    '--body-edge': c.bodyEdge,
    '--screen-top': c.screenTop,
    '--screen-bottom': c.screenBottom,
    '--eye': c.eye,
    '--cheek': c.cheek,
    '--accessory': c.accessory,
    '--accessory-dark': c.accessoryDark
  }
}

// --- Ajustes (lo que ve y cambia la ventana de ajustes) ----------------------------

export interface SettingsView {
  appearance: Appearance
  personality: Personality
  clipboardEnabled: boolean
  linkGuard: boolean
  startWithWindows: boolean
  /** Modo pestaña: el robot se esconde en una pestaña arriba de la pantalla. */
  dockTop: boolean
}

export type SettingsPatch = Partial<SettingsView>
