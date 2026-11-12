/**
 * Acciones con archivos que Electron no sabe hacer solo, con PowerShell:
 * - Copiarlos al portapapeles como archivos (igual que Ctrl+C en el Explorador),
 *   para pegarlos en el chat de una IA con Ctrl+V.
 * - Comprimirlos en un .zip.
 *
 * Las rutas van por la entrada estándar, una por línea, y el script solo las
 * usa como rutas literales (-LiteralPath): nunca forman parte del código.
 */
import { spawn } from 'node:child_process'
import { lowPriority } from './iconExtractor'

const COPY_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [Text.Encoding]::UTF8
$paths = @([Console]::In.ReadToEnd() -split "\r?\n" | Where-Object { $_ })
Set-Clipboard -LiteralPath $paths
`

const ZIP_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [Text.Encoding]::UTF8
$lines = @([Console]::In.ReadToEnd() -split "\r?\n" | Where-Object { $_ })
$dest = $lines[0]
$paths = $lines[1..($lines.Length - 1)]
Compress-Archive -LiteralPath $paths -DestinationPath $dest -CompressionLevel Optimal
`

function run(script: string, lines: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const encoded = Buffer.from(script, 'utf16le').toString('base64')
    const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], {
      windowsHide: true,
      stdio: ['pipe', 'ignore', 'pipe']
    })
    lowPriority(child.pid)
    let stderr = ''
    child.stderr?.on('data', (d: Buffer) => {
      stderr += d.toString()
    })
    const timer = setTimeout(() => child.kill(), timeoutMs)
    child.on('error', (err) => {
      clearTimeout(timer)
      reject(err)
    })
    child.on('exit', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve()
      else reject(new Error(stderr.split(/\r?\n/).find((l) => l.trim()) ?? `PowerShell salió con ${code}`))
    })
    child.stdin?.end(`${lines.join('\n')}\n`, 'utf8')
  })
}

/** Rutas sin saltos de línea (no podrían ir una por línea). */
function safe(paths: string[]): string[] {
  return paths.filter((p) => p && !/[\r\n]/.test(p))
}

/** Deja los archivos en el portapapeles, listos para pegar. */
export function copyFilesToClipboard(paths: string[]): Promise<void> {
  return run(COPY_SCRIPT, safe(paths), 15_000)
}

/** Comprime en `dest` (un .zip que aún no existe). */
export function zipFiles(paths: string[], dest: string): Promise<void> {
  return run(ZIP_SCRIPT, [dest, ...safe(paths)], 10 * 60_000)
}
