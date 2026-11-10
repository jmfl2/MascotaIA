import { getLang, type Lang } from './i18n'

/** Nombres de las teclas de un acelerador de Electron, en cada idioma. */
const KEY_NAMES: Record<Lang, Record<string, string>> = {
  es: {
    Control: 'Ctrl',
    CommandOrControl: 'Ctrl',
    CmdOrCtrl: 'Ctrl',
    Ctrl: 'Ctrl',
    Alt: 'Alt',
    Shift: 'Mayús',
    Super: 'Win',
    Meta: 'Win',
    Space: 'Espacio',
    Return: 'Intro',
    Enter: 'Intro',
    Escape: 'Esc'
  },
  en: {
    Control: 'Ctrl',
    CommandOrControl: 'Ctrl',
    CmdOrCtrl: 'Ctrl',
    Ctrl: 'Ctrl',
    Alt: 'Alt',
    Shift: 'Shift',
    Super: 'Win',
    Meta: 'Win',
    Space: 'Space',
    Return: 'Enter',
    Enter: 'Enter',
    Escape: 'Esc'
  }
}

/** "Control+Shift+Space" -> "Ctrl+Mayús+Espacio" (o "Ctrl+Shift+Space" en inglés) */
export function formatAccelerator(accelerator: string): string {
  const names = KEY_NAMES[getLang()]
  return accelerator
    .split('+')
    .map((k) => names[k] ?? k)
    .join('+')
}
