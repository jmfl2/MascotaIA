/**
 * Contrato de los comandos de la barra.
 *
 * Los comandos se ejecutan en el proceso principal, pero no importan Electron:
 * todo lo que necesitan del sistema (abrir URLs, notas, recordatorios, apps...)
 * les llega en `CommandContext`. Así son módulos pequeños y fáciles de probar.
 *
 * El renderer solo recibe una vista serializable de cada sugerencia. Las
 * funciones `run` se quedan en el proceso principal y se ejecutan cuando el
 * usuario elige una fila: el renderer nunca decide qué se abre ni qué se borra.
 */

export interface GlyphIcon {
  kind: 'glyph'
  /** Trazado SVG (viewBox 0 0 24 24) dibujado con trazo. */
  path: string
  accent: string
}
export interface ImageIcon {
  kind: 'image'
  /** data:image/png;base64,... (iconos de apps de Windows). */
  src: string
}
export type IconSpec = GlyphIcon | ImageIcon

/** Qué pasa después de ejecutar una sugerencia. */
export type Outcome =
  /** Cerrar la barra. `toast` muestra un bocadillo breve junto al robot. */
  | { kind: 'close'; mood?: 'happy'; toast?: string }
  /** Mantener la barra abierta con un mensaje de error (el robot se confunde). */
  | { kind: 'error'; message: string }
  /** Fijar otro comando como etiqueta (con `text`, sustituye lo escrito). */
  | { kind: 'activate'; commandId: string; text?: string }
  /** Pasar al chat con la IA y enviarle esta tarea. */
  | { kind: 'chat'; task: AiTask; text: string }
  /** Volver a pedir las sugerencias (p. ej. tras borrar una nota). */
  | { kind: 'refresh' }

export interface Suggestion {
  title: string
  subtitle?: string
  /** Si no se indica, se usa el icono del comando. */
  icon?: IconSpec
  /** Texto a la derecha de la fila (p. ej. ★ en favoritos). */
  badge?: string
  /** Relevancia (0-100) para mezclar resultados en la búsqueda sin prefijo. */
  score?: number
  /** Fila informativa (ayuda de formato, lista vacía...). */
  disabled?: boolean
  /** Acción principal (Intro o clic). */
  run(): Outcome | Promise<Outcome>
  /** Acción secundaria (tecla Supr), p. ej. borrar. */
  secondary?: { label: string; run(): Outcome | Promise<Outcome> }
}

export interface CommandModule {
  /** Identificador estable, en minúsculas. */
  readonly id: string
  /** Nombre visible, p. ej. "YouTube". */
  readonly name: string
  /** Prefijos que activan el comando: "yt gatos" -> YouTube. */
  readonly prefixes: readonly string[]
  /** Frase corta de ayuda que se muestra en la lista de comandos. */
  readonly hint: string
  /** Texto de ejemplo para el campo cuando el comando está activo. */
  readonly placeholder: string
  /** Color de acento del icono. */
  readonly accent: string
  /** Trazado SVG (viewBox 0 0 24 24) del icono. */
  readonly iconPath: string
  /**
   * Participación en la búsqueda sin prefijo:
   * - 'web': aparece como destino alternativo para el texto (Google, YouTube...).
   * - 'ranked': aporta resultados con puntuación (apps y carpetas).
   */
  readonly global?: 'web' | 'ranked'
  /** Sugerencias para el texto escrito (puede estar vacío). */
  suggest(query: string, ctx: CommandContext): Suggestion[] | Promise<Suggestion[]>
}

// --- Datos que manejan los servicios -------------------------------------------

export type AiTask = 'chat' | 'summarize' | 'explain'

export type AiState =
  | 'checking' // aún no se ha comprobado
  | 'ready'
  | 'not-installed'
  | 'not-running' // instalado, pero el servidor no responde
  | 'no-model' // en marcha, pero falta el modelo elegido
  | 'pulling' // descargando el modelo

export interface AiStatus {
  state: AiState
  /** Modelo elegido (p. ej. "gemma3:4b"). */
  model: string
  /** Modelos descargados. */
  models: string[]
  /** Progreso de la descarga (0-1) cuando state = 'pulling'. */
  progress?: number
}

export interface Note {
  id: string
  text: string
  createdAt: number
}

export interface Reminder {
  id: string
  text: string
  dueAt: number
  createdAt: number
}

export interface PomodoroStatus {
  phase: 'focus' | 'break'
  phaseStartedAt: number
  endsAt: number
  focusMin: number
  breakMin: number
}

export interface LaunchTarget {
  id: string
  name: string
  /** Ruta o tipo ("Aplicación"). */
  detail: string
  favorite: boolean
  score: number
  /** Icono de Windows como data URL, si se pudo obtener. */
  icon?: string
  /** Veces que se ha abierto (solo en la lista de las más usadas). */
  uses?: number
}

/** Servicios del sistema que el proceso principal pone a disposición de los comandos. */
export interface CommandContext {
  now(): number
  /** Abre una URL https ya validada en el navegador predeterminado. */
  openUrl(url: string): Promise<Outcome>
  /** Copia texto al portapapeles (sin que el robot lo "ofrezca" de vuelta). */
  copyText(text: string): void
  notes: {
    all(): Note[]
    add(text: string): Note
    remove(id: string): boolean
  }
  reminders: {
    all(): Reminder[]
    add(text: string, dueAt: number): Reminder
    remove(id: string): boolean
  }
  pomodoro: {
    status(): PomodoroStatus | null
    start(focusMin: number, breakMin: number): void
    stop(): void
    skip(): void
  }
  ai: {
    /** Último estado conocido (se refresca en segundo plano). */
    status(): AiStatus
    /** Convierte lenguaje natural en un comando (devuelve `activate` o `chat`). */
    interpret(text: string): Promise<Outcome>
    /** Arranca Ollama si está instalado pero parado. */
    start(): Promise<Outcome>
    /** Descarga el modelo elegido (el progreso sale en el bocadillo). */
    pull(): Promise<Outcome>
  }
  /** Texto actual del portapapeles. */
  clipboardText(): Promise<string>
  links: {
    /** Desacorta (preguntando solo al acortador) y pone el destino en la barra. */
    expand(url: string): Promise<Outcome>
    /** Abre un enlace http(s) en el navegador. */
    open(url: string): Promise<Outcome>
  }
  /** Abre la ventana de ajustes. */
  openSettings(): void
  launcher: {
    search(query: string, limit: number): Promise<LaunchTarget[]>
    favorites(): Promise<LaunchTarget[]>
    /** Las más usadas, de más a menos (frecuencia y lo reciente). */
    mostUsed(limit: number): Promise<LaunchTarget[]>
    /** Quita una de las más usadas. */
    forgetUse(id: string): boolean
    /** Abre y cuenta el uso. */
    open(id: string): Promise<Outcome>
    removeFavorite(id: string): boolean
  }
}
