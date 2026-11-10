/** Configuración persistente en %APPDATA%/mascota/config.json. */
import { readJson, writeJson } from './services/jsonFile'

export interface Config {
  /** Posición de la ventana del robot (esquina superior izquierda, en DIP). */
  robotPosition: { x: number; y: number } | null
  /** Atajo global para abrir la barra, en formato de acelerador de Electron. */
  shortcut: string
  /** Si el robot se muestra al arrancar. */
  robotVisible: boolean
  /** Portapapeles inteligente: ofrecer acciones al copiar texto. */
  clipboardEnabled: boolean
}

export const DEFAULT_SHORTCUT = 'Control+Space'
const FILE = 'config.json'

const DEFAULTS: Config = {
  robotPosition: null,
  shortcut: DEFAULT_SHORTCUT,
  robotVisible: true,
  clipboardEnabled: true
}

let cache: Config | null = null

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

/** Acepta solo los campos conocidos y con el tipo correcto. */
function validate(raw: unknown): Config {
  const cfg: Config = { ...DEFAULTS }
  if (!raw || typeof raw !== 'object') return cfg
  const r = raw as Record<string, unknown>

  const pos = r.robotPosition as Record<string, unknown> | null | undefined
  if (pos && isFiniteNumber(pos.x) && isFiniteNumber(pos.y)) {
    cfg.robotPosition = { x: Math.round(pos.x), y: Math.round(pos.y) }
  }
  if (typeof r.shortcut === 'string' && r.shortcut.length > 0 && r.shortcut.length < 64) cfg.shortcut = r.shortcut
  if (typeof r.robotVisible === 'boolean') cfg.robotVisible = r.robotVisible
  if (typeof r.clipboardEnabled === 'boolean') cfg.clipboardEnabled = r.clipboardEnabled
  return cfg
}

export function getConfig(): Config {
  cache ??= readJson(FILE, validate, () => ({ ...DEFAULTS }))
  return cache
}

export function setConfig(patch: Partial<Config>): void {
  cache = { ...getConfig(), ...patch }
  writeJson(FILE, cache)
}
