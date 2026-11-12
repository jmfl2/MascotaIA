/**
 * Skins, accesorios y personalidad del robot. Única fuente de verdad: la usan
 * el robot, la ventana de ajustes y el proceso principal (para validar).
 */
import type { Assistant } from './assistants'
import type { Lang, Text } from './i18n'

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
  name: Text
  colors: SkinColors
}

export const SKINS: readonly Skin[] = [
  {
    id: 'clasico',
    name: { es: 'Clásico', en: 'Classic' },
    colors: { bodyTop: '#ffffff', bodyBottom: '#d7dce6', bodyEdge: '#c3c9d6', screenTop: '#222839', screenBottom: '#0c0f18', eye: '#7ef0ff', cheek: '#ff8fb1', accessory: '#5b8cff', accessoryDark: '#2b2f3a' }
  },
  {
    id: 'medianoche',
    name: { es: 'Medianoche', en: 'Midnight' },
    colors: { bodyTop: '#4a5578', bodyBottom: '#1f2640', bodyEdge: '#151a2e', screenTop: '#0d1020', screenBottom: '#05060c', eye: '#ff7ad9', cheek: '#ff9ec7', accessory: '#ffd166', accessoryDark: '#0b0e1a' }
  },
  {
    id: 'menta',
    name: { es: 'Menta', en: 'Mint' },
    colors: { bodyTop: '#f2fffa', bodyBottom: '#a7e8d0', bodyEdge: '#86d3b8', screenTop: '#1d3a34', screenBottom: '#0b1a17', eye: '#b6ffe0', cheek: '#ff9aa2', accessory: '#ff8a5c', accessoryDark: '#24463f' }
  },
  {
    id: 'coral',
    name: { es: 'Coral', en: 'Coral' },
    colors: { bodyTop: '#fff4ef', bodyBottom: '#ffb4a2', bodyEdge: '#f29a85', screenTop: '#3a1f2b', screenBottom: '#1a0c12', eye: '#ffe066', cheek: '#ff6b81', accessory: '#3aa7a3', accessoryDark: '#4a2531' }
  },
  {
    id: 'lavanda',
    name: { es: 'Lavanda', en: 'Lavender' },
    colors: { bodyTop: '#fbf8ff', bodyBottom: '#cdbdf5', bodyEdge: '#b6a3ea', screenTop: '#2a2142', screenBottom: '#120d20', eye: '#a6f4ff', cheek: '#ff9ad5', accessory: '#7c5cff', accessoryDark: '#30264d' }
  },
  {
    id: 'zombi',
    name: { es: 'Zombi', en: 'Zombie' },
    colors: { bodyTop: '#bcc6a9', bodyBottom: '#7e8b6b', bodyEdge: '#6a7659', screenTop: '#262b21', screenBottom: '#0f120c', eye: '#ff3b30', cheek: '#9fb07a', accessory: '#7a2e2a', accessoryDark: '#22261c' }
  },
  {
    id: 'laboratorio',
    name: { es: 'Laboratorio', en: 'Lab' },
    colors: { bodyTop: '#ffffff', bodyBottom: '#e2e6ea', bodyEdge: '#cdd3d9', screenTop: '#13201a', screenBottom: '#060c09', eye: '#7dff6a', cheek: '#ffb3b3', accessory: '#f5c518', accessoryDark: '#1f2326' }
  },
  {
    id: 'grafito',
    name: { es: 'Grafito', en: 'Graphite' },
    colors: { bodyTop: '#6b7280', bodyBottom: '#2f343d', bodyEdge: '#23272e', screenTop: '#111318', screenBottom: '#050607', eye: '#7dff9a', cheek: '#ff8f8f', accessory: '#f97316', accessoryDark: '#16181c' }
  }
]

/** Temas para agrupar los accesorios en los ajustes. */
export const ACCESSORY_THEMES = [
  { id: 'basico', name: { es: 'Básicos', en: 'Basics' } },
  { id: 'juegos', name: { es: 'Videojuegos', en: 'Games' } },
  { id: 'anime', name: { es: 'Anime', en: 'Anime' } },
  { id: 'terror', name: { es: 'Terror', en: 'Horror' } }
] as const
export type AccessoryTheme = (typeof ACCESSORY_THEMES)[number]['id']

/** Nombre de cada zona del robot (para explicar por qué un accesorio quita otro). */
export const SLOT_NAMES: Record<string, Text> = {
  orejas: { es: 'Orejas', en: 'Ears' },
  cabeza: { es: 'Cabeza', en: 'Head' },
  cara: { es: 'Cara', en: 'Face' },
  cuello: { es: 'Cuello', en: 'Neck' },
  encima: { es: 'Encima', en: 'Above' },
  espalda: { es: 'Espalda', en: 'Back' },
  manos: { es: 'Mano', en: 'Hand' },
  cuerpo: { es: 'Cuerpo', en: 'Body' }
}

