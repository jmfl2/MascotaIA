/**
 * Personalidad y animación del robot.
 *
 * Todo se mueve con muelles (ver spring.ts) desde un único bucle por
 * fotograma: cada estado define una "expresión" (objetivos de los muelles)
 * y los muelles se encargan de que los cambios sean suaves y con rebote.
 */
import type { CursorOffset, PomodoroView, RobotState } from '../../shared/ipc'
import { Spring } from './spring'

/** Parámetros de la cara para cada estado. */
interface Expression {
  /** Apertura de los ojos (1 = normal). */
  open: number
  /** Tamaño de los ojos. */
  size: number
  /** 0 = ojos normales, 1 = ojos en arco ^ ^ */
  happy: number
  /** Cuánto se cierra el ojo derecho respecto al izquierdo (confusión). */
  asym: number
  /** Inclinación de la cara, en grados. */
  tilt: number
  /** Brillo de la antena y la luz del pecho. */
  glow: number
  /** Mejillas sonrosadas. */
  cheeks: number
}

const EXPRESSIONS: Record<RobotState, Expression> = {
  idle: { open: 1, size: 1, happy: 0, asym: 0, tilt: 0, glow: 0.15, cheeks: 0 },
  listening: { open: 1.08, size: 1.12, happy: 0, asym: 0, tilt: 0, glow: 1, cheeks: 0 },
  thinking: { open: 0.72, size: 1, happy: 0, asym: 0.2, tilt: -4, glow: 0.6, cheeks: 0 },
  happy: { open: 1, size: 1.06, happy: 1, asym: 0, tilt: 0, glow: 0.9, cheeks: 1 },
  confused: { open: 1, size: 1, happy: 0, asym: 0.45, tilt: 8, glow: 0.3, cheeks: 0 },
  sleeping: { open: 0.08, size: 1, happy: 0, asym: 0, tilt: 3, glow: 0, cheeks: 0 },
  alert: { open: 1.18, size: 1.14, happy: 0, asym: 0, tilt: 0, glow: 1, cheeks: 0 }
}

/** Colores de la barrita del pomodoro. */
const POMODORO_COLORS = { focus: '#ff6b5a', break: '#34c759' }
/** Ancho máximo de la barrita del pomodoro (igual que #pomo-track en robot.html). */
const POMODORO_WIDTH = 44
const POMODORO_MIN_WIDTH = 6
/** Cada cuánto da un saltito mientras hay un aviso pendiente. */
const ALERT_HOP_MS = 1400

/** Estados pasajeros: duran un rato y vuelven al estado base. */
const TRANSIENT_MS: Partial<Record<RobotState, number>> = { happy: 1700, confused: 1900 }
/** Sin mover el ratón durante este tiempo, el robot se duerme. */
const SLEEP_AFTER_MS = 3 * 60 * 1000
/** Distancia (px) a la que la mirada alcanza su máximo desvío. */
const GAZE_REACH = 320

// Muelles: rígidos para parpadear, suaves para la mirada, con rebote para el cuerpo.
const soft = { stiffness: 260, damping: 22 }
const s = {
  gazeX: new Spring(0, { stiffness: 140, damping: 17 }),
  gazeY: new Spring(0, { stiffness: 140, damping: 17 }),
  lid: new Spring(1, { stiffness: 1400, damping: 55 }),
  open: new Spring(1, { stiffness: 320, damping: 24 }),
  size: new Spring(1, soft),
  happy: new Spring(0, soft),
  asym: new Spring(0, soft),
  tilt: new Spring(0, { stiffness: 200, damping: 14 }),
  glow: new Spring(0.15, { stiffness: 120, damping: 18 }),
  cheeks: new Spring(0, soft),
  squashX: new Spring(1, { stiffness: 420, damping: 13 }),
  squashY: new Spring(1, { stiffness: 420, damping: 13 }),
  lift: new Spring(0, { stiffness: 320, damping: 15 }),
  pomo: new Spring(0, { stiffness: 120, damping: 20 }),
  pomoVisible: new Spring(0, soft)
}

export interface RobotCallbacks {
  dragStart(): void
  dragEnd(): Promise<{ moved: boolean }>
  click(): void
  dropFiles(files: File[]): void
}

