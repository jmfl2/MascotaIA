/** Aplica una skin (colores por variables CSS) y los accesorios al SVG del robot. */
import { ACCESSORIES, skinById, skinCssVars, type Appearance } from '../../shared/appearance'

export function applyAppearance(svg: SVGSVGElement, appearance: Appearance): void {
  for (const [name, value] of Object.entries(skinCssVars(skinById(appearance.skin), appearance))) {
    svg.style.setProperty(name, value)
  }
  for (const acc of ACCESSORIES) {
    svg.classList.toggle(`with-${acc.id}`, appearance.accessories.includes(acc.id))
  }
}
