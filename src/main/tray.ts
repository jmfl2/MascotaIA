/** Icono de la bandeja del sistema: el único control visible de la app. */
import { Menu, nativeImage, Tray, type MenuItemConstructorOptions } from 'electron'
import type { AiStatus } from '../commands'
import { formatAccelerator } from '../shared/accelerator'
import { assetPath } from './paths'
import { currentShortcut, SHORTCUT_PRESETS } from './shortcut'
import { setStartsWithWindows, startsWithWindows } from './startup'

export interface TrayActions {
  toggleRobot(): void
  isRobotVisible(): boolean
  openBar(): void
  changeShortcut(accelerator: string): boolean
  isClipboardEnabled(): boolean
  setClipboardEnabled(enabled: boolean): void
  isPomodoroRunning(): boolean
  stopPomodoro(): void
  aiStatus(): AiStatus
  setAiModel(model: string): void
  startOllama(): void
  pullModel(): void
  freeAiMemory(): void
  openSettings(): void
  robotName(): string
  /** Tras cambiar algo desde el menú (para que la ventana de ajustes se entere). */
  changed(): void
  quit(): void
}

const AI_STATE_LABEL: Record<AiStatus['state'], string> = {
  checking: 'Comprobando…',
  ready: 'Lista',
  'not-installed': 'Ollama no está instalado',
  'not-running': 'Ollama está parado',
  'no-model': 'Falta el modelo',
  pulling: 'Descargando el modelo…'
}

/** Submenú "IA local": estado, modelo y acciones para arreglarlo. */
function aiMenu(actions: TrayActions): MenuItemConstructorOptions[] {
  const s = actions.aiStatus()
  const items: MenuItemConstructorOptions[] = [
    { label: `Estado: ${AI_STATE_LABEL[s.state]}${s.state === 'pulling' ? ` ${Math.round((s.progress ?? 0) * 100)} %` : ''}`, enabled: false },
    { label: `Modelo: ${s.model}`, enabled: false }
  ]
  if (s.state === 'not-running') items.push({ label: 'Iniciar Ollama', click: () => actions.startOllama() })
  if (s.state === 'no-model') items.push({ label: `Descargar ${s.model}`, click: () => actions.pullModel() })
  if (s.state === 'ready') items.push({ label: 'Liberar memoria', click: () => actions.freeAiMemory() })
  if (s.models.length > 1 || (s.models.length === 1 && !s.models.includes(s.model))) {
    items.push(
      { type: 'separator' },
      { label: 'Usar modelo', enabled: false },
      ...s.models.map((m) => ({
        label: m,
        type: 'radio' as const,
        checked: m === s.model || m === `${s.model}:latest`,
        click: () => actions.setAiModel(m)
      }))
    )
  }
  return items
}

let tray: Tray | null = null


export function createTray(actions: TrayActions): { tray: Tray; rebuild: () => void } {
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
        click: (item) => {
          actions.setClipboardEnabled(item.checked)
          actions.changed()
        }
      },
      { label: 'IA local', submenu: aiMenu(actions) },
      ...(actions.isPomodoroRunning()
        ? [{ label: 'Detener pomodoro', click: () => actions.stopPomodoro() }]
        : []),
      {
        label: 'Iniciar con Windows',
        type: 'checkbox',
        checked: startsWithWindows(),
        click: (item) => {
          setStartsWithWindows(item.checked)
          actions.changed()
        }
      },
      { type: 'separator' },
      { label: 'Ajustes…', click: () => actions.openSettings() },
      { type: 'separator' },
      { label: 'Salir', click: () => actions.quit() }
    ])
    tray?.setContextMenu(menu)
    tray?.setToolTip(actions.robotName())
  }

  rebuild()
  // El menú se rehace al abrirlo, para que refleje el estado actual (pomodoro...).
  tray.on('right-click', rebuild)
  // Clic izquierdo: mostrar u ocultar el robot.
  tray.on('click', () => {
    actions.toggleRobot()
    rebuild()
  })
  return { tray, rebuild }
}
