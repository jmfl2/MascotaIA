/**
 * Detector de enlaces sospechosos. Funciona sin conexión: solo mira el texto
 * del enlace (la expansión de acortadores es aparte, en el proceso principal).
 *
 * Nunca dice "seguro": como mucho, "no veo señales de alarma".
 */
import { domainToUnicode } from 'node:url'
import { BRANDS, EXECUTABLE_EXT, MULTI_PART_SUFFIXES, PHISHING_WORDS, RISKY_TLDS, SHORTENERS, type Brand } from './brands'

export type Severity = 'info' | 'warn' | 'danger'
export type Verdict = 'ok' | 'caution' | 'danger' | 'invalid'

export interface Reason {
  severity: Severity
  text: string
}

export interface LinkReport {
  verdict: Verdict
  /** URL normalizada (o el texto tal cual si no se pudo leer). */
  url: string
  /** Dominio tal y como lo vería una persona (con caracteres Unicode). */
  host: string
  /** Dominio "real" (registrable): lo que de verdad importa. */
  site: string
  reasons: Reason[]
  isShortener: boolean
}

// --- Utilidades --------------------------------------------------------------

/** ¿El texto es un único enlace? (lo que se copia de la barra del navegador o de un mensaje) */
export function looksLikeUrl(text: string): boolean {
  const t = text.trim()
  if (!t || /\s/.test(t) || t.length > 2000) return false
  return /^(?:https?:\/\/|www\.)[^\s]+$/i.test(t) || /^(?:[a-z0-9-]+\.)+[a-z]{2,}\/\S*$/i.test(t)
}

/** Lee el enlace añadiendo https:// si falta. */
export function parseUrl(text: string): URL | null {
  const t = text.trim()
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(t) ? t : `https://${t}`
  try {
    return new URL(withScheme)
  } catch {
    return null
  }
}

/** Dominio registrable: "www.login.paypal.com.evil.co.uk" -> "evil.co.uk". */
export function registrableDomain(hostname: string): string {
  const labels = hostname.toLowerCase().replace(/\.$/, '').split('.')
  if (labels.length <= 2) return labels.join('.')
  const lastTwo = labels.slice(-2).join('.')
  return MULTI_PART_SUFFIXES.has(lastTwo) ? labels.slice(-3).join('.') : lastTwo
}

/** El nombre del sitio sin TLD: "evil.co.uk" -> "evil". */
function siteLabel(site: string): string {
  return site.split('.')[0]
}

const IPV4 = /^(\d{1,3})(\.\d{1,3}){3}$/
function isIpHost(hostname: string): boolean {
  return IPV4.test(hostname) || hostname.startsWith('[') || /^\d+$/.test(hostname) || /^0x[0-9a-f]+$/i.test(hostname)
}

/** Letras de otros alfabetos que parecen latinas (homógrafos). */
const CONFUSABLES: Record<string, string> = {
  а: 'a', в: 'b', е: 'e', ё: 'e', і: 'i', ї: 'i', ј: 'j', к: 'k', м: 'm', н: 'h', о: 'o', р: 'p', с: 'c', т: 't',
  у: 'y', х: 'x', ѕ: 's', ԁ: 'd', ɡ: 'g', ӏ: 'l', α: 'a', ο: 'o', ρ: 'p', ν: 'v', ι: 'i', κ: 'k', τ: 't', υ: 'u',
  χ: 'x', ε: 'e', ı: 'i', ł: 'l', ɑ: 'a', ʀ: 'r'
}
/** Cambios típicos para imitar letras con números o con dos letras. */
const LOOKALIKES: Array<[RegExp, string]> = [
  [/rn/g, 'm'],
  [/vv/g, 'w'],
  [/0/g, 'o'],
  [/1/g, 'l'],
  [/3/g, 'e'],
  [/4/g, 'a'],
  [/5/g, 's'],
  [/7/g, 't'],
  [/\$/g, 's'],
  [/-/g, '']
]

