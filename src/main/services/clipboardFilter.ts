/**
 * Decide si merece la pena ofrecer algo sobre el texto copiado.
 * Es deliberadamente conservador: ante la duda, el robot no dice nada.
 * (Sin dependencias de Electron, para poder probarlo.)
 */

export const MAX_OFFER_LENGTH = 300

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

/** ¿Una sola "palabra" con aspecto de contraseña? (mezcla de tipos de carácter) */
function looksLikePassword(token: string): boolean {
  if (token.length < 8 || /\s/.test(token)) return false
  if (/^https?:\/\//i.test(token) || /^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(token)) return false
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(token)).length
  if (classes >= 3) return true
  // Cadenas largas aleatorias (hex, base64...) aunque usen solo 2 tipos.
  return token.length >= 20 && classes >= 2 && !/[aeiou]{1}.*[aeiou]/i.test(token.slice(0, 12))
}

export type OfferDecision = { offer: true; text: string } | { offer: false; reason: string }

export function shouldOffer(raw: string): OfferDecision {
  const text = raw.trim()
  if (text.length < 2) return { offer: false, reason: 'muy corto' }
  if (text.length > MAX_OFFER_LENGTH) return { offer: false, reason: 'muy largo' }
  if (text.split(/\r?\n/).length > 4) return { offer: false, reason: 'varias líneas (código o tabla)' }
  if (SECRET_PATTERNS.some((re) => re.test(text))) return { offer: false, reason: 'parece una clave' }
  if (looksLikePassword(text)) return { offer: false, reason: 'parece una contraseña' }
  const digits = text.replace(/[\s\-.]/g, '')
  if (/^\d+$/.test(digits)) return { offer: false, reason: 'solo números (códigos, tarjetas, teléfonos)' }
  if (/^[A-Z]{2}\d{2}[A-Z0-9 ]{10,}$/.test(text.replace(/\s/g, ''))) return { offer: false, reason: 'parece un IBAN' }
  if (!/\p{L}/u.test(text)) return { offer: false, reason: 'sin letras' }
  return { offer: true, text: text.replace(/\s+/g, ' ') }
}

const SPANISH_WORDS = new Set(['el', 'la', 'los', 'las', 'de', 'que', 'y', 'en', 'un', 'una', 'es', 'por', 'para', 'con', 'no', 'del', 'se', 'lo', 'como', 'más', 'pero', 'muy', 'está', 'hola', 'gracias'])

/** Idioma al que traducir: si parece español, al inglés; si no, al español. */
export function translateTarget(text: string): 'en' | 'es' {
  if (/[ñ¿¡áéíóú]/i.test(text)) return 'en'
  const words = text.toLowerCase().match(/\p{L}+/gu) ?? []
  const hits = words.filter((w) => SPANISH_WORDS.has(w)).length
  return hits >= 2 || (words.length <= 2 && hits >= 1) ? 'en' : 'es'
}
