import './robot.css'
import type { Appearance } from '../../shared/appearance'
import { SEASONS, type Season } from '../../shared/seasons'
import { applyAppearance } from './appearance'
import { createRobot } from './robot'
import { mountRobot } from './robotSvg'

const svg = mountRobot(document.getElementById('robot-host')!)

const api = window.mascota.robot
const robot = createRobot(svg, {
  dragStart: api.dragStart,
  dragEnd: api.dragEnd,
  click: api.click,
  dropFiles: api.dropFiles
})

api.onState(robot.setState)
api.onCursor(robot.setCursor)
api.onDragMoving(robot.onDragMoving)
api.onHover(robot.setHover)
api.onPomodoro(robot.setPomodoro)
api.onMusic(robot.setMusic)
// La apariencia elegida y, encima, la fecha especial (si la hay).
let appearance: Appearance | null = null
let season: Season | null = null
const repaint = () => appearance && applyAppearance(svg, appearance, season)
api.onAppearance((next) => {
  appearance = next
  repaint()
})
api.onSeason((id) => {
  season = SEASONS.find((s) => s.id === id) ?? null
  repaint()
})
api.onEnter(robot.enter)
api.onLeave(robot.leave)

// Clic derecho: menú nativo (ajustes, ocultar...).
window.addEventListener('contextmenu', (e) => {
  e.preventDefault()
  api.contextMenu()
})
