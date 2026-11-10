/**
 * Comprobar un enlace antes de abrirlo: "link https://..." o "link" (usa el
 * portapapeles). Muestra el veredicto y los motivos; abrir es una fila aparte.
 */
import { t } from '../shared/i18n'
import { analyzeLink, looksLikeUrl, verdictTitle, type Reason } from '../security'
import type { CommandModule, Suggestion } from './types'

export const SHIELD_ICON = 'M12 3.5l7 2.8v5.2c0 4.3-2.9 7.7-7 9-4.1-1.3-7-4.7-7-9V6.3z M9 12l2.2 2.2L15.5 10'
const WARN_ICON = 'M12 4l8.5 15h-17z M12 10v4 M12 17v.01'
const INFO_ICON = 'M12 3.5a8.5 8.5 0 1 0 0 17a8.5 8.5 0 0 0 0-17z M12 11v5 M12 8v.01'
const OPEN_ICON = 'M14 5h5v5 M19 5l-8 8 M17 13.5V19H5V7h5.5'
const EXPAND_ICON = 'M9 15l6-6 M10 6.5l1-1a4 4 0 0 1 5.6 5.6l-1 1 M14 17.5l-1 1a4 4 0 0 1-5.6-5.6l1-1'

const COLORS = { ok: '#22c55e', caution: '#f59e0b', danger: '#ef4444', invalid: '#64748b' } as const
const SEVERITY_COLORS: Record<Reason['severity'], string> = { danger: '#ef4444', warn: '#f59e0b', info: '#64748b' }

export const link: CommandModule = {
  id: 'link',
  get name() {
    return t('Enlace', 'Link')
  },
  prefixes: ['link', 'enlace', 'url'],
  get hint() {
    return t('Comprobar si un enlace es de fiar', 'Check whether a link can be trusted')
  },
  get placeholder() {
    return t('Pega un enlace (o deja vacío para el del portapapeles)…', 'Paste a link (or leave empty for the one in the clipboard)…')
  },
  accent: '#22c55e',
  iconPath: SHIELD_ICON,
  async suggest(query, ctx) {
    let text = query.trim()
    if (!text) {
      const clip = (await ctx.clipboardText()).trim()
      if (looksLikeUrl(clip)) text = clip
    }
    if (!text) {
      return [
        {
          title: t('Pega un enlace para comprobarlo', 'Paste a link to check it'),
          subtitle: t(
            'Miro si imita a una marca, si esconde el destino y otras trampas típicas',
            'I check whether it imitates a brand, hides where it goes and other common tricks'
          ),
          disabled: true,
          run: () => ({ kind: 'error', message: t('Pega un enlace primero', 'Paste a link first') })
        }
      ]
    }

    const report = analyzeLink(text)
    if (report.verdict === 'invalid') {
      return [
        {
          title: t('No parece un enlace', 'That does not look like a link'),
          subtitle: text.slice(0, 120),
          disabled: true,
          run: () => ({ kind: 'error', message: t('No es un enlace válido', 'Not a valid link') })
        }
      ]
    }

    const rows: Suggestion[] = [
      {
        title: verdictTitle(report),
        subtitle: `${t('Sitio real', 'Real site')}: ${report.site || report.host}`,
        icon: { kind: 'glyph', path: SHIELD_ICON, accent: COLORS[report.verdict] },
        disabled: true,
        run: () => ({ kind: 'refresh' })
      },
      ...report.reasons.map<Suggestion>((r) => ({
        title: r.text,
        icon: { kind: 'glyph', path: r.severity === 'info' ? INFO_ICON : WARN_ICON, accent: SEVERITY_COLORS[r.severity] },
        disabled: true,
        run: () => ({ kind: 'refresh' })
      }))
    ]

    if (report.isShortener) {
      rows.push({
        title: t('Ver adónde lleva', 'See where it goes'),
        subtitle: t(`Pregunto solo a ${report.host}, sin abrir el destino`, `I only ask ${report.host}, without opening the destination`),
        icon: { kind: 'glyph', path: EXPAND_ICON, accent: '#3b82f6' },
        run: () => ctx.links.expand(report.url)
      })
    }
    // Con un enlace sospechoso, la opción por defecto (la primera que se puede
    // elegir, y la que coge Intro) es NO abrirlo.
    if (report.verdict !== 'ok') {
      rows.push({
        title: t('No abrir', "Don't open"),
        subtitle: t('Cerrar sin abrir el enlace', 'Close without opening the link'),
        icon: { kind: 'glyph', path: SHIELD_ICON, accent: '#22c55e' },
        run: () => ({ kind: 'close', mood: 'happy', toast: t('Mejor no abrirlo 👍', 'Better not to open it 👍') })
      })
    }
    rows.push({
      title: report.verdict === 'ok' ? `${t('Abrir', 'Open')} ${report.host}` : t('Abrir igualmente', 'Open anyway'),
      subtitle: report.verdict === 'ok' ? t('En tu navegador', 'In your browser') : t('Solo si estás seguro de que es de fiar', 'Only if you are sure it can be trusted'),
      icon: { kind: 'glyph', path: OPEN_ICON, accent: report.verdict === 'ok' ? '#3b82f6' : '#64748b' },
      run: () => ctx.links.open(report.url)
    })
    return rows
  }
}
