import { describe, expect, it } from 'vitest'
import { appLabel, nowPlaying, onNowPlayingChange, parseNowPlaying, setNowPlayingEnabled } from './nowPlaying'

describe('música: lo que llega del script', () => {
  it('lee la canción y limpia los textos', () => {
    expect(parseNowPlaying('{"title":"Tamam\\u202eTamam","artist":" Summer  Cem ","app":"Spotify.exe","playing":true,"art":null}')).toEqual({
      title: 'Tamam Tamam',
      artist: 'Summer Cem',
      app: 'Spotify',
      playing: true
    })
  })

  it('solo acepta carátulas en base64', () => {
    expect(parseNowPlaying('{"title":"a","artist":"","app":"x","playing":false,"art":"iVBORw0KGgo="}')?.art).toBe('data:image/png;base64,iVBORw0KGgo=')
    expect(parseNowPlaying('{"title":"a","app":"x","art":"\\"><script>"}')?.art).toBeUndefined()
  })

  it('nada sonando, líneas rotas o sin título', () => {
    expect(parseNowPlaying('null')).toBeNull()
    expect(parseNowPlaying('{"title":"   "}')).toBeNull()
    expect(parseNowPlaying('Exception: algo')).toBeUndefined()
  })

  it('nombre de la app en limpio', () => {
    expect(appLabel('Spotify.exe')).toBe('Spotify')
    expect(appLabel('Chrome')).toBe('Chrome')
    expect(appLabel('Microsoft.ZuneMusic_8wekyb3d8bbwe!Microsoft.ZuneMusic')).toBe('ZuneMusic')
    expect(appLabel('308046B0AF4A39CB')).toBe('308046B0AF4A39CB')
  })
})

/**
 * Contra Windows de verdad (necesita algo sonando o en pausa). Solo si se pide:
 *   set MEDIA_TEST=1 && npx vitest run src/main/services/nowPlaying.test.ts
 */
describe.skipIf(process.env.MEDIA_TEST !== '1')('música: Windows real', () => {
  it('lee la sesión actual', async () => {
    const first = new Promise((resolve) => onNowPlayingChange(resolve))
    setNowPlayingEnabled(true)
    await Promise.race([first, new Promise((r) => setTimeout(r, 15_000))])
    console.log('Suena:', { ...nowPlaying(), art: nowPlaying()?.art ? `${nowPlaying()!.art!.length} bytes` : undefined })
    setNowPlayingEnabled(false)
    expect(nowPlaying()).toBeNull()
  }, 20_000)
})
