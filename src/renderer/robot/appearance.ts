/**
 * Aplica una apariencia al SVG del robot: colores de la skin (variables CSS),
 * accesorios, forma de los ojos y, si toca, la fecha especial.
 */
import { ACCESSORIES, HIDES_ANTENNA, EYE_SHAPES, SPECIES, skinById, skinCssVars, speciesById, toggleAccessory, type AccessoryId, type Appearance } from '../../shared/appearance'
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
  // La antena es solo del robot.
  svg.classList.toggle('no-antenna', appearance.species !== 'robot' || worn.some((id) => HIDES_ANTENNA.includes(id)))
  const species = speciesById(appearance.species)
  for (const s of SPECIES) svg.classList.toggle(`species-${s.id}`, s.id === species.id)
  for (const face of ['screen', 'fur', 'bare'] as const) svg.classList.toggle(`face-${face}`, species.face === face)
  for (const shape of EYE_SHAPES) svg.classList.toggle(`eyes-${shape.id}`, appearance.eyeShape === shape.id)
  for (const fx of ['snow', 'bats', 'confetti', 'hearts'] as const) svg.classList.toggle(`fx-${fx}-on`, season?.fx === fx)
}
