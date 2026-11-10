/**
 * Comprobación completa de un enlace: análisis local y, si es un acortador,
 * análisis de su destino real (preguntando solo al acortador).
 */
import { t } from '../shared/i18n'
import { expandShortLink } from './expand'
import { analyzeLink, type LinkReport } from './linkCheck'

export { analyzeLink, looksLikeUrl, verdictTitle, type LinkReport, type Reason, type Verdict } from './linkCheck'

export interface FullReport extends LinkReport {
  /** Si era un acortador: la URL acortada original. */
  shortUrl?: string
}

export async function checkLink(text: string, fetchFn: typeof fetch = fetch): Promise<FullReport> {
  const first = analyzeLink(text)
  if (!first.isShortener || first.verdict === 'invalid') return first

  const expanded = await expandShortLink(first.url, fetchFn)
  if (!expanded.ok) {
    return {
      ...first,
      verdict: first.verdict === 'danger' ? 'danger' : 'caution',
      reasons: [{ severity: 'warn', text: t(`${expanded.error}: no sé adónde lleva`, `${expanded.error}: I don't know where it goes`) }, ...first.reasons]
    }
  }
  const final = analyzeLink(expanded.finalUrl)
  return {
    ...final,
    shortUrl: first.url,
    reasons: [...final.reasons, { severity: 'info', text: t(`Enlace acortado: en realidad lleva a ${final.host}`, `Shortened link: it actually goes to ${final.host}`) }]
  }
}

/** Texto para el bocadillo: los motivos más importantes, uno por línea. */
export function reasonsText(report: LinkReport, max = 3): string {
  return report.reasons
    .slice(0, max)
    .map((r) => `• ${r.text}`)
    .join('\n')
}
