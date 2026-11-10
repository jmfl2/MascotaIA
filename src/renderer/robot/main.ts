import './robot.css'
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
api.onAppearance((appearance) => applyAppearance(svg, appearance))
api.onEnter(robot.enter)
api.onLeave(robot.leave)

// Clic derecho: menú nativo (ajustes, ocultar...).
window.addEventListener('contextmenu', (e) => {
  e.preventDefault()
  api.contextMenu()
})
