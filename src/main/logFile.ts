/**
 * Registro en disco (%APPDATA%\mascota\logs\mascota.log): lo que la app cuenta
 * por consola y cualquier error que no se capture. Sirve para saber qué pasó en
 * un ordenador donde Mascota no arranca o falla, sin depender de una consola.
 *
 * No guarda nada de lo que escribes ni de lo que copias: solo los mensajes de
 * la propia app. Al pasar de MAX_BYTES se empieza otro y se guarda el anterior
 * como mascota.old.log.
 */
import { app } from 'electron'
import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { format } from 'node:util'

const MAX_BYTES = 512 * 1024

let file: string | null = null

function write(level: string, args: unknown[]): void {
  if (!file) return
  try {
    const line = `${new Date().toISOString()} ${level} ${format(...args)}\n`
    appendFileSync(file, line.length > 4000 ? `${line.slice(0, 4000)}…\n` : line, 'utf8')
  } catch {
    /* sin disco: no pasa nada */
  }
}

/** Empieza a guardar el registro. Llamarlo lo primero, antes de crear ventanas. */
export function startLogFile(): void {
  try {
    const dir = join(app.getPath('userData'), 'logs')
    mkdirSync(dir, { recursive: true })
    file = join(dir, 'mascota.log')
    if (existsSync(file) && statSync(file).size > MAX_BYTES) renameSync(file, join(dir, 'mascota.old.log'))
  } catch {
    file = null
    return
  }
  for (const level of ['log', 'warn', 'error'] as const) {
    const original = console[level].bind(console)
    console[level] = (...args: unknown[]) => {
      original(...args)
      write(level.toUpperCase(), args)
    }
  }
  process.on('uncaughtException', (err) => write('FATAL', [err]))
  process.on('unhandledRejection', (reason) => write('ERROR', ['promesa sin capturar:', reason]))
  app.on('render-process-gone', (_e, wc, details) => write('ERROR', [`ventana caída (${wc.getURL().split('/').pop()}):`, details.reason, details.exitCode]))
  app.on('child-process-gone', (_e, details) => write('WARN', ['proceso hijo caído:', details.type, details.reason]))
  write('INFO', [`--- Mascota ${app.getVersion()} arranca (${process.platform} ${process.getSystemVersion()}) ---`])
}

/** Ruta del registro (para abrirlo desde la bandeja). */
export function logFilePath(): string | null {
  return file
}
