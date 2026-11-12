/**
 * Contrato de comunicación entre procesos (IPC).
 * Lo comparten el proceso principal, el preload y los renderers para que
 * los nombres de canal y los tipos no se desincronicen.
 */
import type { IconSpec } from '../commands/types'
import type { Appearance, SettingsPatch, SettingsView } from './appearance'
import type { Lang } from './i18n'

export type { IconSpec }

export type RobotState = 'idle' | 'listening' | 'thinking' | 'happy' | 'confused' | 'sleeping' | 'alert' | 'wink' | 'excited'

/** Posición del cursor relativa al centro de la cara del robot, en píxeles. */
export interface CursorOffset {
  dx: number
  dy: number
}

/** Progreso del pomodoro para la barrita del pecho del robot (null = no hay). */
export type PomodoroView = { phase: 'focus' | 'break'; progress: number } | null

/** Canción que suena, para la pestaña de arriba (null = nada que enseñar). */
export type TabMediaView = {
  title: string
  artist: string
  app: string
  playing: boolean
  /** Carátula como data:image/png;base64. */
  art?: string
} | null

export type MediaAction = 'toggle' | 'next' | 'prev'

/** Lo que enseña la pestaña al acercarse. */
export interface TabInfo {
  name: string
  /** Emoji de la fecha especial, si la hay. */
  emoji?: string
  /** Atajo ya formateado para mostrar, p. ej. "Ctrl+Espacio". */
  shortcut: string
}

// --- Barra ----------------------------------------------------------------------

/** Lo que la barra necesita saber de cada comando para pintar la etiqueta. */
export interface CommandMeta {
  id: string
  name: string
  prefixes: readonly string[]
  placeholder: string
  accent: string
  iconPath: string
}

export interface AppInfo {
  /** Atajo global en formato de Electron, p. ej. "Control+Space". */
  shortcut: string
  commands: CommandMeta[]
  /** Nombre que el usuario le ha puesto al robot. */
  robotName: string
}

/** Vista serializable de una sugerencia (la acción real se queda en el proceso principal). */
export interface ResultView {
  title: string
  subtitle?: string
  icon: IconSpec
  badge?: string
  disabled?: boolean
  /** Si existe, Supr ejecuta la acción secundaria ("borrar", "cancelar"...). */
  secondaryLabel?: string
  /** Comando al que pertenece la fila (para fijarlo con Tab). */
  commandId: string
}

export interface QueryRequest {
  seq: number
  commandId: string | null
  text: string
}
export interface QueryResponse {
  seq: number
  items: ResultView[]
}

export interface ExecuteRequest {
  seq: number
  index: number
  secondary: boolean
}
export type ExecuteResponse =
  | { kind: 'close' }
  | { kind: 'error'; message: string }
  | { kind: 'activate'; commandId: string; text?: string }
  | { kind: 'refresh' }
  /** La lista cambió mientras tanto: hay que volver a consultar. */
  | { kind: 'stale' }

// --- Bocadillo --------------------------------------------------------------------

export interface BubbleAction {
  id: string
  label: string
  primary?: boolean
}

export interface BubbleView {
  id: string
  kind: 'clipboard' | 'reminder' | 'pomodoro' | 'info' | 'favorite' | 'link' | 'chatter'
  title: string
  text?: string
  actions: BubbleAction[]
  /** Se cierra solo tras este tiempo (null = hasta que el usuario actúe). */
  timeoutMs: number | null
  /** Lado del robot en el que aparece; la cola apunta hacia él. */
  side: 'left' | 'right'
  /** Sonar un aviso suave. */
  chime?: boolean
}

// --- Chat con la IA ----------------------------------------------------------------

export interface ChatMessageView {
  role: 'user' | 'assistant'
  text: string
  error?: boolean
}

/** Quién responde en el chat de la barra. */
export type ChatProvider = 'local' | 'claude'

export interface ChatSnapshot {
  /** De quién es esta conversación (cambiar de proveedor empieza una nueva). */
  provider: ChatProvider
  messages: ChatMessageView[]
  /** La IA está escribiendo la última respuesta. */
  streaming: boolean
}

// --- Canales ------------------------------------------------------------------------

