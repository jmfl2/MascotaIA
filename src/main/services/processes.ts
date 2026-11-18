/**
 * Procesos abiertos (los de tu sesión, agrupados por programa) y cómo cerrarlos.
 *
 * Cerrar primero lo pide con educación (como el botón ✕: el programa puede
 * preguntar si guardas o irse a la bandeja); forzar lo mata al momento con sus
 * subprocesos. Después se comprueba si de verdad se cerró. Los procesos del
 * sistema y la propia Mascota no se listan.
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

function run(file: string, args: string[], timeout = 8000): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(file, args, { windowsHide: true, timeout, maxBuffer: 4 * 1024 * 1024 }, (err, stdout, stderr) =>
      resolve({ ok: !err, stdout: String(stdout ?? ''), stderr: String(stderr ?? '') })
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

/** Resultado de intentar cerrar un programa. */
export type CloseResult = 'closed' | 'running' | 'denied' | 'failed'

/** Solo nombres de ejecutable normales ("chrome.exe", "Code - Insiders.exe"): van como argumento de taskkill. */
const SAFE_IMAGE = /^[\w .()&+,-]{1,120}\.exe$/i
/** Lo que se espera a que un programa se cierre solo (algunos tardan un poco). */
const WAIT_CLOSE_MS = 3000
const POLL_MS = 250

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** ¿Sigue abierto ese programa en tu sesión? */
async function isRunning(image: string): Promise<boolean> {
  const { stdout } = await run(tasklistExe(), ['/FI', `IMAGENAME eq ${image}`, '/FO', 'CSV', '/NH'])
  return parseTasklist(stdout, ownImage()).length > 0
}

/** Espera (hasta WAIT_CLOSE_MS) a que el programa ya no esté. */
async function waitGone(image: string): Promise<boolean> {
  for (let waited = 0; waited < WAIT_CLOSE_MS; waited += POLL_MS) {
    await wait(POLL_MS)
    if (!(await isRunning(image))) return true
  }
  return false
}

/**
 * Cierra un programa entero (todos sus procesos con ese ejecutable, también los
 * que haya abierto después de listarlo).
 * - Sin `force`: como el botón ✕; el programa puede preguntar si guardas o irse
 *   a la bandeja, y entonces sigue abierto ('running').
 * - Con `force`: al momento, con sus subprocesos.
 * Después comprueba de verdad si se ha cerrado; 'denied' si es de administrador.
 */
export async function closeProgram(image: string, force: boolean): Promise<CloseResult> {
  if (!SAFE_IMAGE.test(image) || image.toLowerCase() === ownImage().toLowerCase()) return 'failed'
  const args = ['/IM', image]
  if (force) args.push('/T', '/F')
  const r = await run(taskkillExe(), args)
  cache = null // la próxima vez, lista nueva
  if (await waitGone(image)) return 'closed'
  // "Acceso denegado": está abierto como administrador.
  if (/denegado|denied|0x5\b/i.test(`${r.stdout}\n${r.stderr}`)) return 'denied'
  return 'running'
}

/**
 * Cierra (forzando) un programa abierto como administrador: Windows enseña su
 * aviso de permisos y lo acepta o no la persona. Devuelve si se cerró.
 */
export async function closeProgramAsAdmin(image: string): Promise<CloseResult> {
  if (!SAFE_IMAGE.test(image) || image.toLowerCase() === ownImage().toLowerCase()) return 'failed'
  // El nombre va entre comillas simples de PowerShell (sin comillas dentro: lo garantiza SAFE_IMAGE).
  const script = `Start-Process -FilePath '${taskkillExe()}' -ArgumentList '/F','/T','/IM','${image.replace(/'/g, '')}' -Verb RunAs -WindowStyle Hidden -Wait`
  const ps = join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  await run(ps, ['-NoProfile', '-NonInteractive', '-Command', script], 120_000)
  cache = null
  return (await waitGone(image)) ? 'closed' : 'running'
}
