/**
 * Animaciones que dejan el texto nítido al terminar.
 *
 * Mientras se anima `scale`/`x`/`y`, Chromium pinta el elemento en una capa de
 * GPU. Si al acabar se queda el `transform` en línea, la capa sigue ahí y, en
 * las ventanas transparentes de Windows, el texto se vuelve a pintar borroso
 * de vez en cuando (por ejemplo al apartar el ratón). Al terminar, quitamos el
 * transform para que el panel vuelva a pintarse como uno normal.
 *
 * Si sobre el mismo elemento empieza otra animación antes de que termine esta,
 * no se limpia nada: manda la última.
 */
import { animate } from 'motion'

const generation = new WeakMap<Element, number>()

type Keyframes = Parameters<typeof animate>[1]
type Options = Parameters<typeof animate>[2]

export function animateCrisp(el: HTMLElement, keyframes: Keyframes, options?: Options) {
  const mine = (generation.get(el) ?? 0) + 1
  generation.set(el, mine)
  const animation = animate(el, keyframes, options)
  void animation.finished.then(
    () => {
      if (generation.get(el) !== mine) return
      el.style.transform = ''
      el.style.willChange = ''
    },
    () => {}
  )
  return animation
}
