import { getLang } from '../shared/i18n'
import { webCommand } from './web'


/**
 * "trad en: buenos días" -> traduce al inglés.
 * El código de idioma va seguido de dos puntos para no confundirlo con
 * palabras normales ("en casa" no cambia el idioma).
 */
const TARGET_PATTERN = /^([a-z]{2,3}(?:-[a-z]{2,4})?):\s*(.+)$/i

/**
 * Separa el idioma de destino opcional del texto que hay que traducir.
 * Sin idioma, se traduce al de la interfaz.
 */
export function parseTranslation(query: string): { target: string; text: string } {
  const match = TARGET_PATTERN.exec(query)
  if (match) return { target: match[1].toLowerCase(), text: match[2] }
  return { target: getLang(), text: query }
}

/** Traducción con Google Translate (idioma de origen automático). */
export const translate = webCommand({
  id: 'translate',
  name: { es: 'Traductor', en: 'Translate' },
  prefixes: ['trad', 'tr', 'translate'],
  hint: { es: 'Traducir texto (trad en: hola)', en: 'Translate text (tr es: hello)' },
  placeholder: { es: 'Texto a traducir (o "en: texto")…', en: 'Text to translate (or "es: text")…' },
  accent: '#f59e0b',
  iconPath: 'M4 5.5h9 M8.5 4v1.5 M11 5.5c-.6 3.6-3 6.4-6.5 8 M6.5 9c1.2 2 3 3.4 5 4.2 M12.5 20l3.5-8.5l3.5 8.5 M13.7 17.2h4.6',
  allowedHosts: ['translate.google.com'],
  buildUrl(query) {
    const { target, text } = parseTranslation(query)
    const url = new URL('https://translate.google.com/')
    url.searchParams.set('sl', 'auto')
    url.searchParams.set('tl', target)
    url.searchParams.set('text', text)
    url.searchParams.set('op', 'translate')
    return url
  }
})
