/**
 * Volumen del altavoz de Windows, rápido para poder arrastrar una barra.
 *
 * Un PowerShell con la API de audio de Windows (Core Audio) ya cargada se
 * queda abierto y recibe órdenes fijas por la entrada estándar ("get",
 * "set 40", "step -10", "mute"), validadas aquí y en el script con expresiones
 * regulares: nada de lo que llega se ejecuta como código. Contesta cada orden
 * con una línea "nivel|silenciado". Se cierra solo tras un rato sin usarse.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { join } from 'node:path'
import { createInterface } from 'node:readline'

export interface VolumeState {
  /** 0-100. */
  level: number
  muted: boolean
}

export type VolumeChange = { kind: 'set'; level: number } | { kind: 'step'; delta: number } | { kind: 'mute' }

/** Cuánto se queda abierto el PowerShell sin órdenes. */
const IDLE_MS = 120_000
/** Si no contesta en este tiempo (la primera vez compila el código de audio). */
const REPLY_TIMEOUT_MS = 15_000

const SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
[Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
  int f(); int g(); int h(); int i();
  int SetMasterVolumeLevelScalar(float fLevel, Guid pguidEventContext);
  int j();
  int GetMasterVolumeLevelScalar(out float pfLevel);
  int k(); int l(); int m(); int n();
  int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, Guid pguidEventContext);
  int GetMute(out bool pbMute);
}
[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice { int Activate(ref Guid id, int clsCtx, int activationParams, out IAudioEndpointVolume aev); }
[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator { int f(); int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint); }
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorComObject { }
public class MascotaAudio {
  static IAudioEndpointVolume Vol() {
    var enumerator = new MMDeviceEnumeratorComObject() as IMMDeviceEnumerator;
    IMMDevice dev = null;
    Marshal.ThrowExceptionForHR(enumerator.GetDefaultAudioEndpoint(0, 1, out dev));
    IAudioEndpointVolume epv = null;
    var epvid = typeof(IAudioEndpointVolume).GUID;
    Marshal.ThrowExceptionForHR(dev.Activate(ref epvid, 23, 0, out epv));
    return epv;
  }
  public static float Volume {
    get { float v = -1; Marshal.ThrowExceptionForHR(Vol().GetMasterVolumeLevelScalar(out v)); return v; }
    set { Marshal.ThrowExceptionForHR(Vol().SetMasterVolumeLevelScalar(value, Guid.Empty)); }
  }
  public static bool Mute {
    get { bool m; Marshal.ThrowExceptionForHR(Vol().GetMute(out m)); return m; }
    set { Marshal.ThrowExceptionForHR(Vol().SetMute(value, Guid.Empty)); }
  }
}
'@
[Console]::InputEncoding = [Text.Encoding]::UTF8
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line) { break } # se cerró la entrada: la app se ha ido
  try {
    $c = $line.Trim()
    if ($c -match '^set (\d{1,3})$') {
      [MascotaAudio]::Mute = $false
      [MascotaAudio]::Volume = [Math]::Min(100, [int]$Matches[1]) / 100
    } elseif ($c -match '^step (-?\d{1,3})$') {
      [MascotaAudio]::Mute = $false
      [MascotaAudio]::Volume = [Math]::Min(1, [Math]::Max(0, [MascotaAudio]::Volume + [int]$Matches[1] / 100))
    } elseif ($c -eq 'mute') {
      [MascotaAudio]::Mute = -not [MascotaAudio]::Mute
    }
    [Console]::Out.WriteLine(('{0}|{1}' -f [Math]::Round([MascotaAudio]::Volume * 100), [MascotaAudio]::Mute))
  } catch {
    [Console]::Out.WriteLine('error')
  }
  [Console]::Out.Flush()
}
`

/** "76|False" -> { level: 76, muted: false }; cualquier otra cosa, null. */
export function parseVolumeReply(line: string): VolumeState | null {
  const m = /^(\d{1,3})\|(True|False)$/.exec(line.trim())
  return m ? { level: Math.min(100, Number(m[1])), muted: m[2] === 'True' } : null
}

/** La orden fija para el script, o null si el cambio no es válido. */
export function volumeCommand(change: VolumeChange | { kind: 'get' }): string | null {
  switch (change.kind) {
    case 'get':
      return 'get'
    case 'mute':
      return 'mute'
    case 'set':
      return Number.isFinite(change.level) ? `set ${Math.round(Math.min(Math.max(change.level, 0), 100))}` : null
    case 'step':
      return Number.isFinite(change.delta) ? `step ${Math.round(Math.min(Math.max(change.delta, -100), 100))}` : null
  }
}

let child: ChildProcess | null = null
let idleTimer: NodeJS.Timeout | null = null
/** Quien espera respuesta, en orden (el script contesta una línea por orden). */
const waiting: Array<(state: VolumeState | null) => void> = []

function stop(): void {
  const proc = child
  child = null
  proc?.stdin?.end()
  setTimeout(() => proc?.kill(), 2000)
  while (waiting.length) waiting.shift()!(null)
}

function ensure(): ChildProcess | null {
  if (child) return child
  if (process.platform !== 'win32') return null
  const ps = join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
  const encoded = Buffer.from(SCRIPT, 'utf16le').toString('base64')
  const proc = spawn(ps, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], {
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'ignore']
  })
  child = proc
  createInterface({ input: proc.stdout! }).on('line', (line) => waiting.shift()?.(parseVolumeReply(line)))
  proc.stdin?.on('error', () => {})
  proc.on('error', (err) => console.warn('[volumen] no se pudo arrancar PowerShell:', err.message))
  proc.on('exit', () => {
    if (child === proc) child = null
    while (waiting.length) waiting.shift()!(null)
  })
  return proc
}

function send(command: string): Promise<VolumeState | null> {
  const proc = ensure()
  if (!proc?.stdin) return Promise.resolve(null)
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = setTimeout(stop, IDLE_MS)
  return new Promise((resolve) => {
    let done = false
    const finish = (state: VolumeState | null) => {
      if (done) return
      done = true
      resolve(state)
    }
    waiting.push(finish)
    // Si no contesta, se da por perdido (y se reinicia la próxima vez).
    setTimeout(() => {
      if (done) return
      finish(null)
      stop()
    }, REPLY_TIMEOUT_MS)
    proc.stdin!.write(`${command}\n`)
  })
}

/** Volumen actual, o null si no se pudo leer. */
export function getVolume(): Promise<VolumeState | null> {
  return send('get')
}

/** Cambia el volumen y devuelve cómo queda, o null si falló. */
export function changeVolume(change: VolumeChange): Promise<VolumeState | null> {
  const command = volumeCommand(change)
  return command ? send(command) : Promise.resolve(null)
}

/** Al salir de la app. */
export function stopVolume(): void {
  if (idleTimer) clearTimeout(idleTimer)
  idleTimer = null
  if (child) stop()
}
