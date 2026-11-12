/**
 * Qué se puede hacer con lo que sueltas encima del robot, según el tipo de
 * cada cosa (sin Electron, para poder probarlo).
 */
import { extname } from 'node:path'

export type DropKind = 'text' | 'pdf' | 'image' | 'shortcut' | 'folder' | 'other'

export interface DroppedItem {
  path: string
  name: string
  kind: DropKind
  /** Bytes (0 en carpetas). */
  size: number
}

export type DropOption = 'ask' | 'summarize' | 'zip' | 'favorite' | 'copyPath'

const TEXT_EXT = new Set([
  '.txt', '.md', '.markdown', '.csv', '.tsv', '.json', '.jsonl', '.xml', '.yml', '.yaml', '.toml', '.ini', '.log',
  '.html', '.htm', '.css', '.scss', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.vue', '.svelte',
  '.py', '.java', '.kt', '.c', '.h', '.cpp', '.hpp', '.cs', '.go', '.rs', '.php', '.rb', '.swift', '.sql',
  '.sh', '.ps1', '.bat', '.cmd', '.lua', '.r', '.dart', '.tex', '.srt'
])
const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp'])
const SHORTCUT_EXT = new Set(['.lnk', '.url', '.appref-ms', '.exe'])

/** Lo más grande que se manda a la IA. */
export const MAX_TEXT_BYTES = 400 * 1024
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_PDF_BYTES = 20 * 1024 * 1024

export function kindOf(path: string, isDirectory: boolean): DropKind {
  if (isDirectory) return 'folder'
  const ext = extname(path).toLowerCase()
  if (TEXT_EXT.has(ext)) return 'text'
  if (ext === '.pdf') return 'pdf'
  if (IMAGE_EXT.has(ext)) return 'image'
  if (SHORTCUT_EXT.has(ext)) return 'shortcut'
  return 'other'
}

/** ¿Se le puede mandar este archivo a Claude por la API (tipo y tamaño)? */
export function sendableToApi(item: DroppedItem): boolean {
  if (item.kind === 'text') return item.size <= MAX_TEXT_BYTES
  if (item.kind === 'image') return item.size <= MAX_IMAGE_BYTES
  if (item.kind === 'pdf') return item.size <= MAX_PDF_BYTES
  return false
}

/**
 * Opciones del bocadillo, en orden (la primera es la principal).
 * - Preguntar a la IA: si todo son archivos (no carpetas ni accesos directos).
 * - Resumir con la IA local: un único archivo de texto, si la IA local está lista.
 * - Comprimir: varias cosas, o una carpeta.
 * - Favoritos y copiar la ruta: siempre.
 */
export function dropOptions(items: readonly DroppedItem[], opts: { localAiReady: boolean }): DropOption[] {
  if (!items.length) return []
  const out: DropOption[] = []
  const allFiles = items.every((i) => i.kind !== 'folder' && i.kind !== 'shortcut')
  if (allFiles) out.push('ask')
  if (items.length === 1 && items[0].kind === 'text' && opts.localAiReady && items[0].size <= MAX_TEXT_BYTES) out.push('summarize')
  if (items.length > 1 || items[0].kind === 'folder') out.push('zip')
  out.push('favorite', 'copyPath')
  // Un acceso directo o una carpeta suelta: lo más probable es querer tenerlo a mano.
  if (!allFiles && items.length === 1) return ['favorite', ...out.filter((o) => o !== 'favorite')]
  return out
}

/** Nombre libre para el .zip junto a los archivos: "Archivos.zip", "Archivos (2).zip"... */
export function zipName(base: string, exists: (name: string) => boolean): string {
  const clean = base.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim().slice(0, 80) || 'Archivos'
  if (!exists(`${clean}.zip`)) return `${clean}.zip`
  for (let n = 2; n < 1000; n++) {
    if (!exists(`${clean} (${n}).zip`)) return `${clean} (${n}).zip`
  }
  return `${clean} ${Date.now()}.zip`
}
