import { describe, expect, it } from 'vitest'
import { batteryNotice } from './battery'
import { parseConsentStore, privacyAppName } from './privacy'

const BASE = 'HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\CapabilityAccessManager\\ConsentStore'

describe('micro y cámara en uso', () => {
  it('solo cuenta las apps con LastUsedTimeStop a 0', () => {
    const out = [
      `${BASE}\\microphone\\NonPackaged\\C:#Users#Jose#AppData#Local#Discord#app-1.0.9251#Discord.exe`,
      '    LastUsedTimeStop    REG_QWORD    0x0',
      '',
      `${BASE}\\microphone\\NonPackaged\\C:#Program Files (x86)#Steam#steam.exe`,
      '    LastUsedTimeStop    REG_QWORD    0x1dd365ad64443d0',
      '',
      `${BASE}\\webcam\\Microsoft.WindowsCamera_8wekyb3d8bbwe`,
      '    LastUsedTimeStop    REG_QWORD    0x0',
      '',
      `${BASE}\\location\\NonPackaged\\C:#x#maps.exe`,
      '    LastUsedTimeStop    REG_QWORD    0x0',
      ''
    ].join('\r\n')
    expect(parseConsentStore(out)).toEqual({ mic: ['Discord'], camera: ['WindowsCamera'] })
  })

  it('nombres en limpio', () => {
    expect(privacyAppName('C:#Program Files#Google#Chrome#Application#chrome.exe')).toBe('chrome')
    expect(privacyAppName('Microsoft.ScreenSketch_8wekyb3d8bbwe')).toBe('ScreenSketch')
  })
})

describe('avisos de batería', () => {
  const none = new Set<number>()
  it('no avisa con la primera lectura ni en un PC sin batería', () => {
    expect(batteryNotice(null, { level: 0.05, charging: false }, none)).toBeNull()
    expect(batteryNotice({ level: 1, charging: false }, { level: 1, charging: true }, none)).toBeNull()
  })
  it('avisa al enchufar', () => {
    expect(batteryNotice({ level: 0.5, charging: false }, { level: 0.5, charging: true }, none)).toEqual({ kind: 'charging', level: 0.5 })
  })
  it('avisa al bajar del 20 % y del 10 %, una vez cada uno', () => {
    expect(batteryNotice({ level: 0.21, charging: false }, { level: 0.2, charging: false }, none)).toEqual({ kind: 'low', level: 0.2, threshold: 0.2 })
    expect(batteryNotice({ level: 0.21, charging: false }, { level: 0.2, charging: false }, new Set([0.2]))).toBeNull()
    expect(batteryNotice({ level: 0.25, charging: false }, { level: 0.08, charging: false }, none)).toEqual({ kind: 'low', level: 0.08, threshold: 0.1 })
  })
})
