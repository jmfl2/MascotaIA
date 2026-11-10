/** Configuración persistente en %APPDATA%/mascota/config.json. */
import { app } from 'electron'
import { MODEL_NAME } from '../ai/ollama'
import {
  DEFAULT_APPEARANCE,
  DEFAULT_PERSONALITY,
  validateAppearance,
  validatePersonality,
  type Appearance,
  type Personality
} from '../shared/appearance'
import { isLang, langFromLocale, type Lang } from '../shared/i18n'
import { readJson, writeJson } from './services/jsonFile'

export interface Config {
  /** Posición de la ventana del robot (esquina superior izquierda, en DIP). */
  robotPosition: { x: number; y: number } | null
  /** Atajo global para abrir la barra, en formato de acelerador de Electron. */
  shortcut: string
  /** Si el robot (o la pestaña, en modo pestaña) se muestra al arrancar. */
  robotVisible: boolean
  /**
   * Modo pestaña: en vez del robot siempre en pantalla, una pestaña fina arriba.
   * El robot baja de ella al hacerle clic (o cuando tiene algo que decir).
   */
  dockTop: boolean
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
}

export const DEFAULT_SHORTCUT = 'Control+Space'
export const DEFAULT_AI_MODEL = 'gemma3:4b'
const FILE = 'config.json'

const DEFAULTS: Config = {
  robotPosition: null,
  shortcut: DEFAULT_SHORTCUT,
  robotVisible: true,
  dockTop: true,
  clipboardEnabled: true,
  aiModel: DEFAULT_AI_MODEL,
  linkGuard: true,
  appearance: DEFAULT_APPEARANCE,
  personality: DEFAULT_PERSONALITY,
  language: 'es',
  nowPlaying: true
}

let cache: Config | null = null

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Acepta solo los campos conocidos y con el tipo correcto. */
function validate(raw: unknown): Config {
  const cfg: Config = { ...DEFAULTS, language: systemLang() }
  if (!raw || typeof raw !== 'object') return cfg
  const r = raw as Record<string, unknown>

  const pos = r.robotPosition as Record<string, unknown> | null | undefined
  if (pos && isFiniteNumber(pos.x) && isFiniteNumber(pos.y)) {
    cfg.robotPosition = { x: Math.round(pos.x), y: Math.round(pos.y) }
  }
  if (typeof r.shortcut === 'string' && r.shortcut.length > 0 && r.shortcut.length < 64) cfg.shortcut = r.shortcut
  if (typeof r.robotVisible === 'boolean') cfg.robotVisible = r.robotVisible
  if (typeof r.dockTop === 'boolean') cfg.dockTop = r.dockTop
  if (typeof r.clipboardEnabled === 'boolean') cfg.clipboardEnabled = r.clipboardEnabled
  if (typeof r.aiModel === 'string' && MODEL_NAME.test(r.aiModel)) cfg.aiModel = r.aiModel
  if (typeof r.linkGuard === 'boolean') cfg.linkGuard = r.linkGuard
  if (r.appearance !== undefined) cfg.appearance = validateAppearance(r.appearance)
  if (r.personality !== undefined) cfg.personality = validatePersonality(r.personality)
  if (isLang(r.language)) cfg.language = r.language
  if (typeof r.nowPlaying === 'boolean') cfg.nowPlaying = r.nowPlaying
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
