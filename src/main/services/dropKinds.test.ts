import { existsSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { dropOptions, kindOf, sendableToApi, zipName, type DroppedItem } from './dropKinds'
import { copyFilesToClipboard, zipFiles } from './fileActions'

const item = (name: string, kind: DroppedItem['kind'], size = 1000): DroppedItem => ({ path: `C:\\x\\${name}`, name, kind, size })

describe('soltar archivos: tipos', () => {
  it('reconoce cada cosa por su extensión', () => {
    expect(kindOf('C:\\a\\notas.md', false)).toBe('text')
    expect(kindOf('C:\\a\\app.TS', false)).toBe('text')
    expect(kindOf('C:\\a\\informe.pdf', false)).toBe('pdf')
    expect(kindOf('C:\\a\\foto.JPG', false)).toBe('image')
    expect(kindOf('C:\\a\\Spotify.lnk', false)).toBe('shortcut')
    expect(kindOf('C:\\a\\fotos', true)).toBe('folder')
    expect(kindOf('C:\\a\\tabla.xlsx', false)).toBe('other')
  })

  it('solo se manda a la API lo que cabe', () => {
    expect(sendableToApi(item('a.png', 'image', 4_000_000))).toBe(true)
    expect(sendableToApi(item('a.png', 'image', 6_000_000))).toBe(false)
    expect(sendableToApi(item('a.xlsx', 'other'))).toBe(false)
  })
})

describe('soltar archivos: opciones', () => {
  it('un archivo de texto: preguntar, resumir (con la IA local), favoritos y ruta', () => {
    expect(dropOptions([item('a.md', 'text')], { localAiReady: true })).toEqual(['ask', 'summarize', 'favorite', 'copyPath'])
    expect(dropOptions([item('a.md', 'text')], { localAiReady: false })).toEqual(['ask', 'favorite', 'copyPath'])
  })

  it('una imagen o un PDF: preguntar primero, sin resumir', () => {
    expect(dropOptions([item('a.png', 'image')], { localAiReady: true })).toEqual(['ask', 'favorite', 'copyPath'])
    expect(dropOptions([item('a.pdf', 'pdf')], { localAiReady: true })).toEqual(['ask', 'favorite', 'copyPath'])
  })

  it('varios archivos: preguntar y comprimir', () => {
    expect(dropOptions([item('a.png', 'image'), item('b.pdf', 'pdf')], { localAiReady: true })).toEqual(['ask', 'zip', 'favorite', 'copyPath'])
  })

  it('una carpeta o un acceso directo: favoritos primero, como antes', () => {
    expect(dropOptions([item('fotos', 'folder', 0)], { localAiReady: true })).toEqual(['favorite', 'zip', 'copyPath'])
    expect(dropOptions([item('Spotify.lnk', 'shortcut')], { localAiReady: true })).toEqual(['favorite', 'copyPath'])
  })

  it('nombre libre para el .zip', () => {
    const taken = new Set(['Archivos.zip', 'Archivos (2).zip'])
    expect(zipName('Archivos', (n) => taken.has(n))).toBe('Archivos (3).zip')
    expect(zipName('mis:fotos?', () => false)).toBe('misfotos.zip')
  })
})

/**
 * Con PowerShell de verdad (escribe en una carpeta temporal y CAMBIA el
 * portapapeles). Solo si se pide: set FILES_TEST=1 && npx vitest run src/main/services/dropKinds.test.ts
 */
describe.skipIf(process.env.FILES_TEST !== '1')('soltar archivos: Windows real', () => {
  it('comprime y copia archivos con nombres raros', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'mascota-drop-'))
    try {
      const a = join(dir, "informe [final] & 'copia'.txt")
      const b = join(dir, 'año 2026 $(whoami).md')
      writeFileSync(a, 'hola')
      writeFileSync(b, 'adiós')
      const dest = join(dir, 'Archivos.zip')
      await zipFiles([a, b], dest)
      expect(existsSync(dest)).toBe(true)
      expect(statSync(dest).size).toBeGreaterThan(100)
      await copyFilesToClipboard([a, b])
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }, 60_000)
})
