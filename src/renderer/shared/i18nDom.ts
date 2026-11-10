/**
 * Traduce los textos fijos del HTML. El HTML está en español y cada elemento
 * traducible lleva su versión inglesa en atributos:
 *   data-en="Settings"              -> textContent
 *   data-en-aria-label="Close"      -> aria-label
 *   data-en-title="Click it"        -> title
 *   data-en-placeholder="Search…"   -> placeholder
 */
import { getLang } from '../../shared/i18n'

const ATTRS = ['aria-label', 'title', 'placeholder'] as const

export function localizeDocument(root: ParentNode = document): void {
  const lang = getLang()
  document.documentElement.lang = lang
  if (lang === 'es') return

  root.querySelectorAll<HTMLElement>('[data-en]').forEach((el) => {
    el.textContent = el.dataset.en ?? el.textContent
  })
  for (const attr of ATTRS) {
    root.querySelectorAll<HTMLElement>(`[data-en-${attr}]`).forEach((el) => {
      const value = el.getAttribute(`data-en-${attr}`)
      if (value !== null) el.setAttribute(attr, value)
    })
  }
  const title = document.querySelector<HTMLTitleElement>('title[data-en]')
  if (title?.dataset.en) document.title = title.dataset.en
}
