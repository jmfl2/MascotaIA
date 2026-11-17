/** Configuración persistente en %APPDATA%/mascota/config.json. */
import { app } from 'electron'
import { MODEL_NAME } from '../ai/ollama'
import {
  DEFAULT_APPEARANCE,
  DEFAULT_PERSONALITY,
  validateAppearance,
  validatePersonality,
  type Appearance,
  type Personality,
  UI_THEMES,
  validColor,
  type UiTheme
} from '../shared/appearance'
import { isLang, langFromLocale, type Lang } from '../shared/i18n'
import { readJson, writeJson } from './services/jsonFile'
import { isAssistant, type Assistant } from '../shared/assistants'
import { validateRoutines, type Routine } from '../shared/routines'

export interface Config {
  /** Atajo global para abrir la barra, en formato de acelerador de Electron. */
  shortcut: string
  /** Si la mascota (la isla de arriba) se muestra. */
  robotVisible: boolean
  /** El robot baja de la isla mientras la barra está abierta. */
  robotWithBar: boolean
  /** Portapapeles inteligente: ofrecer acciones al copiar texto. */
  clipboardEnabled: boolean
  /** Modelo de Ollama para la IA local. */
  aiModel: string
  /** Avisar de enlaces sospechosos al copiarlos. */
  linkGuard: boolean
  /** Skin y accesorios del robot. */
  appearance: Appearance
  /** Nombre, cuánto habla y tono de la IA. */
  personality: Personality
  /** Idioma de la interfaz (la primera vez, el del sistema). */
  language: Lang
  /** Enseñar en la pestaña de arriba la canción que suena. */
  nowPlaying: boolean
  /** Puntitos de micro y cámara en uso y avisos de batería en la isla. */
  statusIndicators: boolean
  /** Clave de API de Anthropic cifrada con safeStorage (base64), o null. */
  claudeKeyEnc: string | null
  /** IA a la que mandar lo que copias ("Preguntar a…" en el bocadillo). */
  askAi: Assistant
  /** Buscar e instalar actualizaciones de GitHub solo. */
  autoUpdate: boolean
  /** Dónde abrir Claude sin clave de API (null = la app si está instalada). */
  claudeOpenIn: 'web' | 'app' | null
  /** Ambientarse solo en fechas especiales (Navidad, Halloween...). */
  seasonal: boolean
  /** Atajos propios: un nombre que abre varias apps, webs y carpetas. */
  routines: Routine[]
  /** Tema de las ventanas (sistema, claro, oscuro). */
  theme: UiTheme
  /** Color de acento "#rrggbb" de la barra y las ventanas (null = el de siempre). */
  accent: string | null
  /** Última terminal usada desde la barra ("wt", "cmd"...), para ofrecerla la primera. */
  lastTerminal: string | null
  /** Última felicitación dada ("navidad-2026"), para no repetirla. */
  lastSeasonGreeting: string | null
}

export const DEFAULT_SHORTCUT = 'Control+Space'
export const DEFAULT_AI_MODEL = 'gemma3:4b'
const FILE = 'config.json'

const DEFAULTS: Config = {
  shortcut: DEFAULT_SHORTCUT,
  robotVisible: true,
  robotWithBar: true,
  clipboardEnabled: true,
  aiModel: DEFAULT_AI_MODEL,
  linkGuard: true,
  appearance: DEFAULT_APPEARANCE,
  personality: DEFAULT_PERSONALITY,
  language: 'es',
  nowPlaying: true,
  statusIndicators: true,
  claudeKeyEnc: null,
  askAi: 'claude',
  autoUpdate: true,
  claudeOpenIn: null,
  seasonal: true,
  lastSeasonGreeting: null,
  lastTerminal: null,
  theme: 'system',
  accent: null,
  routines: []
}

let cache: Config | null = null

/** Acepta solo los campos conocidos y con el tipo correcto. */
function validate(raw: unknown): Config {
  const cfg: Config = { ...DEFAULTS, language: systemLang() }
  if (!raw || typeof raw !== 'object') return cfg
  const r = raw as Record<string, unknown>

  if (typeof r.shortcut === 'string' && r.shortcut.length > 0 && r.shortcut.length < 64) cfg.shortcut = r.shortcut
  if (typeof r.robotVisible === 'boolean') cfg.robotVisible = r.robotVisible
  if (typeof r.robotWithBar === 'boolean') cfg.robotWithBar = r.robotWithBar
  if (typeof r.clipboardEnabled === 'boolean') cfg.clipboardEnabled = r.clipboardEnabled
  if (typeof r.aiModel === 'string' && MODEL_NAME.test(r.aiModel)) cfg.aiModel = r.aiModel
  if (typeof r.linkGuard === 'boolean') cfg.linkGuard = r.linkGuard
  if (r.appearance !== undefined) cfg.appearance = validateAppearance(r.appearance)
  if (r.personality !== undefined) cfg.personality = validatePersonality(r.personality)
  if (isLang(r.language)) cfg.language = r.language
  if (typeof r.nowPlaying === 'boolean') cfg.nowPlaying = r.nowPlaying
  if (typeof r.statusIndicators === 'boolean') cfg.statusIndicators = r.statusIndicators
  if (isAssistant(r.askAi)) cfg.askAi = r.askAi
  if (typeof r.autoUpdate === 'boolean') cfg.autoUpdate = r.autoUpdate
  if (r.claudeOpenIn === 'web' || r.claudeOpenIn === 'app') cfg.claudeOpenIn = r.claudeOpenIn
  if (typeof r.seasonal === 'boolean') cfg.seasonal = r.seasonal
  if (typeof r.lastSeasonGreeting === 'string' && r.lastSeasonGreeting.length < 40) cfg.lastSeasonGreeting = r.lastSeasonGreeting
  if (UI_THEMES.some((th) => th.id === r.theme)) cfg.theme = r.theme as UiTheme
  cfg.accent = validColor(r.accent)
  cfg.routines = validateRoutines(r.routines)
  if (typeof r.lastTerminal === 'string' && /^[a-z0-9-]{1,20}$/.test(r.lastTerminal)) cfg.lastTerminal = r.lastTerminal
  if (typeof r.claudeKeyEnc === 'string' && /^[A-Za-z0-9+/]+={0,2}$/.test(r.claudeKeyEnc) && r.claudeKeyEnc.length < 4000) {
    cfg.claudeKeyEnc = r.claudeKeyEnc
  }
  return cfg
}

/** Idioma del sistema, para la primera vez que se abre la app. */
function systemLang(): Lang {
  try {
    return langFromLocale(app.getPreferredSystemLanguages()[0] ?? app.getLocale())
  } catch {
    return 'es'
  }
}

export function getConfig(): Config {
  cache ??= readJson(FILE, validate, () => ({ ...DEFAULTS, language: systemLang() }))
  return cache
}

export function setConfig(patch: Partial<Config>): void {
  cache = { ...getConfig(), ...patch }
  writeJson(FILE, cache)
}
