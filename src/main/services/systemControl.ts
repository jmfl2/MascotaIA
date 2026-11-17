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

/** Volumen del altavoz por defecto con la API de audio de Windows (Core Audio). */
const AUDIO = String.raw`
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
`

export type VolumeChange = { kind: 'set'; level: number } | { kind: 'step'; delta: number } | { kind: 'mute' }

/** Cambia el volumen y devuelve cómo queda (0-100 y si está silenciado), o null si falló. */
export async function changeVolume(change: VolumeChange): Promise<{ level: number; muted: boolean } | null> {
  let action: string
  if (change.kind === 'mute') action = '[MascotaAudio]::Mute = -not [MascotaAudio]::Mute'
  else {
    const value = change.kind === 'set' ? change.level : change.delta
    if (!Number.isFinite(value)) return null
    const n = Math.round(Math.min(Math.max(value, -100), 100))
    action =
      change.kind === 'set'
        ? `[MascotaAudio]::Mute = $false; [MascotaAudio]::Volume = ${Math.max(0, n) / 100}`
        : `[MascotaAudio]::Mute = $false; [MascotaAudio]::Volume = [Math]::Min(1, [Math]::Max(0, [MascotaAudio]::Volume + ${n / 100}))`
  }
  const r = await powershell(`${AUDIO}\n${action}\n'{0}|{1}' -f [Math]::Round([MascotaAudio]::Volume * 100), [MascotaAudio]::Mute`)
  const m = /^(\d{1,3})\|(True|False)/m.exec(r.stdout.trim())
  if (!m) console.warn('[volumen] no se pudo cambiar:', JSON.stringify(change), r.ok, r.stdout.slice(0, 300), r.stderr.slice(0, 1500))
  return m ? { level: Number(m[1]), muted: m[2] === 'True' } : null
}

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
