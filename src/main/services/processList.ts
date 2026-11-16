/**
 * Lee la salida de `tasklist /FO CSV /NH` (sin Electron, para poder probarla).
 *
 * Cada línea: "nombre.exe","PID","Sesión","Nº de sesión","Memoria". La memoria
 * viene con el separador de miles del idioma ("1.268 KB", "1,268 K").
 */
import type { ProcessGroup } from '../../commands/types'

/** Del sistema: cerrarlos cuelga o reinicia Windows (o no se puede). */
const PROTECTED = new Set(
  [
    'system idle process', 'system', 'secure system', 'registry', 'memory compression', 'smss.exe', 'csrss.exe',
    'wininit.exe', 'winlogon.exe', 'services.exe', 'lsass.exe', 'lsaiso.exe', 'svchost.exe', 'dwm.exe',
    'fontdrvhost.exe', 'sihost.exe', 'ctfmon.exe', 'conhost.exe', 'runtimebroker.exe', 'taskhostw.exe',
    'dllhost.exe', 'searchhost.exe', 'startmenuexperiencehost.exe', 'shellexperiencehost.exe',
    'textinputhost.exe', 'securityhealthsystray.exe', 'msmpeng.exe', 'nissrv.exe', 'audiodg.exe',
    'tasklist.exe', 'taskkill.exe', 'wudfhost.exe', 'lockapp.exe', 'userinit.exe', 'smartscreen.exe'
  ]
)

function parseLine(line: string): string[] | null {
  const cells = line.trim().match(/"([^"]*)"/g)
  return cells && cells.length >= 5 ? cells.map((c) => c.slice(1, -1)) : null
}

/** Agrupa por programa los procesos de tu sesión (no los de servicios), sin los del sistema ni `excludeImage` (Mascota). */
export function parseTasklist(output: string, excludeImage = ''): ProcessGroup[] {
  const groups = new Map<string, ProcessGroup>()
  for (const line of output.split(/\r?\n/)) {
    const cells = parseLine(line)
    if (!cells) continue
    const [image, pidText, , sessionText, memText] = cells
    const pid = Number(pidText)
    const session = Number(sessionText)
    if (!image || !Number.isInteger(pid) || session === 0) continue
    if (PROTECTED.has(image.toLowerCase()) || image.toLowerCase() === excludeImage.toLowerCase()) continue
    const memoryKb = Number(memText.replace(/\D/g, '')) || 0
    const key = image.toLowerCase()
    const group = groups.get(key) ?? { name: image.replace(/\.exe$/i, ''), image, pids: [], memoryKb: 0 }
    group.pids.push(pid)
    group.memoryKb += memoryKb
    groups.set(key, group)
  }
  return [...groups.values()].sort((a, b) => b.memoryKb - a.memoryKb)
}
