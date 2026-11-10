/**
 * Lo que está sonando (Spotify, el navegador, la app Multimedia...), para
 * enseñarlo en la pestaña de arriba como la "isla" del iPhone.
 *
 * Windows lo publica en los controles multimedia del sistema (los mismos que
 * salen junto al volumen). Se leen con un único PowerShell que se queda en
 * marcha: cada segundo mira la sesión actual y escribe una línea JSON solo si
 * algo cambió. Por la entrada estándar recibe órdenes fijas ("toggle", "next",
 * "prev"): nada de lo que llega se ejecuta como código.
 *
 * Todo se queda en el PC: no se manda a ningún sitio.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { createInterface } from 'node:readline'
import { lowPriority } from './iconExtractor'

export interface NowPlaying {
  title: string
  artist: string
  /** App que lo reproduce, ya en limpio ("Spotify", "Chrome"...). */
  app: string
  playing: boolean
  /** Carátula como data:image/png;base64 (128x128), si la hay. */
  art?: string
}

export type MediaAction = 'toggle' | 'next' | 'prev'
export const MEDIA_ACTIONS: readonly MediaAction[] = ['toggle', 'next', 'prev']

const MAX_TEXT = 200
const MAX_ART_BASE64 = 160 * 1024
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/
const RESTART_MIN_MS = 5_000
const RESTART_MAX_MS = 120_000

const SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [Text.Encoding]::UTF8
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -AssemblyName System.Drawing
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation` + '`' + String.raw`1'
})[0]
function Await($op, [Type]$type) {
  $task = $asTask.MakeGenericMethod($type).Invoke($null, @($op))
  $null = $task.Wait(5000)
  $task.Result
}
$null = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
$null = [Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType = WindowsRuntime]
$mgr = Await ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager]::RequestAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager])

# PowerShell 5 no ve los métodos del flujo de WinRT ("__ComObject"): por reflexión, sí.
$asStream = [System.IO.WindowsRuntimeStreamExtensions].GetMethod('AsStreamForRead', [type[]]@([Windows.Storage.Streams.IInputStream]))
$artPx = 128

