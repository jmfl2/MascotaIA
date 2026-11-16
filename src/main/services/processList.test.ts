import { describe, expect, it } from 'vitest'
import { parseTasklist } from './processList'

const OUTPUT = [
  '"System","4","Services","0","1.268 KB"',
  '"svchost.exe","900","Console","1","12.000 KB"',
  '"chrome.exe","100","Console","1","200.000 KB"',
  '"chrome.exe","101","Console","1","50.500 KB"',
  '"notepad.exe","300","Console","1","9,876 K"',
  '"Mascota.exe","400","Console","1","90.000 KB"',
  '"sqlservr.exe","500","Services","0","500.000 KB"',
  ''
].join('\r\n')

describe('lista de procesos', () => {
  it('agrupa por programa, suma memoria y ordena de más a menos', () => {
    const groups = parseTasklist(OUTPUT, 'Mascota.exe')
    expect(groups).toEqual([
      { name: 'chrome', image: 'chrome.exe', pids: [100, 101], memoryKb: 250_500 },
      { name: 'notepad', image: 'notepad.exe', pids: [300], memoryKb: 9876 }
    ])
  })
})