/**
 * Accesorios. Cada uno ocupa una zona del robot y solo cabe uno por zona (una
 * corona y un gorro a la vez se pisarían): al ponerte uno, se quita el otro.
 * Los temáticos (videojuegos, anime, terror) son objetos genéricos que recuerdan
 * a esos mundos, sin logos ni diseños de ninguna obra concreta.
 */
export const ACCESSORIES = [
  { id: 'auriculares', name: { es: 'Auriculares', en: 'Headphones' }, slot: 'orejas', theme: 'basico' },
  { id: 'gorro', name: { es: 'Gorro', en: 'Beanie' }, slot: 'cabeza', theme: 'basico' },
  { id: 'gafas', name: { es: 'Gafas', en: 'Glasses' }, slot: 'cara', theme: 'basico' },
  { id: 'pajarita', name: { es: 'Pajarita', en: 'Bow tie' }, slot: 'cuello', theme: 'basico' },
  { id: 'corona', name: { es: 'Corona pixel', en: 'Pixel crown' }, slot: 'cabeza', theme: 'juegos' },
  { id: 'helice', name: { es: 'Gorra de hélice', en: 'Propeller cap' }, slot: 'cabeza', theme: 'juegos' },
  { id: 'bandana', name: { es: 'Bandana', en: 'Bandana' }, slot: 'cabeza', theme: 'juegos' },
  { id: 'gafas-pixel', name: { es: 'Gafas pixel', en: 'Pixel shades' }, slot: 'cara', theme: 'juegos' },
  { id: 'vidas', name: { es: 'Vidas', en: 'Lives' }, slot: 'encima', theme: 'juegos' },
  { id: 'espada', name: { es: 'Espada', en: 'Sword' }, slot: 'espalda', theme: 'juegos' },
  { id: 'mando', name: { es: 'Mando', en: 'Controller' }, slot: 'manos', theme: 'juegos' },
  { id: 'sombrero-paja', name: { es: 'Sombrero de paja', en: 'Straw hat' }, slot: 'cabeza', theme: 'anime' },
  { id: 'parche', name: { es: 'Parche pirata', en: 'Eye patch' }, slot: 'cara', theme: 'anime' },
  { id: 'libreta', name: { es: 'Libreta negra', en: 'Black notebook' }, slot: 'manos', theme: 'anime' },
  { id: 'manzana', name: { es: 'Manzana', en: 'Apple' }, slot: 'manos', theme: 'anime' },
  { id: 'linterna', name: { es: 'Linterna', en: 'Flashlight' }, slot: 'manos', theme: 'terror' },
  { id: 'vial', name: { es: 'Vial', en: 'Vial' }, slot: 'manos', theme: 'terror' },
  { id: 'gancho', name: { es: 'Gancho', en: 'Hook' }, slot: 'espalda', theme: 'terror' },
  { id: 'hierba', name: { es: 'Hierba en maceta', en: 'Potted herb' }, slot: 'manos', theme: 'terror' },
  { id: 'spray', name: { es: 'Spray de primeros auxilios', en: 'First aid spray' }, slot: 'manos', theme: 'terror' },
  { id: 'mascara-gas', name: { es: 'Máscara de gas', en: 'Gas mask' }, slot: 'cara', theme: 'terror' },
  { id: 'vendas', name: { es: 'Vendas', en: 'Bandages' }, slot: 'cabeza', theme: 'terror' },
  { id: 'cinta', name: { es: 'Cinta de peligro', en: 'Hazard tape' }, slot: 'cuerpo', theme: 'terror' },
  { id: 'cuchillo', name: { es: 'Cuchillo de combate', en: 'Combat knife' }, slot: 'espalda', theme: 'terror' }
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
  {
    id: 'discreto',
    name: { es: 'Discreto', en: 'Quiet' },
    hint: {
      es: 'Solo avisos importantes: recordatorios, pomodoro y enlaces peligrosos',
      en: 'Only important alerts: reminders, pomodoro and dangerous links'
    }
  },
  {
    id: 'normal',
    name: { es: 'Normal', en: 'Normal' },
    hint: { es: 'Además te ofrece ayuda cuando copias algo', en: 'Also offers help when you copy something' }
  },
  {
    id: 'hablador',
    name: { es: 'Hablador', en: 'Chatty' },
    hint: { es: 'Además saluda, te anima y te recuerda descansar', en: 'Also says hello, cheers you on and reminds you to take breaks' }
  }
] as const
export type Chattiness = (typeof CHATTINESS)[number]['id']

