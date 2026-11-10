/**
 * Lectura y escritura de JSON en %APPDATA%/mascota.
 * Se valida al leer (el archivo puede estar editado a mano o corrupto) y se
 * escribe de forma atómica: archivo temporal + rename, para no dejarlo a medias.
 */
import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export function dataPath(file: string): string {
  return join(app.getPath('userData'), file)
}

export function readJson<T>(file: string, validate: (raw: unknown) => T, fallback: () => T): T {
  const path = dataPath(file)
  try {
    if (!existsSync(path)) return fallback()
    return validate(JSON.parse(readFileSync(path, 'utf8')))
  } catch (err) {
    console.warn(`[datos] No se pudo leer ${file}, uso valores por defecto:`, err)
    return fallback()
  }
}

export function writeJson(file: string, data: unknown): void {
  const path = dataPath(file)
  try {
    mkdirSync(dirname(path), { recursive: true })
    const tmp = `${path}.tmp`
    writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8')
    renameSync(tmp, path)
  } catch (err) {
    console.warn(`[datos] No se pudo guardar ${file}:`, err)
  }
}

/** Filtra un array de objetos sin fiarse de su contenido. */
export function arrayOf<T>(raw: unknown, pick: (item: Record<string, unknown>) => T | null): T[] {
  if (!Array.isArray(raw)) return []
  const out: T[] = []
  for (const item of raw) {
    if (item && typeof item === 'object') {
      const value = pick(item as Record<string, unknown>)
      if (value) out.push(value)
    }
  }
  return out
}

export const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
export const isStr = (v: unknown, max = 5000): v is string => typeof v === 'string' && v.length <= max

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}
