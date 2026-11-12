import { describe, expect, it } from 'vitest'
import { isNewer, LATEST_RELEASE_API, parseVersion, pickUpdate } from './updateCheck'

const SHA = 'a'.repeat(64)
const release = (tag: string, asset: Record<string, unknown> = {}) => ({
  tag_name: tag,
  html_url: `https://github.com/jmfl2/MascotaIA/releases/tag/${tag}`,
  draft: false,
  prerelease: false,
  assets: [
    {
      name: 'Mascota-Setup.exe',
      size: 121_580_441,
      digest: `sha256:${SHA}`,
      browser_download_url: `https://github.com/jmfl2/MascotaIA/releases/download/${tag}/Mascota-Setup.exe`,
      ...asset
    }
  ]
})

describe('actualizaciones: versiones', () => {
  it('compara versiones', () => {
    expect(parseVersion('v0.10.2')).toEqual([0, 10, 2])
    expect(parseVersion('v1.0.0-beta')).toBeNull()
    expect(isNewer('0.3.0', '0.2.0')).toBe(true)
    expect(isNewer('0.10.0', '0.9.9')).toBe(true)
    expect(isNewer('0.2.0', '0.2.0')).toBe(false)
    expect(isNewer('0.1.9', '0.2.0')).toBe(false)
  })
})

describe('actualizaciones: qué se acepta', () => {
  it('una versión nueva con su instalador y su huella', () => {
    expect(pickUpdate(release('v0.3.0'), '0.2.0')).toEqual({
      version: '0.3.0',
      url: 'https://github.com/jmfl2/MascotaIA/releases/download/v0.3.0/Mascota-Setup.exe',
      size: 121_580_441,
      sha256: SHA,
      page: 'https://github.com/jmfl2/MascotaIA/releases/tag/v0.3.0'
    })
  })

  it('nada que hacer si es la misma, una más vieja, un borrador o una de prueba', () => {
    expect(pickUpdate(release('v0.2.0'), '0.2.0')).toBeNull()
    expect(pickUpdate(release('v0.1.0'), '0.2.0')).toBeNull()
    expect(pickUpdate({ ...release('v0.3.0'), draft: true }, '0.2.0')).toBeNull()
    expect(pickUpdate({ ...release('v0.3.0'), prerelease: true }, '0.2.0')).toBeNull()
    expect(pickUpdate(release('v0.3.0-beta'), '0.2.0')).toBeNull()
  })

  it('rechaza instaladores de otro sitio, sin huella o con tamaño raro', () => {
    expect(() => pickUpdate(release('v0.3.0', { browser_download_url: 'https://evil.example/Mascota-Setup.exe' }), '0.2.0')).toThrow()
    expect(() => pickUpdate(release('v0.3.0', { browser_download_url: 'https://github.com/otro/repo/releases/download/v0.3.0/Mascota-Setup.exe' }), '0.2.0')).toThrow()
    expect(() => pickUpdate(release('v0.3.0', { digest: null }), '0.2.0')).toThrow()
    expect(() => pickUpdate(release('v0.3.0', { digest: 'md5:abc' }), '0.2.0')).toThrow()
    expect(() => pickUpdate(release('v0.3.0', { size: 1000 }), '0.2.0')).toThrow()
    expect(() => pickUpdate({ ...release('v0.3.0'), assets: [] }, '0.2.0')).toThrow()
  })
})

/** Contra GitHub de verdad. Solo si se pide: set UPDATE_TEST=1 && npx vitest run src/main/services/updateCheck.test.ts */
describe.skipIf(process.env.UPDATE_TEST !== '1')('actualizaciones: GitHub real', () => {
  it('la última release se puede instalar', async () => {
    const res = await fetch(LATEST_RELEASE_API, { headers: { 'User-Agent': 'Mascota-updater' } })
    const update = pickUpdate(await res.json(), '0.0.1')
    console.log('Última:', update)
    expect(update?.sha256).toMatch(/^[0-9a-f]{64}$/)
  })
})
