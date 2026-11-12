/**
 * Qué versión hay publicada en GitHub y si se puede instalar (sin Electron,
 * para poder probarlo). La descarga y la instalación están en ../updater.ts.
 *
 * Solo se acepta el instalador de las releases de este repositorio, con el
 * nombre de siempre y con su huella SHA-256 (la calcula GitHub al subirlo):
 * después de descargarlo se comprueba que coincide antes de ejecutarlo.
 */

export const REPO = 'jmfl2/MascotaIA'
export const ASSET_NAME = 'Mascota-Setup.exe'
export const LATEST_RELEASE_API = `https://api.github.com/repos/${REPO}/releases/latest`
const DOWNLOAD_PREFIX = `https://github.com/${REPO}/releases/download/`
/** Un instalador de verdad pesa más de 10 MB y menos de 1 GB. */
const MIN_SIZE = 10 * 1024 * 1024
const MAX_SIZE = 1024 * 1024 * 1024

export interface AvailableUpdate {
  version: string
  url: string
  size: number
  /** Huella SHA-256 en hexadecimal (minúsculas). */
  sha256: string
  /** Página de la release, por si hay que mandar al usuario allí. */
  page: string
}

/** "v0.3.0" -> [0, 3, 0]; null si no es una versión normal (las de prueba, "-beta", no cuentan). */
export function parseVersion(raw: string): [number, number, number] | null {
  const m = /^v?(\d{1,4})\.(\d{1,4})\.(\d{1,4})$/.exec(raw.trim())
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

export function isNewer(candidate: string, current: string): boolean {
  const a = parseVersion(candidate)
  const b = parseVersion(current)
  if (!a || !b) return false
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i]
  return false
}

/**
 * Lee la respuesta de la API de GitHub. Devuelve la actualización si hay una
 * versión más nueva con un instalador válido; null si no hay nada que hacer.
 * Lanza un error si la release es más nueva pero no se puede instalar sola.
 */
export function pickUpdate(release: unknown, currentVersion: string): AvailableUpdate | null {
  if (!release || typeof release !== 'object') throw new Error('respuesta rara de GitHub')
  const r = release as Record<string, unknown>
  if (r.draft === true || r.prerelease === true) return null
  const tag = typeof r.tag_name === 'string' ? r.tag_name : ''
  const version = parseVersion(tag)?.join('.')
  if (!version || !isNewer(version, currentVersion)) return null

  const page = typeof r.html_url === 'string' && r.html_url.startsWith(`https://github.com/${REPO}/`) ? r.html_url : `https://github.com/${REPO}/releases/latest`
  const assets = Array.isArray(r.assets) ? (r.assets as Array<Record<string, unknown>>) : []
  const asset = assets.find((a) => a.name === ASSET_NAME)
  if (!asset) throw new Error('la release no trae el instalador')

  const url = asset.browser_download_url
  const size = asset.size
  const digest = asset.digest
  if (typeof url !== 'string' || !url.startsWith(DOWNLOAD_PREFIX) || !url.endsWith(`/${ASSET_NAME}`)) {
    throw new Error('dirección de descarga no permitida')
  }
  if (typeof size !== 'number' || size < MIN_SIZE || size > MAX_SIZE) throw new Error('tamaño del instalador raro')
  const sha = typeof digest === 'string' ? /^sha256:([0-9a-f]{64})$/i.exec(digest)?.[1] : undefined
  if (!sha) throw new Error('GitHub no da la huella del instalador')

  return { version, url, size, sha256: sha.toLowerCase(), page }
}
