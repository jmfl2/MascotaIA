/**
 * Decide si merece la pena ofrecer algo sobre el texto copiado.
 * Es deliberadamente conservador: ante la duda, el robot no dice nada.
 * (Sin dependencias de Electron, para poder probarlo.)
 */
import { getLang, type Lang } from '../../shared/i18n'
import { looksLikeUrl } from '../../security'

/** Hasta aquí, texto "corto": se ofrece buscar, traducir o guardar. */
export const MAX_OFFER_LENGTH = 300
/** Textos más largos (artículos, correos, código) se ofrecen para resumir o explicar con la IA. */
export const MAX_LONG_LENGTH = 20_000

/** Formatos que los gestores de contraseñas añaden para pedir que no se lea el portapapeles. */
export const PRIVATE_CLIPBOARD_FORMATS = [
  'ExcludeClipboardContentFromMonitorProcessing', // estándar de Windows (Bitwarden, 1Password...)
  'Clipboard Viewer Ignore', // KeePass y otros
  'CanIncludeInClipboardHistory' // si existe, se pidió no guardar en el historial
] as const

/** Patrones de claves y tokens conocidos. */
const SECRET_PATTERNS = [
  /^(?:sk|pk|rk)[-_][A-Za-z0-9_-]{16,}$/, // claves de API (OpenAI, Stripe...)
  /^gh[pousr]_[A-Za-z0-9]{20,}$/, // tokens de GitHub
  /^github_pat_[A-Za-z0-9_]{20,}$/,
  /^AKIA[0-9A-Z]{16}$/, // AWS
  /^xox[abprs]-[A-Za-z0-9-]{10,}$/, // Slack
  /^AIza[0-9A-Za-z_-]{30,}$/, // Google
  /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/, // JWT
  /-----BEGIN [A-Z ]*(?:PRIVATE KEY|CERTIFICATE)-----/
]

/** Secretos que pueden ir en mitad de un texto largo (un .env, un correo con una clave...). */
const SECRET_ANYWHERE = [
  /-----BEGIN [A-Z ]*(?:PRIVATE KEY|CERTIFICATE)-----/,
  /\b(?:sk|rk)[-_](?:live|test|proj)?[-_]?[A-Za-z0-9_-]{20,}/,
  /\bgh[pousr]_[A-Za-z0-9]{20,}/,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/,
  /\bAIza[0-9A-Za-z_-]{30,}/,
  /\beyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}/,
  /\b(?:password|passwd|contraseña|secret|api[_-]?key|token)\s*[:=]\s*\S{6,}/i
]

/** ¿Una sola "palabra" con aspecto de contraseña? (mezcla de tipos de carácter) */
function looksLikePassword(token: string): boolean {
  if (token.length < 8 || /\s/.test(token)) return false
  if (/^https?:\/\//i.test(token) || /^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(token)) return false
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(token)).length
  if (classes >= 3) return true
  // Cadenas largas aleatorias (hex, base64...) aunque usen solo 2 tipos.
  return token.length >= 20 && classes >= 2 && !/[aeiou]{1}.*[aeiou]/i.test(token.slice(0, 12))
}

export type OfferDecision =
  | { offer: true; kind: 'short' | 'long' | 'link'; text: string }
  | { offer: false; reason: string }

export function shouldOffer(raw: string): OfferDecision {
  const text = raw.trim()
  if (text.length < 2) return { offer: false, reason: 'muy corto' }
  if (text.length > MAX_LONG_LENGTH) return { offer: false, reason: 'demasiado largo' }
  // Un enlace suelto se analiza (detector de enlaces sospechosos), no se "ofrece".
  if (looksLikeUrl(text)) return { offer: true, kind: 'link', text }

  const isLong = text.length > MAX_OFFER_LENGTH || text.split(/\r?\n/).length > 4
  if (isLong) {
    if (SECRET_ANYWHERE.some((re) => re.test(text))) return { offer: false, reason: 'contiene una clave o un token' }
    if (text.split(/\s+/).length < 12) return { offer: false, reason: 'largo pero sin texto que resumir' }
    return { offer: true, kind: 'long', text }
  }

  if (SECRET_PATTERNS.some((re) => re.test(text))) return { offer: false, reason: 'parece una clave' }
  if (looksLikePassword(text)) return { offer: false, reason: 'parece una contraseña' }
  const digits = text.replace(/[\s\-.]/g, '')
  if (/^\d+$/.test(digits)) return { offer: false, reason: 'solo números (códigos, tarjetas, teléfonos)' }
  if (/^[A-Z]{2}\d{2}[A-Z0-9 ]{10,}$/.test(text.replace(/\s/g, ''))) return { offer: false, reason: 'parece un IBAN' }
  if (!/\p{L}/u.test(text)) return { offer: false, reason: 'sin letras' }
  return { offer: true, kind: 'short', text: text.replace(/\s+/g, ' ') }
}

const SPANISH_WORDS = new Set(['el', 'la', 'los', 'las', 'de', 'que', 'y', 'en', 'un', 'una', 'es', 'por', 'para', 'con', 'no', 'del', 'se', 'lo', 'como', 'más', 'pero', 'muy', 'está', 'hola', 'gracias'])

/**
 * Idioma al que traducir lo copiado.
 * - Interfaz en español: si parece español, al inglés; si no, al español.
 * - Interfaz en inglés: siempre al inglés.
 */
export function translateTarget(text: string, lang: Lang = getLang()): 'en' | 'es' {
  if (lang === 'en') return 'en'
  if (/[ñ¿¡áéíóú]/i.test(text)) return 'en'
  const words = text.toLowerCase().match(/\p{L}+/gu) ?? []
  const hits = words.filter((w) => SPANISH_WORDS.has(w)).length
  return hits >= 2 || (words.length <= 2 && hits >= 1) ? 'en' : 'es'
}
