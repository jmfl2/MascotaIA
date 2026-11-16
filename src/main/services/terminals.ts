/**
 * Terminales instaladas y cómo abrir cada una con un comando ya escrito.
 *
 * Cada terminal se abre en una ventana nueva, en tu carpeta de usuario, y se
 * queda abierta al terminar el comando para que veas el resultado. Solo se
 * ejecuta lo que el usuario ha escrito y elegido con Intro o un clic.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { TerminalInfo } from '../../commands/types'
import { t } from '../../shared/i18n'

interface TerminalDef extends TerminalInfo {
  /** Ruta del ejecutable, o null si no está instalada. */
  find(): string | null
  /** Argumentos para abrirla (con `command` vacío, solo se abre). */
  args(exe: string, command: string): { file: string; args: string[]; verbatim?: boolean }
}

const env = (name: string): string => process.env[name] ?? ''
const firstExisting = (...paths: string[]): string | null => paths.find((p) => p && existsSync(p)) ?? null
const system32 = () => join(env('SystemRoot') || 'C:\\Windows', 'System32')
const windowsApps = () => join(env('LOCALAPPDATA'), 'Microsoft', 'WindowsApps')

/** PowerShell con el comando en base64 (UTF-16LE): sin problemas de comillas ni de punto y coma. */
function powershellArgs(command: string): string[] {
  const args = ['-NoExit', '-NoLogo']
  if (command) args.push('-EncodedCommand', Buffer.from(command, 'utf16le').toString('base64'))
  return args
}

const powershellExe = () => firstExisting(join(system32(), 'WindowsPowerShell', 'v1.0', 'powershell.exe'))

const TERMINALS: TerminalDef[] = [
  {
    id: 'wt',
    name: 'Windows Terminal',
    find: () => firstExisting(join(windowsApps(), 'wt.exe')),
    // Windows Terminal con PowerShell dentro: `--` evita que wt interprete el comando.
    args: (exe, command) => ({ file: exe, args: ['-d', homedir(), '--', powershellExe() ?? 'powershell.exe', ...powershellArgs(command)] })
  },
  {
    id: 'pwsh',
    name: 'PowerShell 7',
    find: () => firstExisting(join(env('ProgramFiles'), 'PowerShell', '7', 'pwsh.exe'), join(windowsApps(), 'pwsh.exe')),
    args: (exe, command) => ({ file: exe, args: powershellArgs(command) })
  },
  {
    id: 'powershell',
    name: 'Windows PowerShell',
    find: powershellExe,
    args: (exe, command) => ({ file: exe, args: powershellArgs(command) })
  },
  {
    id: 'cmd',
    get name() {
      return t('Símbolo del sistema', 'Command Prompt')
    },
    find: () => firstExisting(join(system32(), 'cmd.exe')),
    // cmd lee el resto de la línea tal cual tras /K: se pasa sin reescapar.
    args: (exe, command) => ({ file: exe, args: command ? ['/K', command] : [], verbatim: true })
  },
  {
    id: 'gitbash',
    name: 'Git Bash',
    find: () => firstExisting(join(env('ProgramFiles'), 'Git', 'bin', 'bash.exe'), join(env('ProgramFiles(x86)'), 'Git', 'bin', 'bash.exe')),
    // Ejecuta el comando y deja abierta una bash interactiva.
    args: (exe, command) => ({ file: exe, args: command ? ['--login', '-i', '-c', `${command}; exec bash -i`] : ['--login', '-i'] })
  }
]

let cache: { list: TerminalDef[]; at: number } | null = null
const CACHE_MS = 60_000

function installed(): TerminalDef[] {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.list
  const list = TERMINALS.filter((def) => def.find() !== null)
  cache = { list, at: Date.now() }
  return list
}

/** Terminales instaladas, con la última usada (`last`) la primera. */
export function listTerminals(last: string | null): TerminalInfo[] {
  const list = installed().map(({ id, name }): TerminalInfo => ({ id, name, ...(id === last ? { lastUsed: true } : {}) }))
  return [...list.filter((x) => x.lastUsed), ...list.filter((x) => !x.lastUsed)]
}

/** Abre la terminal `id` con `command` (vacío = solo abrirla). Devuelve false si no se pudo. */
export function runInTerminal(id: string, command: string): boolean {
  const def = installed().find((d) => d.id === id)
  const exe = def?.find()
  if (!def || !exe) return false
  const { file, args, verbatim } = def.args(exe, command)
  try {
    const child = spawn(file, args, {
      cwd: homedir(),
      // detached: la terminal tiene su propia ventana de consola y sigue abierta si se cierra Mascota.
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
      windowsVerbatimArguments: verbatim ?? false
    })
    child.on('error', (err) => console.error('[terminal] No se pudo abrir:', err))
    child.unref()
    return true
  } catch (err) {
    console.error('[terminal] No se pudo abrir:', err)
    return false
  }
}
