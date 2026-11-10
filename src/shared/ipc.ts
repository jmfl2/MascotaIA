/**
 * Contrato de comunicación entre procesos (IPC).
 * Lo comparten el proceso principal, el preload y los renderers para que
 * los nombres de canal y los tipos no se desincronicen.
 */

export type RobotState = 'idle' | 'listening' | 'thinking' | 'happy' | 'confused' | 'sleeping'

/** Posición del cursor relativa al centro de la cara del robot, en píxeles. */
export interface CursorOffset {
  dx: number
  dy: number
}

export type RunResult = { ok: true } | { ok: false; error: string }

export interface AppInfo {
  /** Atajo global en formato de Electron, p. ej. "Control+Space". */
  shortcut: string
}

export const IPC = {
  // Ventana del robot
  robotSetIgnoreMouse: 'robot:set-ignore-mouse',
  robotDragStart: 'robot:drag-start',
  robotDragEnd: 'robot:drag-end',
  robotClick: 'robot:click',
  robotCursor: 'robot:cursor',
  robotState: 'robot:state',
  robotDragMoving: 'robot:drag-moving',
  // Barra de comandos
  barRun: 'bar:run',
  barHidden: 'bar:hidden',
  barRequestClose: 'bar:request-close',
  barOpen: 'bar:open',
  barClose: 'bar:close',
  barError: 'bar:error',
  appInfo: 'app:info'
} as const

/** Función que, al llamarla, deja de escuchar el evento. */
export type Unsubscribe = () => void

/** API que el preload expone en `window.mascota`. */
export interface MascotaApi {
  robot: {
    /** true = los clics atraviesan la ventana hasta el escritorio. */
    setIgnoreMouse(ignore: boolean): void
    dragStart(): void
    /** Termina el arrastre; `moved` es false si fue un simple clic. */
    dragEnd(): Promise<{ moved: boolean }>
    click(): void
    onCursor(cb: (offset: CursorOffset) => void): Unsubscribe
    onState(cb: (state: RobotState) => void): Unsubscribe
    onDragMoving(cb: () => void): Unsubscribe
  }
  bar: {
    run(commandId: string, query: string): Promise<RunResult>
    /** La animación de cierre terminó: el proceso principal ya puede ocultar la ventana. */
    hidden(): void
    /** Pide cerrar la barra (Esc, clic fuera del panel). */
    requestClose(): void
    /** Errores leves desde la barra (p. ej. consulta vacía) para que el robot reaccione. */
    reportError(): void
    onOpen(cb: () => void): Unsubscribe
    onClose(cb: () => void): Unsubscribe
    getInfo(): Promise<AppInfo>
  }
}