export function createRobot(svg: SVGSVGElement, cb: RobotCallbacks) {
  const $ = <T extends Element>(sel: string) => {
    const el = svg.querySelector<T>(sel)
    if (!el) throw new Error(`Falta ${sel} en el SVG del robot`)
    return el
  }
  const rig = $<SVGGElement>('#rig')
  const face = $<SVGGElement>('#face')
  const shadow = $<SVGEllipseElement>('#shadow')
  const antennaGlow = $<SVGCircleElement>('#antenna-glow')
  const bellyLight = $<SVGRectElement>('#belly-light')
  const cheeks = [$<SVGEllipseElement>('#cheek-l'), $<SVGEllipseElement>('#cheek-r')]
  const hit = $<SVGRectElement>('#hit')
  const pomoGroup = $<SVGGElement>('#pomo')
  const pomoFill = $<SVGRectElement>('#pomo-fill')
  const eyes = (['#eye-l', '#eye-r'] as const).map((id, i) => {
    const g = $<SVGGElement>(id)
    return {
      g,
      x: i === 0 ? 82 : 118,
      open: g.querySelector<SVGRectElement>('.eye-open')!,
      happy: g.querySelector<SVGPathElement>('.eye-happy')!
    }
  })

  let base: RobotState = 'idle'
  let transient: RobotState | null = null
  let transientTimer: number | undefined
  let hover = false
  let dragging = false
  let dragMoving = false
  let dropHover = false
  let lastHop = 0
  let lastActivity = performance.now()
  const cursorGaze = { x: 0, y: 0 }

  const current = (): RobotState => transient ?? base

  /** Aplica la expresión del estado actual a los objetivos de los muelles. */
  function refresh(): void {
    const state = current()
    const e = EXPRESSIONS[state]
    s.open.target = e.open
    s.size.target = e.size * (hover && !dragging ? 1.05 : 1) * (dragMoving ? 1.15 : 1) * (dropHover ? 1.2 : 1)
    if (dropHover) {
      s.open.target = 1.25
      s.glow.target = 1
    }
    s.happy.target = e.happy
    s.asym.target = e.asym
    s.tilt.target = e.tilt
    s.glow.target = e.glow
    s.cheeks.target = e.cheeks
    svg.classList.toggle('is-thinking', state === 'thinking')
    svg.classList.toggle('is-sleeping', state === 'sleeping')
    svg.classList.toggle('is-confused', state === 'confused')
  }

  function setState(state: RobotState): void {
    const ms = TRANSIENT_MS[state]
    if (ms) {
      transient = state
      window.clearTimeout(transientTimer)
      transientTimer = window.setTimeout(() => {
        transient = null
        refresh()
      }, ms)
      if (state === 'happy') {
        // Saltito de alegría con estiramiento.
        s.lift.kick(-260)
        s.squashY.kick(2.2)
        s.squashX.kick(-1.2)
      } else {
        s.tilt.kick(-120)
      }
    } else {
      // Un estado base nuevo (p. ej. abrir la barra) sustituye al pasajero.
      transient = null
      window.clearTimeout(transientTimer)
      if (base === 'sleeping' && state !== 'sleeping') wakeUp()
      base = state
      if (state === 'listening') s.lift.kick(-90)
    }
    refresh()
  }

  /** Despertar con un pequeño sobresalto. */
  function wakeUp(): void {
    s.open.kick(14)
    s.lift.kick(-140)
  }

  function noteActivity(): void {
    lastActivity = performance.now()
    if (base === 'sleeping') setState('idle')
  }

  // --- Mirada ----------------------------------------------------------------
  function setCursor({ dx, dy }: CursorOffset): void {
    noteActivity()
    const d = Math.hypot(dx, dy)
    if (d < 1) {
      cursorGaze.x = cursorGaze.y = 0
      return
    }
    const k = 1 - (1 - Math.min(1, d / GAZE_REACH)) ** 2 // se satura suavemente
    cursorGaze.x = (dx / d) * k
    cursorGaze.y = (dy / d) * k
  }

  // --- Parpadeo --------------------------------------------------------------
  function blink(): void {
    s.lid.target = 0.05
    window.setTimeout(() => {
      s.lid.target = 1
    }, 85)
  }
  function scheduleBlink(): void {
    window.setTimeout(
      () => {
        const state = current()
        if (state !== 'sleeping' && state !== 'happy' && !dragMoving) {
          blink()
          if (Math.random() < 0.2) window.setTimeout(blink, 220) // a veces, doble parpadeo
        }
        scheduleBlink()
      },
      2200 + Math.random() * 4000
    )
  }

  // --- Ratón: encima, arrastre y clic ------------------------------------------
  /** El proceso principal decide si el cursor está sobre el robot (ver robotWindow.ts). */
  function setHover(value: boolean): void {
    if (value === hover) return
    hover = value
    refresh()
  }

  hit.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return
    hit.setPointerCapture(e.pointerId)
    dragging = true
    dragMoving = false
    noteActivity()
    cb.dragStart()
    refresh()
  })

  async function endPointer(): Promise<void> {
    if (!dragging) return
    dragging = false
    const wasMoving = dragMoving
    dragMoving = false
    const { moved } = await cb.dragEnd()
    s.squashX.target = 1
    s.squashY.target = 1
    if (moved || wasMoving) {
      // Al soltarlo: rebote elástico.
      s.squashY.kick(-3.5)
      s.squashX.kick(3)
      s.lift.kick(-120)
    } else {
      // Clic: se asoma hacia delante y abre la barra.
      s.lift.kick(-220)
      s.size.kick(2.5)
      cb.click()
    }
    refresh()
  }
  hit.addEventListener('pointerup', () => void endPointer())
  hit.addEventListener('lostpointercapture', () => void endPointer())

  // --- Soltar archivos y carpetas encima: se añaden a favoritos --------------------
  const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files')
  window.addEventListener('dragover', (e) => {
    if (!hasFiles(e)) return
    e.preventDefault()
    e.dataTransfer!.dropEffect = 'link'
    if (!dropHover) {
      dropHover = true
      noteActivity()
      s.lift.kick(-120)
      refresh()
    }
  })
  const endDropHover = () => {
    if (!dropHover) return
    dropHover = false
    refresh()
  }
  window.addEventListener('dragleave', (e) => {
    if (e.relatedTarget === null) endDropHover()
  })
  window.addEventListener('drop', (e) => {
    e.preventDefault()
    endDropHover()
    const files = Array.from(e.dataTransfer?.files ?? [])
    if (files.length) cb.dropFiles(files)
  })

  // --- Pomodoro ---------------------------------------------------------------------
  function setPomodoro(view: PomodoroView): void {
    s.pomoVisible.target = view ? 1 : 0
    if (view) {
      // Al cambiar de fase la barra se vacía de golpe y vuelve a crecer.
      if (view.progress < s.pomo.target - 0.5) s.pomo.value = 0
      s.pomo.target = view.progress
      pomoFill.setAttribute('fill', POMODORO_COLORS[view.phase])
    }
  }

  /** El proceso principal confirma que el ratón se está moviendo: se encoge. */
  function onDragMoving(): void {
    if (!dragging) return
    dragMoving = true
    s.squashX.target = 0.86
    s.squashY.target = 0.86
    refresh()
  }

  // --- Bucle de animación ----------------------------------------------------
  // Pintar una ventana transparente cuesta GPU en cada fotograma. Cuando nada se
  // mueve solo queda la respiración, que es lenta: basta con pocos fps.
  const IDLE_FRAME_MS = 1000 / 30
  const SLEEP_FRAME_MS = 1000 / 12
  const SETTLED = 0.002

  /** ¿Algún muelle sigue en movimiento o lejos de su objetivo? */
  function moving(): boolean {
    for (const spring of Object.values(s)) {
      if (Math.abs(spring.velocity) > SETTLED || Math.abs(spring.value - spring.target) > SETTLED) return true
    }
    return false
  }

  /** Estados o interacciones que piden toda la fluidez (pulsos, saltitos, el ratón encima). */
  function lively(state: RobotState): boolean {
    return hover || dragging || dropHover || state === 'listening' || state === 'thinking' || state === 'alert'
  }

  let last = performance.now()
  function frame(now: number): void {
    const state = current()

    // Hacia dónde mira según el estado.
    let gx = cursorGaze.x
    let gy = cursorGaze.y
    if (state === 'thinking') [gx, gy] = [0.55, -0.75]
    else if (state === 'sleeping') [gx, gy] = [0, 0.35]
    s.gazeX.target = gx
    s.gazeY.target = gy

    if (!lively(state) && !moving() && now - last < (state === 'sleeping' ? SLEEP_FRAME_MS : IDLE_FRAME_MS)) {
      requestAnimationFrame(frame)
      return
    }

    const dt = Math.min((now - last) / 1000, 1 / 30) // si la ventana se congela, no "salta"
    last = now
    const t = now / 1000

    // Con un aviso pendiente, da saltitos para llamar la atención.
    if (state === 'alert' && now - lastHop > ALERT_HOP_MS) {
      lastHop = now
      s.lift.kick(-200)
      s.squashY.kick(1.6)
    }

    for (const spring of Object.values(s)) spring.update(dt)

    // Respiración y flotación (más lentas y profundas al dormir).
    const period = state === 'sleeping' ? 4.8 : 3.4
    const breath = Math.sin((t * 2 * Math.PI) / period)
    const floatY = breath * (state === 'sleeping' ? 1.2 : 2.6)
    const y = floatY + s.lift.value
    const sx = s.squashX.value * (1 - breath * 0.006)
    const sy = s.squashY.value * (1 + breath * 0.014)
    const lean = s.gazeX.value * 3 // se inclina hacia donde mira

    rig.setAttribute(
      'transform',
      `translate(0 ${y.toFixed(2)}) translate(100 168) rotate(${lean.toFixed(2)}) scale(${sx.toFixed(4)} ${sy.toFixed(4)}) translate(-100 -168)`
    )

    // La sombra se encoge y aclara cuando el robot sube.
    const up = Math.max(-6, -y)
    const shadowScale = Math.min(1.1, Math.max(0.55, 1 - up * 0.012))
    shadow.setAttribute('transform', `translate(100 186) scale(${shadowScale.toFixed(3)} 1) translate(-100 -186)`)
    shadow.setAttribute('opacity', Math.min(1, Math.max(0.35, 1 - up * 0.015)).toFixed(3))

    face.setAttribute(
      'transform',
      `translate(${(s.gazeX.value * 8).toFixed(2)} ${(s.gazeY.value * 5).toFixed(2)}) rotate(${s.tilt.value.toFixed(2)} 100 102)`
    )

    const happy = Math.min(1, Math.max(0, s.happy.value))
    const open = Math.max(0.05, s.open.value * s.lid.value * (1 - happy * 0.92))
    const size = s.size.value
    eyes.forEach((eye, i) => {
      const asym = i === 1 ? s.asym.value : 0
      const eyeOpen = Math.max(0.05, open * (1 - asym))
      eye.g.setAttribute('transform', `translate(${eye.x} ${(100 - asym * 4).toFixed(2)})`)
      eye.open.setAttribute('transform', `scale(${size.toFixed(4)} ${(size * eyeOpen).toFixed(4)})`)
      eye.open.setAttribute('opacity', (1 - happy).toFixed(3))
      eye.happy.setAttribute('opacity', happy.toFixed(3))
      eye.happy.setAttribute('transform', `scale(${size.toFixed(4)})`)
    })

    const glow = Math.max(0, s.glow.value)
    const pulse = state === 'listening' || state === 'thinking' ? 0.85 + 0.15 * Math.sin(t * 6) : 1
    antennaGlow.setAttribute('opacity', (glow * pulse).toFixed(3))
    const pomoVisible = Math.min(1, Math.max(0, s.pomoVisible.value))
    bellyLight.setAttribute('opacity', ((0.3 + glow * 0.6) * (1 - pomoVisible)).toFixed(3))
    pomoGroup.setAttribute('opacity', pomoVisible.toFixed(3))
    // Empieza como un punto (ancho = alto) y crece hasta llenar la pista.
    const pomoProgress = Math.max(0, Math.min(1, s.pomo.value))
    pomoFill.setAttribute('width', (POMODORO_MIN_WIDTH + pomoProgress * (POMODORO_WIDTH - POMODORO_MIN_WIDTH)).toFixed(2))
    const cheekOpacity = (Math.max(0, s.cheeks.value) * 0.75).toFixed(3)
    for (const c of cheeks) c.setAttribute('opacity', cheekOpacity)

    requestAnimationFrame(frame)
  }

  // ¿Toca dormirse?
  window.setInterval(() => {
    if (base === 'idle' && !transient && !dragging && performance.now() - lastActivity > SLEEP_AFTER_MS) {
      setState('sleeping')
    }
  }, 5000)

  refresh()
  scheduleBlink()
  requestAnimationFrame(frame)

  return { setState, setCursor, setHover, setPomodoro, onDragMoving }
}
