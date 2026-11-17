/**
 * Control del PC desde la barra: bloquear, suspender, apagar o reiniciar
 * (con margen para cancelar), volumen y modo oscuro de Windows.
 *
 * Solo se ejecutan órdenes fijas de este archivo; de lo que escribe el usuario
 * solo llega un número de volumen ya validado.
 */
import { execFile } from 'node:child_process'
import { join } from 'node:path'

const sys32 = (exe: string) => join(process.env.SystemRoot || 'C:\\Windows', 'System32', exe)

function run(file: string, args: string[], timeout = 8000): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(file, args, { windowsHide: true, timeout }, (err, stdout, stderr) =>
      resolve({ ok: !err, stdout: String(stdout ?? ''), stderr: `${err ? `${err.message}\n` : ''}${String(stderr ?? '')}` })
    )
  })
}

function powershell(script: string, timeout = 15000): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  const encoded = Buffer.from(script, 'utf16le').toString('base64')
  return run(sys32('WindowsPowerShell\\v1.0\\powershell.exe'), ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], timeout)
}

export function lockPc(): Promise<boolean> {
  return run(sys32('rundll32.exe'), ['user32.dll,LockWorkStation']).then((r) => r.ok)
}

/** Suspender (no hibernar, aunque la hibernación esté activada). */
export function sleepPc(): Promise<boolean> {
  return powershell("Add-Type -AssemblyName System.Windows.Forms; [void][System.Windows.Forms.Application]::SetSuspendState('Suspend', $false, $false)").then((r) => r.ok)
}

/** Apagar o reiniciar dentro de `seconds` (se puede cancelar con cancelShutdown). */
export function scheduleShutdown(restart: boolean, seconds: number): Promise<boolean> {
  const s = Math.min(Math.max(Math.round(seconds), 0), 600)
  return run(sys32('shutdown.exe'), [restart ? '/r' : '/s', '/t', String(s)]).then((r) => r.ok)
}

export function cancelShutdown(): Promise<boolean> {
  return run(sys32('shutdown.exe'), ['/a']).then((r) => r.ok)
}

// El volumen está en services/volume.ts (un PowerShell que se queda abierto).

const PERSONALIZE = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize'

/** Modo oscuro (o claro) de Windows: apps y sistema. */
export async function setWindowsDarkMode(dark: boolean): Promise<boolean> {
  const value = dark ? '0' : '1'
  const results = await Promise.all(
    ['AppsUseLightTheme', 'SystemUsesLightTheme'].map((name) => run(sys32('reg.exe'), ['add', PERSONALIZE, '/v', name, '/t', 'REG_DWORD', '/d', value, '/f']))
  )
  return results.every((r) => r.ok)
}

/** ¿Está Windows en modo oscuro? (null si no se sabe) */
export async function windowsDarkMode(): Promise<boolean | null> {
  const r = await run(sys32('reg.exe'), ['query', PERSONALIZE, '/v', 'AppsUseLightTheme'])
  const m = /AppsUseLightTheme\s+REG_DWORD\s+0x([0-9a-f]+)/i.exec(r.stdout)
  return m ? Number.parseInt(m[1], 16) === 0 : null
}
