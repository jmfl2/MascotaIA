import { describe, expect, it } from 'vitest'
import { analyzeLink, editDistance, looksLikeUrl, registrableDomain, skeleton } from './linkCheck'

const verdict = (url: string) => analyzeLink(url).verdict
const firstReason = (url: string) => analyzeLink(url).reasons[0]?.text ?? ''

describe('detector de enlaces: sin falsos positivos', () => {
  it.each([
    'https://www.google.com/search?q=gatos',
    'https://mail.google.com/mail/u/0/',
    'https://github.com/electron/electron',
    'https://www.paypal.com/es/signin',
    'https://www.bbva.es/personas.html',
    'https://www.amazon.es/dp/B0C1234567',
    'https://es.wikipedia.org/wiki/Rob%C3%B3tica',
    'https://www.bbc.co.uk/news',
    'https://midominio.github.io/portfolio',
    'https://www.elmundo.es/espana.html',
    'https://sede.agenciatributaria.gob.es/',
    'https://www.google-analytics.com/analytics.js',
    'https://login.microsoftonline.com/',
    'https://www.amazonas.gov.br/'
  ])('%s -> ok', (url) => {
    const r = analyzeLink(url)
    expect(r.reasons).toEqual([])
    expect(r.verdict).toBe('ok')
  })
})

describe('detector de enlaces: trampas', () => {
  it.each([
    ['https://paypa1.com/login', 'Imita a PayPal: cambia letras por números'],
    ['https://www.rnicrosoft.com', 'Imita a Microsoft: «rn» imita una «m»'],
    ['https://xn--pple-43d.com/', 'Imita a Apple: usa letras de otro alfabeto'],
    ['https://paypal.com.verificar-cuenta.net/', 'Parece de PayPal, pero el sitio real es verificar-cuenta.net'],
    ['https://santander-clientes.com/acceso', 'Mete el nombre de Santander en un dominio que no es suyo'],
    ['https://bbva-seguridad.top/', 'Mete el nombre de BBVA'],
    ['https://correosseguimientopaquete.com/pago', 'Combina el nombre de Correos con palabras de acceso o pago'],
    ['https://paypal.xyz/', 'Usa el nombre de PayPal, pero no es su dominio oficial'],
    ['https://www.google.com@evil.example/login', 'Esconde «www.google.com» antes de una @'],
    ['http://192.168.4.20/banca/login', 'Usa una dirección IP'],
    ['https://descargas.example.com/factura.pdf.exe', 'Disfraza un programa de documento'],
    ['javascript:alert(1)', 'Es un enlace de tipo «javascript»']
  ])('%s', (url, reason) => {
    expect(verdict(url)).toBe('danger')
    expect(firstReason(url)).toContain(reason)
  })

  it('avisa con precaución de señales leves', () => {
    expect(verdict('http://example.com/')).toBe('caution')
    expect(verdict('https://ofertas-unicas.xyz/')).toBe('caution')
    expect(firstReason('https://www.netflx.com/')).toContain('Se parece mucho a Netflix')
  })

  it('reconoce acortadores (el destino se mira aparte)', () => {
    const r = analyzeLink('https://bit.ly/3abcDEF')
    expect(r.isShortener).toBe(true)
    expect(r.verdict).toBe('ok')
    expect(r.reasons[0].severity).toBe('info')
  })

  it('acepta enlaces sin https://', () => {
    expect(analyzeLink('www.paypa1.com').verdict).toBe('danger')
  })
})

describe('utilidades', () => {
  it('reconoce cuándo lo copiado es un enlace', () => {
    expect(looksLikeUrl('https://example.com/x?y=1')).toBe(true)
    expect(looksLikeUrl('www.example.com')).toBe(true)
    expect(looksLikeUrl('example.com/ruta')).toBe(true)
    expect(looksLikeUrl('mira esto https://example.com')).toBe(false)
    expect(looksLikeUrl('receta de croquetas')).toBe(false)
  })

  it('dominio registrable con sufijos de dos niveles', () => {
    expect(registrableDomain('www.login.paypal.com.evil.co.uk')).toBe('evil.co.uk')
    expect(registrableDomain('a.b.example.com')).toBe('example.com')
  })

  it('esqueleto y distancia', () => {
    expect(skeleton('paypa1')).toBe(skeleton('paypal'))
    expect(skeleton('аpple')).toBe('apple') // "а" cirílica
    expect(editDistance('netflx', 'netflix')).toBe(1)
    expect(editDistance('paypla', 'paypal')).toBe(1) // transposición
  })
})

describe('desacortar', async () => {
  const { expandShortLink } = await import('./expand')

  /** Acortador falso: bit.ly -> tinyurl -> destino. Registra a quién se llama. */
  function fakeNet(map: Record<string, string>, calls: string[]) {
    return (async (url: string, init: RequestInit) => {
      calls.push(`${init.method} ${url}`)
      const location = map[url]
      return new Response(null, location ? { status: 301, headers: { location } } : { status: 200 })
    }) as unknown as typeof fetch
  }

  it('sigue la cadena de acortadores sin visitar el destino', async () => {
    const calls: string[] = []
    const net = fakeNet({ 'https://bit.ly/abc': 'https://tinyurl.com/xyz', 'https://tinyurl.com/xyz': 'https://paypa1.com/login' }, calls)
    const r = await expandShortLink('http://bit.ly/abc', net)
    expect(r).toEqual({ ok: true, finalUrl: 'https://paypa1.com/login', hops: ['https://bit.ly/abc', 'https://tinyurl.com/xyz'] })
    expect(calls.some((c) => c.includes('paypa1.com'))).toBe(false)
  })

  it('no hace ninguna petición si no es un acortador', async () => {
    const calls: string[] = []
    const r = await expandShortLink('https://example.com/', fakeNet({}, calls))
    expect(r.ok).toBe(true)
    expect(calls).toEqual([])
  })

  it('reintenta con GET si el acortador no acepta HEAD', async () => {
    const calls: string[] = []
    const net = (async (_url: string, init: RequestInit) => {
      calls.push(init.method!)
      return init.method === 'HEAD' ? new Response(null, { status: 405 }) : new Response(null, { status: 302, headers: { location: 'https://example.org/' } })
    }) as unknown as typeof fetch
    expect(await expandShortLink('https://t.co/q', net)).toMatchObject({ ok: true, finalUrl: 'https://example.org/' })
    expect(calls).toEqual(['HEAD', 'GET'])
  })

  it('informa si el acortador falla', async () => {
    const net = (async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof fetch
    expect(await expandShortLink('https://bit.ly/x', net)).toMatchObject({ ok: false, error: 'El acortador no respondió' })
  })
})
