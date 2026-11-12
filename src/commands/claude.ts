/**
 * Preguntar a Claude:
 * - Con una clave de API en los ajustes, Claude responde dentro de la barra
 *   (como la IA local; el chat lo lleva el proceso principal).
 * - Sin clave, se abre Claude con la pregunta ya escrita, con tu cuenta: en la
 *   app de escritorio si está instalada (o en claude.ai, según los ajustes).
 */
import { t } from '../shared/i18n'
import { sanitizeQuery } from './sanitize'
import type { CommandModule, Suggestion } from './types'
import type { WebCommandDef } from './web'

/** Asterisco de ocho puntas (genérico, no es el logotipo de nadie). */
export const CLAUDE_ICON = 'M12 3.5v17 M3.5 12h17 M6 6l12 12 M18 6L6 18'
const ACCENT = '#d97757'
const GREY = '#64748b'

/** claude.ai con la pregunta escrita. */
export const claudeWeb: WebCommandDef = {
  id: 'claude-web',
  name: 'Claude',
  prefixes: [],
  hint: { es: 'Preguntar en claude.ai', en: 'Ask on claude.ai' },
  placeholder: '',
  accent: ACCENT,
  iconPath: CLAUDE_ICON,
  allowedHosts: ['claude.ai'],
  buildUrl(query) {
    const url = new URL('https://claude.ai/new')
    url.searchParams.set('q', query)
    return url
  }
}

export const claude: CommandModule = {
  id: 'claude',
  name: 'Claude',
  prefixes: ['claude', 'cl'],
  get hint() {
    return t('Preguntar a Claude', 'Ask Claude')
  },
  get placeholder() {
    return t('Pregúntale a Claude…', 'Ask Claude…')
  },
  accent: ACCENT,
  iconPath: CLAUDE_ICON,
  suggest(query, ctx) {
    // Con clave: no hay filas, la barra enseña la conversación.
    if (ctx.claude.ready()) return []

    const q = sanitizeQuery(query)
    const keyHint: Suggestion = {
      title: t('¿Quieres que responda aquí mismo?', 'Want the answer right here?'),
      subtitle: t('Pon tu clave de API de Anthropic en Ajustes → General', 'Add your Anthropic API key in Settings → General'),
      icon: { kind: 'glyph', path: CLAUDE_ICON, accent: GREY },
      run: () => {
        ctx.openSettings()
        return { kind: 'close' }
      }
    }
    if (!q) {
      return [
        {
          title: t('Escribe tu pregunta', 'Type your question'),
          subtitle: t('Se abre Claude con ella ya escrita, con tu cuenta', 'Claude opens with it already typed, using your account'),
          disabled: true,
          run: () => ({ kind: 'error', message: t('Escribe la pregunta primero', 'Type the question first') })
        },
        keyHint
      ]
    }
    return [
      {
        title: q,
        subtitle: t('Claude · abrir con la pregunta escrita', 'Claude · open with the question typed'),
        run: () => ctx.claude.open(q)
      },
      keyHint
    ]
  }
}
