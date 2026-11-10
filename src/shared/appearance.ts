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

export const ACCESSORIES = [
  { id: 'auriculares', name: 'Auriculares' },
  { id: 'gorro', name: 'Gorro' },
  { id: 'gafas', name: 'Gafas' },
  { id: 'pajarita', name: 'Pajarita' }
] as const
export type AccessoryId = (typeof ACCESSORIES)[number]['id']

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
  const accessories = Array.isArray(r.accessories)
    ? [...new Set(r.accessories.filter((a): a is AccessoryId => typeof a === 'string' && ids.has(a)))]
    : []
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
}

export type SettingsPatch = Partial<SettingsView>
