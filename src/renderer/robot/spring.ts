/**
 * Muelle amortiguado (masa-muelle-amortiguador) para valores continuos.
 *
 * El robot usa muelles propios en lugar de `motion` porque sus objetivos
 * cambian 30 veces por segundo (la mirada sigue al cursor) y conviene un
 * bucle único que actualice todo el SVG en cada fotograma. Cambiar el
 * objetivo a mitad de movimiento conserva la velocidad, así nunca hay saltos.
 */
export interface SpringConfig {
  /** Rigidez: más alto = más rápido. */
  stiffness: number
  /** Amortiguación: más bajo = más rebote. */
  damping: number
  mass?: number
}

/** Paso fijo de integración: estable incluso con muelles muy rígidos. */
const STEP = 1 / 240

export class Spring {
  value: number
  velocity = 0
  target: number
  private readonly stiffness: number
  private readonly damping: number
  private readonly mass: number

  constructor(initial: number, config: SpringConfig) {
    this.value = initial
    this.target = initial
    this.stiffness = config.stiffness
    this.damping = config.damping
    this.mass = config.mass ?? 1
  }

  /** Da un empujón (p. ej. un salto) sin cambiar el objetivo. */
  kick(velocity: number): void {
    this.velocity += velocity
  }

  /** Avanza la simulación `dt` segundos (Euler semi-implícito con subpasos). */
  update(dt: number): number {
    let remaining = dt
    while (remaining > 0) {
      const h = Math.min(STEP, remaining)
      const force = -this.stiffness * (this.value - this.target) - this.damping * this.velocity
      this.velocity += (force / this.mass) * h
      this.value += this.velocity * h
      remaining -= h
    }
    return this.value
  }
}
