/**
 * Prueba contra un acortador real. Solo se ejecuta si se pide:
 *   set NET_TEST=1 && npx vitest run src/security/expand.integration.test.ts
 */
import { describe, expect, it } from 'vitest'
import { checkLink } from './index'

describe.skipIf(process.env.NET_TEST !== '1')('acortador real', () => {
  it('youtu.be lleva a youtube.com (sin visitar YouTube)', { timeout: 15_000 }, async () => {
    const calls: string[] = []
    const spy = ((url: string, init: RequestInit) => {
      calls.push(url)
      return fetch(url, init)
    }) as typeof fetch
    const report = await checkLink('https://youtu.be/dQw4w9WgXcQ', spy)
    console.log(`  ${report.shortUrl} -> ${report.url} (${report.verdict})\n  peticiones: ${calls.join(', ')}`)
    expect(report.shortUrl).toBe('https://youtu.be/dQw4w9WgXcQ')
    expect(report.host).toBe('www.youtube.com')
    expect(report.verdict).toBe('ok')
    expect(calls.every((u) => new URL(u).hostname === 'youtu.be')).toBe(true)
  })
})