export const IPC = {
  // Robot
  robotDragStart: 'robot:drag-start',
  robotDragEnd: 'robot:drag-end',
  robotClick: 'robot:click',
  robotDrop: 'robot:drop',
  robotCursor: 'robot:cursor',
  robotHover: 'robot:hover',
  robotState: 'robot:state',
  robotDragMoving: 'robot:drag-moving',
  robotPomodoro: 'robot:pomodoro',
  robotAppearance: 'robot:appearance',
  robotContextMenu: 'robot:context-menu',
  robotEnter: 'robot:enter',
  robotMusic: 'robot:music',
  robotSeason: 'robot:season',
  robotLeave: 'robot:leave',
  // Pestaña de arriba (modo pestaña)
  tabClick: 'tab:click',
  tabNear: 'tab:near',
  tabInfo: 'tab:info',
  tabPomodoro: 'tab:pomodoro',
  tabContextMenu: 'tab:context-menu',
  tabMedia: 'tab:media',
  tabDragOver: 'tab:drag-over',
  tabDrop: 'tab:drop',
  tabMediaAction: 'tab:media-action',
  // Ajustes
  settingsGet: 'settings:get',
  settingsUpdate: 'settings:update',
  settingsChanged: 'settings:changed',
  settingsClose: 'settings:close',
  // Barra de comandos
  barQuery: 'bar:query',
  barExecute: 'bar:execute',
  barHidden: 'bar:hidden',
  barRequestClose: 'bar:request-close',
  barError: 'bar:error',
  barOpen: 'bar:open',
  barClose: 'bar:close',
  appInfo: 'app:info',
  // Bocadillo
  bubbleShow: 'bubble:show',
  bubbleHide: 'bubble:hide',
  bubbleHidden: 'bubble:hidden',
  bubbleResize: 'bubble:resize',
  bubbleAction: 'bubble:action',
  bubbleDismiss: 'bubble:dismiss',
  bubbleUpdate: 'bubble:update',
  // Chat con la IA
  aiSend: 'ai:send',
  aiStop: 'ai:stop',
  aiReset: 'ai:reset',
  aiCopy: 'ai:copy',
  aiSnapshot: 'ai:snapshot',
  aiUpdate: 'ai:update',
  aiDelta: 'ai:delta',
  barEnterChat: 'bar:enter-chat',
  // Idioma (síncrono, lo lee el preload al cargar la página)
  appLang: 'app:lang'
} as const

/** Función que, al llamarla, deja de escuchar el evento. */
export type Unsubscribe = () => void

/** API que el preload expone en `window.mascota`. */
export interface MascotaApi {
  /** Idioma de la interfaz al cargar la página. */
  lang: Lang
  robot: {
    dragStart(): void
    /** Termina el arrastre; `moved` es false si fue un simple clic. */
    dragEnd(): Promise<{ moved: boolean }>
    click(): void
    /** Archivos o carpetas soltados sobre el robot (se añaden a favoritos). */
    dropFiles(files: File[]): void
    onCursor(cb: (offset: CursorOffset) => void): Unsubscribe
    onHover(cb: (hover: boolean) => void): Unsubscribe
    onState(cb: (state: RobotState) => void): Unsubscribe
    onDragMoving(cb: () => void): Unsubscribe
    onPomodoro(cb: (view: PomodoroView) => void): Unsubscribe
    onAppearance(cb: (appearance: Appearance) => void): Unsubscribe
    /** Clic derecho sobre el robot: menú nativo. */
    contextMenu(): void
    /** Modo pestaña: baja desde la pestaña / vuelve a subir. */
    onEnter(cb: () => void): Unsubscribe
    onLeave(cb: () => void): Unsubscribe
    /** Suena música: el robot se mueve al ritmo. */
    onMusic(cb: (playing: boolean) => void): Unsubscribe
    /** Fecha especial de hoy (id de shared/seasons.ts) o null. */
    onSeason(cb: (id: string | null) => void): Unsubscribe
  }
  tab: {
    click(): void
    contextMenu(): void
    /** Cercanía del cursor, de 0 (lejos) a 1 (encima). */
    onNear(cb: (near: number) => void): Unsubscribe
    onInfo(cb: (info: TabInfo) => void): Unsubscribe
    onPomodoro(cb: (view: PomodoroView) => void): Unsubscribe
    /** Lo que suena (Spotify, el navegador...). */
    onMedia(cb: (view: TabMediaView) => void): Unsubscribe
    /** Se arrastra un archivo encima: que baje el robot a recogerlo. */
    dragOver(): void
    /** Archivos soltados directamente en la pestaña. */
    dropFiles(files: File[]): void
    mediaAction(action: MediaAction): void
  }
  settings: {
    get(): Promise<SettingsView | null>
    update(patch: SettingsPatch): void
    close(): void
    onChanged(cb: (view: SettingsView) => void): Unsubscribe
  }
  bar: {
    query(req: QueryRequest): Promise<QueryResponse>
    execute(req: ExecuteRequest): Promise<ExecuteResponse>
    /** La animación de cierre terminó: el proceso principal ya puede ocultar la ventana. */
    hidden(): void
    /** Pide cerrar la barra (Esc, clic fuera del panel). */
    requestClose(): void
    /** Error leve en la barra (p. ej. Intro sin nada) para que el robot reaccione. */
    reportError(): void
    onOpen(cb: () => void): Unsubscribe
    onClose(cb: () => void): Unsubscribe
    /** El proceso principal pide pasar al chat de un comando ('ai' o 'claude'). */
    onEnterChat(cb: (commandId: string) => void): Unsubscribe
    getInfo(): Promise<AppInfo | null>
  }
  ai: {
    send(text: string, provider: ChatProvider): void
    stop(): void
    reset(): void
    copy(index: number): void
    snapshot(): Promise<ChatSnapshot | null>
    onUpdate(cb: (snapshot: ChatSnapshot) => void): Unsubscribe
    onDelta(cb: (d: { index: number; delta: string }) => void): Unsubscribe
  }
  bubble: {
    action(bubbleId: string, actionId: string): void
    dismiss(bubbleId: string): void
    /** Altura del contenido, para ajustar la ventana. */
    resize(height: number): void
    hidden(): void
    onShow(cb: (view: BubbleView) => void): Unsubscribe
    onUpdate(cb: (patch: { id: string; title?: string; text?: string }) => void): Unsubscribe
    onHide(cb: () => void): Unsubscribe
  }
}