export const AI_TONES = [
  { id: 'cercano', name: { es: 'Cercano', en: 'Friendly' }, hint: { es: 'Amable y al grano, tuteando', en: 'Warm and to the point' } },
  { id: 'formal', name: { es: 'Formal', en: 'Formal' }, hint: { es: 'Profesional y precisa, tratando de usted', en: 'Professional and precise' } },
  { id: 'divertido', name: { es: 'Divertido', en: 'Playful' }, hint: { es: 'Con humor y algún emoji, sin dejar de ayudar', en: 'Jokes and the odd emoji, still helpful' } }
] as const
export type AiTone = (typeof AI_TONES)[number]['id']

/** Colores que se pueden elegir para los ojos y los accesorios (además de uno a mano). */
export const COLOR_PRESETS: readonly { color: string; name: Text }[] = [
  { color: '#7ef0ff', name: { es: 'Cian', en: 'Cyan' } },
  { color: '#7dff6a', name: { es: 'Verde', en: 'Green' } },
  { color: '#ffd166', name: { es: 'Ámbar', en: 'Amber' } },
  { color: '#ff7a3d', name: { es: 'Naranja', en: 'Orange' } },
  { color: '#ff3b30', name: { es: 'Rojo', en: 'Red' } },
  { color: '#ff7ad9', name: { es: 'Rosa', en: 'Pink' } },
  { color: '#a78bfa', name: { es: 'Violeta', en: 'Violet' } },
  { color: '#5b8cff', name: { es: 'Azul', en: 'Blue' } },
  { color: '#f4f5f7', name: { es: 'Blanco', en: 'White' } },
  { color: '#2b2f3a', name: { es: 'Negro', en: 'Black' } }
]

const HEX_COLOR = /^#[0-9a-f]{6}$/i

/** Color "#rrggbb" válido (en minúsculas) o null. */
export function validColor(raw: unknown): string | null {
  return typeof raw === 'string' && HEX_COLOR.test(raw) ? raw.toLowerCase() : null
}

export interface Appearance {
  skin: string
  accessories: AccessoryId[]
  /** Color de ojos propio (null = el de la skin). */
  eyeColor: string | null
  /** Color de los accesorios propio (null = el de la skin). */
  accessoryColor: string | null
}

export interface Personality {
  name: string
  chattiness: Chattiness
  aiTone: AiTone
}

export const DEFAULT_APPEARANCE: Appearance = { skin: 'clasico', accessories: [], eyeColor: null, accessoryColor: null }
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
  return { skin, accessories, eyeColor: validColor(r.eyeColor), accessoryColor: validColor(r.accessoryColor) }
}

export function validatePersonality(raw: unknown): Personality {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const chattiness = CHATTINESS.find((c) => c.id === r.chattiness)?.id ?? DEFAULT_PERSONALITY.chattiness
  const aiTone = AI_TONES.find((t) => t.id === r.aiTone)?.id ?? DEFAULT_PERSONALITY.aiTone
  return { name: sanitizeName(r.name), chattiness, aiTone }
}

/** Variables CSS que pintan el robot con una skin (y los colores propios, si los hay). */
export function skinCssVars(skin: Skin, custom: Pick<Appearance, 'eyeColor' | 'accessoryColor'> = DEFAULT_APPEARANCE): Record<string, string> {
  const c = { ...skin.colors, eye: custom.eyeColor ?? skin.colors.eye, accessory: custom.accessoryColor ?? skin.colors.accessory }
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
  /** Enseñar en la pestaña la canción que suena. */
  nowPlaying: boolean
  language: Lang
  /** De dónde sale la clave de API de Claude (la clave nunca llega a la página). */
  claudeKey: 'settings' | 'env' | null
  /** Resultado del último intento de guardar la clave. */
  claudeKeyError?: 'invalid' | 'no-encryption'
  /** IA a la que mandar lo que copias. */
  askAi: Assistant
  autoUpdate: boolean
  /** Versión instalada y estado de las actualizaciones (solo para mostrar). */
  version: string
  update: UpdateView
}

/** Estado de las actualizaciones para la ventana de ajustes. */
export type UpdateView =
  | { state: 'idle' | 'checking' | 'up-to-date' | 'dev' }
  | { state: 'downloading'; version: string; progress: number }
  | { state: 'ready'; version: string }
  | { state: 'error'; message: string }

/** Cambios que manda la ventana de ajustes. `claudeApiKey`: clave nueva ('' la borra). */
export type SettingsPatch = Partial<Omit<SettingsView, 'claudeKey' | 'claudeKeyError' | 'version' | 'update'>> & {
  claudeApiKey?: string
  /** Botones de las actualizaciones. */
  checkUpdates?: true
  installUpdate?: true
}
