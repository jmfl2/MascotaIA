/**
 * Configuración persistente en %APPDATA%/mascota/config.json.
 * Es un archivo JSON pequeño; se valida al leer (puede estar editado a mano
 * o corrupto) y se escribe de forma atómica (archivo temporal + rename).
 */
import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export interface Config {
  /** Posición de la ventana del robot (esquina superior izquierda, en DIP). */
  robotPosition: { x: number; y: number } | null
  /** Atajo global para abrir la barra, en formato de acelerador de Electron. */
  shortcut: string
  /** Si el robot se muestra al arrancar. */
  robotVisible: boolean
}

export const DEFAULT_SHORTCUT = 'Control+Space'

const DEFAULTS: Config = {
  robotPosition: null,
  shortcut: DEFAULT_SHORTCUT,
  robotVisible: true
}

let cache: Config | null = null

function configPath(): string {
  return join(app.getPath('userData'), 'config.json')
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/** Acepta solo los campos conocidos y con el tipo correcto. */
function validate(raw: unknown): Config {
  const cfg: Config = { ...DEFAULTS }
  if (!raw || typeof raw !== 'object') return cfg
  const r = raw as Record<string, unknown>

  const pos = r.robotPosition as Record<string, unknown> | null | undefined
  if (pos && isFiniteNumber(pos.x) && isFiniteNumber(pos.y)) {
    cfg.robotPosition = { x: Math.round(pos.x), y: Math.round(pos.y) }
  }
  if (typeof r.shortcut === 'string' && r.shortcut.length > 0 && r.shortcut.length < 64) {
    cfg.shortcut = r.shortcut
  }
  if (typeof r.robotVisible === 'boolean') cfg.robotVisible = r.robotVisible
  return cfg
}

export function getConfig(): Config {
  if (cache) return cache
  try {
    const file = configPath()
    cache = existsSync(file) ? validate(JSON.parse(readFileSync(file, 'utf8'))) : { ...DEFAULTS }
  } catch (err) {
    console.warn('[config] No se pudo leer la configuración, uso valores por defecto:', err)
    cache = { ...DEFAULTS }
  }
  return cache
}

export function setConfig(patch: Partial<Config>): void {
  cache = { ...getConfig(), ...patch }
  try {
    const file = configPath()
    mkdirSync(dirname(file), { recursive: true })
    const tmp = `${file}.tmp`
    writeFileSync(tmp, JSON.stringify(cache, null, 2), 'utf8')
    renameSync(tmp, file)
  } catch (err) {
    console.warn('[config] No se pudo guardar la configuración:', err)
  }
}
