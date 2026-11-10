/** Icono de la bandeja del sistema: el único control visible de la app. */
import { app, Menu, nativeImage, Tray } from 'electron'
import { formatAccelerator } from '../shared/accelerator'
import { assetPath } from './paths'
import { currentShortcut, SHORTCUT_PRESETS } from './shortcut'

export interface TrayActions {
  toggleRobot(): void
  isRobotVisible(): boolean
  openBar(): void
  changeShortcut(accelerator: string): boolean
  isClipboardEnabled(): boolean
  setClipboardEnabled(enabled: boolean): void
  isPomodoroRunning(): boolean
  stopPomodoro(): void
  quit(): void
}

let tray: Tray | null = null

// --- Iniciar con Windows ------------------------------------------------------
// En desarrollo el ejecutable es electron.exe y hay que pasarle la ruta del
// proyecto; empaquetada, la app se lanza a sí misma.
function loginItemOptions() {
  return app.isPackaged ? {} : { path: process.execPath, args: [app.getAppPath()] }
}

function startsWithWindows(): boolean {
  return app.getLoginItemSettings(loginItemOptions()).openAtLogin
}

function setStartsWithWindows(enabled: boolean): void {
  app.setLoginItemSettings({ openAtLogin: enabled, ...loginItemOptions() })
}

export function createTray(actions: TrayActions): Tray {
  // tray.png (16 px) y tray@2x.png (32 px): Electron elige según el escalado.
  const icon = nativeImage.createFromPath(assetPath('tray.png'))
  tray = new Tray(icon)
  tray.setToolTip('Mascota')

  const rebuild = () => {
    const shortcut = currentShortcut()
    const menu = Menu.buildFromTemplate([
      {
        label: actions.isRobotVisible() ? 'Ocultar robot' : 'Mostrar robot',
        click: () => {
          actions.toggleRobot()
          rebuild()
        }
      },
      {
        label: 'Abrir barra de comandos',
        accelerator: shortcut,
        registerAccelerator: false, // ya es global; aquí solo se muestra
        click: () => actions.openBar()
      },
      {
        label: 'Atajo de teclado',
        submenu: [
          ...SHORTCUT_PRESETS.map((preset) => ({
            label: formatAccelerator(preset),
            type: 'radio' as const,
            checked: preset === shortcut,
            click: () => {
              if (!actions.changeShortcut(preset)) {
                tray?.displayBalloon({
                  title: 'Atajo no disponible',
                  content: `${formatAccelerator(preset)} lo está usando otra aplicación.`,
                  iconType: 'warning'
                })
              }
              rebuild()
            }
          })),
          ...(SHORTCUT_PRESETS.includes(shortcut as (typeof SHORTCUT_PRESETS)[number])
            ? []
            : [{ label: `${formatAccelerator(shortcut)} (personalizado)`, type: 'radio' as const, checked: true }])
        ]
      },
      { type: 'separator' },
      {
        label: 'Portapapeles inteligente',
        type: 'checkbox',
        checked: actions.isClipboardEnabled(),
        click: (item) => actions.setClipboardEnabled(item.checked)
      },
      ...(actions.isPomodoroRunning()
        ? [{ label: 'Detener pomodoro', click: () => actions.stopPomodoro() }]
        : []),
      {
        label: 'Iniciar con Windows',
        type: 'checkbox',
        checked: startsWithWindows(),
        click: (item) => setStartsWithWindows(item.checked)
      },
      { type: 'separator' },
      { label: 'Salir', click: () => actions.quit() }
    ])
    tray?.setContextMenu(menu)
  }

  rebuild()
  // El menú se rehace al abrirlo, para que refleje el estado actual (pomodoro...).
  tray.on('right-click', rebuild)
  // Clic izquierdo: mostrar u ocultar el robot.
  tray.on('click', () => {
    actions.toggleRobot()
    rebuild()
  })
  return tray
}
