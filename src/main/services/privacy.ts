/**
 * ¿Qué apps están usando el micrófono o la cámara ahora mismo? Para enseñar un
 * puntito en la isla (naranja el micro, verde la cámara).
 *
 * Windows lo apunta en el registro de cada usuario (ConsentStore): mientras
 * una app usa el micro o la cámara, su `LastUsedTimeStop` vale 0. Se lee con
 * reg.exe cada pocos segundos, solo mientras el indicador está encendido.
 * Nada sale del PC.
 */
import { execFile } from 'node:child_process'
import { join } from 'node:path'

export interface PrivacyState {
  /** Apps que usan el micrófono / la cámara (nombres en limpio, sin repetir). */
  mic: string[]
  camera: string[]
}

const KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore'
const POLL_MS = 2000
const MAX_APPS = 5

/** "C:#Program Files#Discord#Discord.exe" -> "Discord"; "Microsoft.WindowsCamera_8wekyb3d8bbwe" -> "WindowsCamera". */
export function privacyAppName(key: string): string {
  const last = key.split('\\').pop() ?? key
  if (last.includes('#')) return (last.split('#').pop() ?? last).replace(/\.exe$/i, '').slice(0, 40)
  const base = last.replace(/_[a-z0-9]{13}$/i, '')
  return (base.split('.').pop() || base).slice(0, 40)
}

/** Lee la salida de `reg query <KEY> /s /v LastUsedTimeStop`. */
export function parseConsentStore(output: string): PrivacyState {
  const mic = new Set<string>()
  const camera = new Set<string>()
  let key = ''
  for (const raw of output.split(/\r?\n/)) {
    const line = raw.trim()
    if (line.startsWith('HKEY_')) {
      key = line
      continue
    }
    const m = /^LastUsedTimeStop\s+REG_QWORD\s+0x([0-9a-f]+)$/i.exec(line)
    if (!m || Number.parseInt(m[1], 16) !== 0 || !key) continue
    // Las claves de grupo ("...\microphone\NonPackaged") no son apps.
    const rel = key.slice(key.toLowerCase().indexOf('consentstore\\') + 'consentstore\\'.length)
    const [capability, ...rest] = rel.split('\\')
    if (!rest.length || (rest.length === 1 && rest[0] === 'NonPackaged')) continue
    const name = privacyAppName(rest[rest.length - 1])
    if (!name) continue
    if (capability.toLowerCase() === 'microphone') mic.add(name)
    else if (capability.toLowerCase() === 'webcam') camera.add(name)
  }
  return { mic: [...mic].slice(0, MAX_APPS), camera: [...camera].slice(0, MAX_APPS) }
}

let timer: NodeJS.Timeout | null = null
let busy = false
let current: PrivacyState = { mic: [], camera: [] }
let onChange: (state: PrivacyState) => void = () => {}

function read(): void {
  if (busy) return
  busy = true
  const reg = join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'reg.exe')
  execFile(reg, ['query', KEY, '/s', '/v', 'LastUsedTimeStop'], { windowsHide: true, timeout: 5000, maxBuffer: 2 * 1024 * 1024 }, (_err, stdout) => {
    busy = false
    if (!timer) return
    // Sin entradas reg.exe termina con error: es lo mismo que "nadie lo usa".
    const next = parseConsentStore(String(stdout ?? ''))
    if (JSON.stringify(next) === JSON.stringify(current)) return
    current = next
    onChange(next)
  })
}

/** Lo último que se leyó. */
export function currentPrivacy(): PrivacyState {
  return current
}

/** Empieza (o deja) de vigilar. Al dejarlo, avisa de que ya no hay nada en uso. */
export function watchPrivacy(enabled: boolean, cb: (state: PrivacyState) => void): void {
  onChange = cb
  if (enabled && !timer && process.platform === 'win32') {
    timer = setInterval(read, POLL_MS)
    read()
  } else if (!enabled && timer) {
    clearInterval(timer)
    timer = null
    current = { mic: [], camera: [] }
    cb(current)
  }
}
