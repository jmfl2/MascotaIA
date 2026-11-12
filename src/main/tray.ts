/** Icono de la bandeja del sistema: el único control visible de la app. */
import { Menu, nativeImage, Tray, type MenuItemConstructorOptions } from 'electron'
import type { AiStatus } from '../commands'
import type { UpdateView } from '../shared/appearance'
import { formatAccelerator } from '../shared/accelerator'
import { t } from '../shared/i18n'
import { assetPath } from './paths'
import { currentShortcut, SHORTCUT_PRESETS } from './shortcut'
import { setStartsWithWindows, startsWithWindows } from './startup'

export interface TrayActions {
  toggleRobot(): void
  isRobotVisible(): boolean
  isDocked(): boolean
  setDocked(docked: boolean): void
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
  updateState(): UpdateView
  checkForUpdates(): void
  installUpdate(): void
  robotName(): string
  /** Tras cambiar algo desde el menú (para que la ventana de ajustes se entere). */
  changed(): void
  quit(): void
}

const aiStateLabel = (state: AiStatus['state']): string =>
  ({
    checking: t('Comprobando…', 'Checking…'),
    ready: t('Lista', 'Ready'),
    'not-installed': t('Ollama no está instalado', 'Ollama is not installed'),
    'not-running': t('Ollama está parado', 'Ollama is stopped'),
    'no-model': t('Falta el modelo', 'Model missing'),
    pulling: t('Descargando el modelo…', 'Downloading the model…')
  })[state]

/** Submenú "IA local": estado, modelo y acciones para arreglarlo. */
function aiMenu(actions: TrayActions): MenuItemConstructorOptions[] {
  const s = actions.aiStatus()
  const items: MenuItemConstructorOptions[] = [
    { label: `${t('Estado', 'Status')}: ${aiStateLabel(s.state)}${s.state === 'pulling' ? ` ${Math.round((s.progress ?? 0) * 100)} %` : ''}`, enabled: false },
    { label: `${t('Modelo', 'Model')}: ${s.model}`, enabled: false }
  ]
  if (s.state === 'not-running') items.push({ label: t('Iniciar Ollama', 'Start Ollama'), click: () => actions.startOllama() })
  if (s.state === 'no-model') items.push({ label: `${t('Descargar', 'Download')} ${s.model}`, click: () => actions.pullModel() })
  if (s.state === 'ready') items.push({ label: t('Liberar memoria', 'Free memory'), click: () => actions.freeAiMemory() })
  if (s.models.length > 1 || (s.models.length === 1 && !s.models.includes(s.model))) {
    items.push(
      { type: 'separator' },
      { label: t('Usar modelo', 'Use model'), enabled: false },
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

/** "Buscar actualizaciones" o, si ya hay una descargada, "Reiniciar para actualizar". */
function updateItems(actions: TrayActions): MenuItemConstructorOptions[] {
  const u = actions.updateState()
  switch (u.state) {
    case 'dev':
      return []
    case 'ready':
      return [{ label: t(`Reiniciar y actualizar a ${u.version}`, `Restart and update to ${u.version}`), click: () => actions.installUpdate() }]
    case 'downloading':
      return [{ label: t(`Descargando ${u.version}… ${Math.round(u.progress * 100)} %`, `Downloading ${u.version}… ${Math.round(u.progress * 100)} %`), enabled: false }]
    case 'checking':
      return [{ label: t('Buscando actualizaciones…', 'Checking for updates…'), enabled: false }]
    default:
      return [{ label: t('Buscar actualizaciones', 'Check for updates'), click: () => actions.checkForUpdates() }]
  }
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
        label: actions.isDocked()
          ? actions.isRobotVisible() ? t('Ocultar pestaña', 'Hide tab') : t('Mostrar pestaña', 'Show tab')
          : actions.isRobotVisible() ? t('Ocultar robot', 'Hide robot') : t('Mostrar robot', 'Show robot'),
        click: () => {
          actions.toggleRobot()
          rebuild()
        }
      },
      {
        label: t('Esconder en una pestaña arriba', 'Hide in a tab at the top'),
        type: 'checkbox',
        checked: actions.isDocked(),
        click: (item) => {
          actions.setDocked(item.checked)
          actions.changed()
          rebuild()
        }
      },
      {
        label: t('Abrir barra de comandos', 'Open command bar'),
        accelerator: shortcut,
        registerAccelerator: false, // ya es global; aquí solo se muestra
        click: () => actions.openBar()
      },
      {
        label: t('Atajo de teclado', 'Keyboard shortcut'),
        submenu: [
          ...SHORTCUT_PRESETS.map((preset) => ({
            label: formatAccelerator(preset),
            type: 'radio' as const,
            checked: preset === shortcut,
            click: () => {
              if (!actions.changeShortcut(preset)) {
                tray?.displayBalloon({
                  title: t('Atajo no disponible', 'Shortcut unavailable'),
                  content: t(`${formatAccelerator(preset)} lo está usando otra aplicación.`, `${formatAccelerator(preset)} is being used by another app.`),
                  iconType: 'warning'
                })
              }
              rebuild()
            }
          })),
          ...(SHORTCUT_PRESETS.includes(shortcut as (typeof SHORTCUT_PRESETS)[number])
            ? []
            : [{ label: `${formatAccelerator(shortcut)} ${t('(personalizado)', '(custom)')}`, type: 'radio' as const, checked: true }])
        ]
      },
      { type: 'separator' },
      {
        label: t('Portapapeles inteligente', 'Smart clipboard'),
        type: 'checkbox',
        checked: actions.isClipboardEnabled(),
        click: (item) => {
          actions.setClipboardEnabled(item.checked)
          actions.changed()
        }
      },
      { label: t('IA local', 'Local AI'), submenu: aiMenu(actions) },
      ...(actions.isPomodoroRunning()
        ? [{ label: t('Detener pomodoro', 'Stop pomodoro'), click: () => actions.stopPomodoro() }]
        : []),
      {
        label: t('Iniciar con Windows', 'Start with Windows'),
        type: 'checkbox',
        checked: startsWithWindows(),
        click: (item) => {
          setStartsWithWindows(item.checked)
          actions.changed()
        }
      },
      { type: 'separator' },
      ...updateItems(actions),
      { label: t('Ajustes…', 'Settings…'), click: () => actions.openSettings() },
      { type: 'separator' },
      { label: t('Salir', 'Quit'), click: () => actions.quit() }
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
