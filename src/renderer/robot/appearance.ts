/**
 * Aplica una apariencia al SVG del robot: colores de la skin (variables CSS),
 * accesorios, forma de los ojos y, si toca, la fecha especial.
 */
import { ACCESSORIES, HIDES_ANTENNA, EYE_SHAPES, skinById, skinCssVars, toggleAccessory, type AccessoryId, type Appearance } from '../../shared/appearance'
import type { Season } from '../../shared/seasons'

/** Lo que lleva puesto: lo elegido y, encima, lo de la fecha especial (que ocupa su zona mientras dura). */
export function wornAccessories(appearance: Appearance, season: Season | null): AccessoryId[] {
  return season ? season.accessories.reduce<AccessoryId[]>((acc, id) => (acc.includes(id) ? acc : toggleAccessory(acc, id)), appearance.accessories) : appearance.accessories
}

export function applyAppearance(svg: SVGSVGElement, appearance: Appearance, season: Season | null = null): void {
  for (const [name, value] of Object.entries(skinCssVars(skinById(appearance.skin), appearance))) {
    svg.style.setProperty(name, value)
  }
  const worn = wornAccessories(appearance, season)
  for (const acc of ACCESSORIES) {
    svg.querySelector(`#acc-${acc.id}`)?.classList.toggle('on', worn.includes(acc.id))
  }
  svg.classList.toggle('no-antenna', worn.some((id) => HIDES_ANTENNA.includes(id)))
  for (const shape of EYE_SHAPES) svg.classList.toggle(`eyes-${shape.id}`, appearance.eyeShape === shape.id)
  for (const fx of ['snow', 'bats', 'confetti', 'hearts'] as const) svg.classList.toggle(`fx-${fx}-on`, season?.fx === fx)
}