/** "Esqueleto" de un nombre: cómo se ve, quitando trucos visuales. */
export function skeleton(label: string): string {
  let s = label.toLowerCase().normalize('NFKC')
  s = [...s].map((ch) => CONFUSABLES[ch] ?? ch).join('')
  s = s.normalize('NFD').replace(/\p{M}/gu, '')
  for (const [re, to] of LOOKALIKES) s = s.replace(re, to)
  // "l" e "i" se confunden entre sí (paypai, paypal)
  return s.replace(/i/g, 'l')
}

/** Distancia de edición con transposiciones (Damerau-Levenshtein simplificada). */
export function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)] as number[])
  for (let j = 0; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[a.length][b.length]
}

function isOfficial(site: string, hostname: string, brand: Brand): boolean {
  return brand.domains.some((d) => site === d || hostname === d || hostname.endsWith(`.${d}`))
}

/** ¿Es el dominio oficial de alguna marca conocida? */
function officialBrand(site: string, hostname: string): Brand | undefined {
  return BRANDS.find((b) => isOfficial(site, hostname, b))
}

/** Explica en palabras qué truco visual se usó. */
function describeTrick(label: string, brand: Brand): string {
  if (/[^\x00-\x7f]/.test(label)) return `usa letras de otro alfabeto que parecen las de «${brand.label}»`
  if (/\d/.test(label)) return `cambia letras por números («${label}» en vez de «${brand.label}»)`
  if (label.includes('rn') && brand.label.includes('m')) return `«rn» imita una «m» («${label}»)`
  return `«${label}» en vez de «${brand.label}»`
}

// --- Análisis --------------------------------------------------------------------