function Get-Art($props) {
  if (-not $props.Thumbnail) { return $null }
  $img = $null; $bmp = $null; $g = $null
  try {
    $ras = Await ($props.Thumbnail.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
    $img = [System.Drawing.Image]::FromStream($asStream.Invoke($null, @($ras)))
    $bmp = New-Object System.Drawing.Bitmap $artPx, $artPx
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $side = [Math]::Min($img.Width, $img.Height)
    $src = New-Object System.Drawing.Rectangle ([int](($img.Width - $side) / 2)), ([int](($img.Height - $side) / 2)), $side, $side
    $g.DrawImage($img, (New-Object System.Drawing.Rectangle 0, 0, $artPx, $artPx), $src, [System.Drawing.GraphicsUnit]::Pixel)
    $ms = New-Object System.IO.MemoryStream
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    return [Convert]::ToBase64String($ms.ToArray())
  } catch {
    return $null
  } finally {
    if ($g) { $g.Dispose() }; if ($bmp) { $bmp.Dispose() }; if ($img) { $img.Dispose() }
  }
}

# [Console]::In bloquea aunque se pida en asíncrono: un StreamReader propio no.
$stdin = New-Object System.IO.StreamReader ([Console]::OpenStandardInput()), ([Text.Encoding]::UTF8)
$pending = $stdin.ReadLineAsync()

# Qué enseñar si hay varias apps con sesión: lo que suena y trae artista primero
# (una pestaña del navegador sin datos no le quita el sitio a Spotify en pausa).
function Pick-Session {
  $best = $null; $bestScore = -1
  foreach ($c in $mgr.GetSessions()) {
    try {
      $p = Await ($c.TryGetMediaPropertiesAsync()) ([Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties])
      if (-not $p -or -not $p.Title) { continue }
      $score = 0
      if ([string]$c.GetPlaybackInfo().PlaybackStatus -eq 'Playing') { $score += 2 }
      if ($p.Artist) { $score += 3 }
      if ($score -gt $bestScore) { $best = @{ s = $c; p = $p }; $bestScore = $score }
    } catch {}
  }
  $best
}
$shown = $null
$lastKey = ''; $lastJson = ''; $art = $null; $artTries = 0; $tick = 0
while ($true) {
  if ($pending.IsCompleted) {
    $cmd = $pending.Result
    if ($null -eq $cmd) { break } # se cerró la entrada: la app se ha ido
    try {
      $s = if ($shown) { $shown } else { $mgr.GetCurrentSession() }
      if ($s) {
        switch ($cmd.Trim()) {
          'toggle' { $null = Await ($s.TryTogglePlayPauseAsync()) ([bool]) }
          'next' { $null = Await ($s.TrySkipNextAsync()) ([bool]) }
          'prev' { $null = Await ($s.TrySkipPreviousAsync()) ([bool]) }
        }
      }
    } catch {}
    $pending = $stdin.ReadLineAsync()
    $tick = 1
  }
  if ($tick -le 0) {
    $tick = 4
    $out = $null
    try {
      $pick = Pick-Session
      $shown = if ($pick) { $pick.s } else { $null }
      if ($pick) {
        $s = $pick.s; $p = $pick.p
        if ($p.Title) {
          $key = "$($s.SourceAppUserModelId)|$($p.Title)|$($p.Artist)"
          if ($key -ne $lastKey) { $lastKey = $key; $art = $null; $artTries = 0 }
          # La carátula a veces llega un poco después que el título.
          if (-not $art -and $artTries -lt 5) { $artTries++; $art = Get-Art $p }
          $playing = [string]$s.GetPlaybackInfo().PlaybackStatus -eq 'Playing'
          $out = [ordered]@{ title = $p.Title; artist = $p.Artist; app = $s.SourceAppUserModelId; playing = $playing; art = $art }
        }
      }
    } catch { $out = $null }
    $json = if ($out) { $out | ConvertTo-Json -Compress } else { 'null' }
    if ($json -ne $lastJson) {
      $lastJson = $json
      [Console]::Out.WriteLine($json)
      [Console]::Out.Flush()
    }
  }
  Start-Sleep -Milliseconds 250
  $tick--
}
`

/** Quita caracteres de control e invisibles y recorta. */
function cleanText(raw: unknown): string {
  if (typeof raw !== 'string') return ''
  return raw
    .normalize('NFC')
    .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TEXT)
}

/** "Spotify.exe" -> "Spotify", "Microsoft.ZuneMusic_8wekyb3d8bbwe!Microsoft.ZuneMusic" -> "ZuneMusic". */
export function appLabel(id: string): string {
  const last = id.split('!').pop() ?? id
  const base = last.replace(/\.exe$/i, '').split(/[\\/]/).pop() ?? last
  const parts = base.split('.')
  const name = parts[parts.length - 1] || base
  return cleanText(name.replace(/_[a-z0-9]{13}$/i, '')).slice(0, 40)
}

/** Interpreta una línea del script. Devuelve undefined si la línea no vale. */
export function parseNowPlaying(line: string): NowPlaying | null | undefined {
  let data: unknown
  try {
    data = JSON.parse(line)
  } catch {
    return undefined
  }
  if (data === null) return null
  if (!data || typeof data !== 'object') return undefined
  const r = data as Record<string, unknown>
  const title = cleanText(r.title)
  if (!title) return null
  const art =
    typeof r.art === 'string' && r.art.length <= MAX_ART_BASE64 && BASE64.test(r.art) ? `data:image/png;base64,${r.art}` : undefined
  return {
    title,
    artist: cleanText(r.artist),
    app: typeof r.app === 'string' ? appLabel(r.app) : '',
    playing: r.playing === true,
    ...(art ? { art } : {})
  }
}

/** Mismo contenido (para no avisar si no cambia nada). */
function same(a: NowPlaying | null, b: NowPlaying | null): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

let child: ChildProcess | null = null
let wanted = false
let current: NowPlaying | null = null
let restartDelay = RESTART_MIN_MS
let restartTimer: NodeJS.Timeout | null = null
const listeners = new Set<(now: NowPlaying | null) => void>()

export function onNowPlayingChange(cb: (now: NowPlaying | null) => void): void {
  listeners.add(cb)
}

export function nowPlaying(): NowPlaying | null {
  return current
}

function publish(next: NowPlaying | null): void {
  if (same(current, next)) return
  current = next
  for (const cb of listeners) cb(next)
}

function launch(): void {
  if (child || !wanted || process.platform !== 'win32') return
  const encoded = Buffer.from(SCRIPT, 'utf16le').toString('base64')
  const proc = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], {
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'ignore']
  })
  child = proc
  lowPriority(proc.pid)
  const startedAt = Date.now()

  createInterface({ input: proc.stdout! }).on('line', (line) => {
    const parsed = parseNowPlaying(line.trim())
    if (parsed !== undefined) publish(parsed)
  })
  proc.stdin?.on('error', () => {})
  proc.on('error', (err) => console.warn('[música] no se pudo arrancar PowerShell:', err.message))
  proc.on('exit', () => {
    if (child === proc) child = null
    publish(null)
    if (!wanted) return
    // Si duró un rato, el fallo es puntual: se reintenta pronto. Si no, cada vez más tarde.
    restartDelay = Date.now() - startedAt > 60_000 ? RESTART_MIN_MS : Math.min(restartDelay * 2, RESTART_MAX_MS)
    restartTimer = setTimeout(() => {
      restartTimer = null
      launch()
    }, restartDelay)
  })
}

/** Empieza (o deja) de vigilar lo que suena. */
export function setNowPlayingEnabled(enabled: boolean): void {
  if (enabled === wanted) return
  wanted = enabled
  if (enabled) {
    restartDelay = RESTART_MIN_MS
    launch()
    return
  }
  if (restartTimer) clearTimeout(restartTimer)
  restartTimer = null
  const proc = child
  child = null
  proc?.stdin?.end() // el script termina solo al cerrarse su entrada
  setTimeout(() => proc?.kill(), 2000)
  publish(null)
}

/** Pausa/reanuda o cambia de canción en la app que suena. */
export function mediaAction(action: MediaAction): void {
  if (!MEDIA_ACTIONS.includes(action)) return
  child?.stdin?.write(`${action}\n`)
}
