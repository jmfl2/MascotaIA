import { describe, expect, it } from 'vitest'
import { parseIconOutput } from './iconExtractor'

describe('salida del extractor de iconos', () => {
  const targets = ['C:\\a.lnk', 'shell:AppsFolder\\App!X', 'C:\\c.lnk']

  it('asocia cada PNG a su elemento por el índice', () => {
    const icons = parseIconOutput('0\tiVBORw0KGgo=\r\n2\tQUJD\r\n', targets)
    expect(icons.get('C:\\a.lnk')).toBe('data:image/png;base64,iVBORw0KGgo=')
    expect(icons.get('C:\\c.lnk')).toBe('data:image/png;base64,QUJD')
    expect(icons.has('shell:AppsFolder\\App!X')).toBe(false)
  })

  it('descarta índices fuera de rango, basura y datos que no son base64', () => {
    const out = ['7\tQUJD', '-1\tQUJD', 'x\tQUJD', '1\t<script>', '1\tQU JD', 'ruido', '\tQUJD'].join('\n')
    expect(parseIconOutput(out, targets).size).toBe(0)
  })
})
