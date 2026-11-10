/** Nombres en español de las teclas de un acelerador de Electron. */
const KEY_NAMES: Record<string, string> = {
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
}

/** "Control+Shift+Space" -> "Ctrl+Mayús+Espacio" */
export function formatAccelerator(accelerator: string): string {
  return accelerator
    .split('+')
    .map((k) => KEY_NAMES[k] ?? k)
    .join('+')
}
