/**
 * Procesos abiertos (los de tu sesión, agrupados por programa) y cómo cerrarlos.
 *
 * Cerrar primero lo pide con educación (como el botón X: el programa puede
 * preguntar si guardas); forzar lo mata al momento con sus subprocesos.
 * Los procesos del sistema y la propia Mascota no se listan.
 */
import { execFile } from 'node:child_process'
import { basename, join } from 'node:path'
import type { ProcessGroup } from '../../commands/types'
import { parseTasklist } from './processList'

const tasklistExe = () => join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tasklist.exe')
const taskkillExe = () => join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'taskkill.exe')

/** Mientras se escribe, la lista se reutiliza este rato. */
const CACHE_MS = 2500
let cache: { at: number; list: Promise<ProcessGroup[]> } | null = null

function run(file: string, args: string[]): Promise<{ ok: boolean; stdout: string }> {
  return new Promise((resolve) => {
    execFile(file, args, { windowsHide: true, timeout: 8000, maxBuffer: 4 * 1024 * 1024 }, (err, stdout) =>
      resolve({ ok: !err, stdout: String(stdout ?? '') })
    )
  })
}

/** Programas abiertos en tu sesión, de más a menos memoria. */
export function listProcesses(): Promise<ProcessGroup[]> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.list
  const list = run(tasklistExe(), ['/FO', 'CSV', '/NH']).then(({ stdout }) => parseTasklist(stdout, ownImage()))
  cache = { at: Date.now(), list }
  return list
}

/** El ejecutable de Mascota (Mascota.exe; en desarrollo, electron.exe): no se ofrece cerrarse a sí misma. */
const ownImage = () => basename(process.execPath)

/** Cierra esos procesos. `force`: sin preguntar (y con sus subprocesos). Devuelve si lo consiguió. */
export async function closeProcesses(pids: number[], force: boolean): Promise<boolean> {
  const targets = pids.filter((pid) => Number.isInteger(pid) && pid > 4 && pid !== process.pid)
  if (!targets.length) return false
  const args = targets.flatMap((pid) => ['/PID', String(pid)])
  if (force) args.push('/T', '/F')
  const { ok } = await run(taskkillExe(), args)
  cache = null // la próxima vez, lista nueva
  return ok
}