export function analyzeLink(text: string): LinkReport {
  const url = parseUrl(text)
  if (!url) {
    return { verdict: 'invalid', url: text, host: '', site: '', reasons: [{ severity: 'warn', text: 'No es un enlace válido' }], isShortener: false }
  }

  const reasons: Reason[] = []
  const add = (severity: Severity, t: string) => reasons.push({ severity, text: t })
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '')
  const unicodeHost = domainToUnicode(hostname) || hostname
  const site = isIpHost(hostname) ? hostname : registrableDomain(hostname)
  const tld = hostname.split('.').pop() ?? ''
  const isShortener = SHORTENERS.has(hostname) || SHORTENERS.has(site)

  // 1. Tipo de enlace
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    add('danger', `Es un enlace de tipo «${url.protocol.replace(':', '')}», que puede ejecutar código o abrir archivos`)
    return finish()
  }
  if (url.protocol === 'http:') add('warn', 'No usa conexión cifrada (http en vez de https)')

  // 2. Usuario escondido antes de @: "https://paypal.com@evil.net"
  if (url.username || url.password) {
    add('danger', `Esconde «${decodeURIComponent(url.username)}» antes de una @: el sitio real es ${unicodeHost}`)
  }

  // 3. IP en vez de nombre
  if (isIpHost(hostname)) add('danger', 'Usa una dirección IP en lugar de un nombre de dominio')

  // 4. Puerto raro
  if (url.port && !['80', '443'].includes(url.port)) add('warn', `Usa un puerto poco habitual (${url.port})`)

  const official = isIpHost(hostname) ? undefined : officialBrand(site, hostname)

  if (!isIpHost(hostname) && !official) {
    const label = siteLabel(domainToUnicode(site) || site)
    const sk = skeleton(label)

    // 5. Punycode / alfabetos mezclados
    if (hostname.split('.').some((l) => l.startsWith('xn--'))) {
      add('warn', `El dominio tiene caracteres especiales: se ve como «${unicodeHost}»`)
    }

    // 6. Suplantación de marcas
    let impersonated = false
    for (const brand of BRANDS) {
      const b = brand.label
      if (label === b) {
        add('danger', `Usa el nombre de ${brand.name}, pero no es su dominio oficial (${brand.domains[0]})`)
        impersonated = true
        break
      }
      if (sk === skeleton(b)) {
        add('danger', `Imita a ${brand.name}: ${describeTrick(label, brand)}`)
        impersonated = true
        break
      }
      const tokens = label.split(/[-_.]/)
      if (b.length >= 4 && tokens.length > 1 && tokens.some((t) => t === b || skeleton(t) === skeleton(b))) {
        add('danger', `Mete el nombre de ${brand.name} en un dominio que no es suyo (${site})`)
        impersonated = true
        break
      }
      if (b.length >= 5 && sk.includes(skeleton(b)) && PHISHING_WORDS.some((w) => sk.includes(skeleton(w)))) {
        add('danger', `Combina el nombre de ${brand.name} con palabras de acceso o pago en un dominio ajeno`)
        impersonated = true
        break
      }
      const dist = editDistance(label, b)
      if (b.length >= 5 && dist > 0 && dist <= (b.length >= 9 ? 2 : 1)) {
        add('warn', `Se parece mucho a ${brand.name} (${brand.domains[0]}): comprueba que es el sitio que buscas`)
        impersonated = true
        break
      }
    }

    // 7. Marca en un subdominio: "paypal.com.verificar.net"
    if (!impersonated) {
      const sub = hostname.slice(0, Math.max(0, hostname.length - site.length - 1))
      const brandInSub = BRANDS.find((b) => sub.split(/[.-]/).some((part) => part === b.label || skeleton(part) === skeleton(b.label)))
      if (brandInSub) add('danger', `Parece de ${brandInSub.name}, pero el sitio real es ${site}`)
    }

    // 8. TLD de riesgo
    if (RISKY_TLDS.has(tld)) add('warn', `Termina en «.${tld}», un dominio muy usado en estafas`)

    // 9. Dominio rebuscado
    const depth = hostname.split('.').length
    if (depth >= 5) add('warn', 'Tiene muchos subdominios encadenados')
    if (hostname.length > 45) add('warn', 'El dominio es inusualmente largo')
    if ((siteLabel(site).match(/-/g) ?? []).length >= 3) add('warn', 'El dominio tiene muchos guiones')

    // 10. Palabras de phishing en el dominio
    const words = PHISHING_WORDS.filter((w) => hostname.includes(w))
    if (words.length && !impersonated) add('warn', `El dominio incluye «${words[0]}», típico de páginas que piden datos`)
  }

  // 11. Acortador
  if (isShortener) add('info', `Es un enlace acortado (${hostname}): no se ve adónde lleva`)

  // 12. Descarga de un programa
  const path = decodeURIComponent(url.pathname)
  if (EXECUTABLE_EXT.test(path)) {
    const double = /\.(pdf|docx?|xlsx?|jpe?g|png|txt|zip)\.[a-z0-9]+$/i.test(path)
    add(double ? 'danger' : 'warn', double ? 'Disfraza un programa de documento (doble extensión)' : 'Descarga un programa ejecutable')
  }

  return finish()

  function finish(): LinkReport {
    const dangers = reasons.filter((r) => r.severity === 'danger').length
    const warns = reasons.filter((r) => r.severity === 'warn').length
    const verdict: Verdict = dangers > 0 || warns >= 3 ? 'danger' : warns > 0 ? 'caution' : 'ok'
    // Lo más grave primero.
    const order: Record<Severity, number> = { danger: 0, warn: 1, info: 2 }
    reasons.sort((a, b) => order[a.severity] - order[b.severity])
    return { verdict, url: url!.href, host: unicodeHost, site, reasons, isShortener }
  }
}

/** Resumen de una línea para títulos. */
export function verdictTitle(report: LinkReport): string {
  switch (report.verdict) {
    case 'danger':
      return '🚨 Este enlace parece una trampa'
    case 'caution':
      return '⚠️ Ojo con este enlace'
    case 'invalid':
      return 'No parece un enlace'
    case 'ok':
      return report.isShortener ? '🔗 Enlace acortado' : '🔗 No veo señales de alarma'
  }
}
