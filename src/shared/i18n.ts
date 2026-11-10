/**
 * Idioma de la interfaz (español o inglés).
 *
 * Los textos viven junto al código que los usa, en parejas: `t('Hola', 'Hello')`.
 * Así no hay un diccionario de claves que se desincronice. El idioma actual es
 * un valor de módulo:
 * - En el proceso principal lo fija `setLang()` al arrancar (desde config.json)
 *   y cada vez que se cambia en los ajustes; los textos se calculan al usarlos.
 * - En las páginas llega del preload (`window.mascota.lang`); al cambiar de
 *   idioma, el proceso principal las recarga.
 */

export type Lang = 'es' | 'en'

export const LANGUAGES: readonly { id: Lang; name: string }[] = [
  { id: 'es', name: 'Español' },
  { id: 'en', name: 'English' }
]

/** Un texto en los dos idiomas. */
export interface Text {
  es: string
  en: string
}

export function isLang(v: unknown): v is Lang {
  return v === 'es' || v === 'en'
}

/** "es-ES", "es-419"... -> 'es'; cualquier otro idioma -> 'en'. */
export function langFromLocale(locale: string | undefined): Lang {
  return locale?.toLowerCase().startsWith('es') ? 'es' : 'en'
}

function initialLang(): Lang {
  const fromPreload = (globalThis as { mascota?: { lang?: unknown } }).mascota?.lang
  return isLang(fromPreload) ? fromPreload : 'es'
}

let current: Lang = initialLang()

export function getLang(): Lang {
  return current
}

export function setLang(lang: Lang): void {
  current = lang
}

/** Elige el texto del idioma actual. */
export function t(es: string, en: string): string {
  return current === 'en' ? en : es
}

/** Un texto fijo (igual en los dos idiomas) o uno traducido. */
export type Localized = string | Text

/** Elige el texto del idioma actual de un `Localized`. */
export function tx(text: Localized): string {
  return typeof text === 'string' ? text : text[current]
}
