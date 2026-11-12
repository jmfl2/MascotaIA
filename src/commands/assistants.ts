/**
 * Preguntar a otras IAs en su web: se abre la página con la pregunta ya escrita,
 * con la cuenta que tengas iniciada en el navegador. No necesita claves.
 *
 *   gpt ¿qué es una API REST?      -> chatgpt.com
 *   pplx mejores portátiles 2026   -> perplexity.ai
 *   gemini resume este texto       -> gemini.google.com (copia la pregunta: hay que pegarla)
 *
 * Claude tiene su propio comando (claude.ts): puede responder dentro de la barra.
 */
import { t } from '../shared/i18n'
import { sanitizeQuery } from './sanitize'
import type { CommandModule } from './types'
import { webCommand } from './web'

/** Burbuja de chat con una chispa: icono común de los asistentes. */
export const ASSISTANT_ICON = 'M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8.5a1.5 1.5 0 0 1-1.5 1.5H10l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5z M12 8.5l.8 2l2 .8l-2 .8l-.8 2l-.8-2l-2-.8l2-.8z'

export const chatgpt = webCommand({
  id: 'chatgpt',
  name: 'ChatGPT',
  prefixes: ['gpt', 'chatgpt'],
  hint: { es: 'Preguntar a ChatGPT en su web', en: 'Ask ChatGPT on its website' },
  placeholder: { es: 'Pregunta para ChatGPT…', en: 'Question for ChatGPT…' },
  accent: '#10a37f',
  iconPath: ASSISTANT_ICON,
  allowedHosts: ['chatgpt.com'],
  global: false,
  buildUrl(query) {
    const url = new URL('https://chatgpt.com/')
    url.searchParams.set('q', query)
    return url
  }
})

export const perplexity = webCommand({
  id: 'perplexity',
  name: 'Perplexity',
  prefixes: ['pplx', 'perplexity'],
  hint: { es: 'Buscar con IA y fuentes', en: 'AI search with sources' },
  placeholder: { es: 'Pregunta para Perplexity…', en: 'Question for Perplexity…' },
  accent: '#20808d',
  iconPath: ASSISTANT_ICON,
  allowedHosts: ['www.perplexity.ai'],
  global: false,
  buildUrl(query) {
    const url = new URL('https://www.perplexity.ai/search')
    url.searchParams.set('q', query)
    return url
  }
})

const GEMINI_URL = 'https://gemini.google.com/app'

/**
 * Gemini no acepta la pregunta en la dirección: se copia al portapapeles y se
 * abre la web para pegarla con Ctrl+V.
 */
export const gemini: CommandModule = {
  id: 'gemini',
  name: 'Gemini',
  prefixes: ['gemini', 'gem'],
  get hint() {
    return t('Preguntar a Gemini en su web', 'Ask Gemini on its website')
  },
  get placeholder() {
    return t('Pregunta para Gemini…', 'Question for Gemini…')
  },
  accent: '#4285f4',
  iconPath: ASSISTANT_ICON,
  suggest(query, ctx) {
    const q = sanitizeQuery(query)
    if (!q) return []
    return [
      {
        title: q,
        subtitle: t('Gemini · copio la pregunta y la pegas con Ctrl+V', 'Gemini · I copy the question, paste it with Ctrl+V'),
        run: async () => {
          ctx.copyText(q)
          const outcome = await ctx.openUrl(GEMINI_URL)
          return outcome.kind === 'close' ? { ...outcome, toast: t('Pregunta copiada: pégala con Ctrl+V', 'Question copied: paste it with Ctrl+V') } : outcome
        }
      }
    ]
  }
}
