import './robot.css'
import { createRobot } from './robot'

const svg = document.querySelector<SVGSVGElement>('#robot')
if (!svg) throw new Error('No se encontró el SVG del robot')

const api = window.mascota.robot
const robot = createRobot(svg, {
  setIgnoreMouse: api.setIgnoreMouse,
  dragStart: api.dragStart,
  dragEnd: api.dragEnd,
  click: api.click
})

api.onState(robot.setState)
api.onCursor(robot.setCursor)
api.onDragMoving(robot.onDragMoving)
