/**
 * Contrato que cumple cada comando de la barra.
 *
 * Los comandos son módulos puros (sin Electron ni Node): los usa el renderer
 * para mostrar sugerencias y el proceso principal para construir y validar
 * la URL final antes de abrirla. Así el renderer nunca decide qué se abre.
 */
export interface CommandModule {
  /** Identificador estable, en minúsculas (se envía por IPC). */
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
  /** Trazado SVG (viewBox 0 0 24 24) del icono, dibujado con trazo. */
  readonly iconPath: string
  /** Únicos dominios a los que puede llevar este comando. */
  readonly allowedHosts: readonly string[]
  /**
   * Construye la URL de destino. Recibe la consulta ya saneada y no vacía.
   * Debe usar `URL`/`URLSearchParams` (o `encodeURIComponent`) para codificar.
   */
  buildUrl(query: string): URL
}

export type BuildResult =
  | { ok: true; url: string; command: CommandModule }
  | { ok: false; error: string }
