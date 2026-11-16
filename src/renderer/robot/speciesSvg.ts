/**
 * Partes de cada forma de la mascota (gato, perro, slime...). Se dibujan en el
 * mismo esqueleto que el robot (ver robotSvg.ts) y solo se ve la de la forma
 * elegida: cada parte lleva la clase `sp sp-<forma>` y robot.css enseña las de
 * la clase `species-<forma>` que appearance.ts pone en el SVG.
 *
 * Coordenadas del viewBox de 200: cuerpo de (40,48) a (160,168), cara de
 * (54,68) a (146,136), ojos en (82,100) y (118,100).
 * Los personajes de videojuego son genéricos, sin ninguno concreto.
 */

/** La misma forma reflejada al otro lado (orejas, alas...). */
const mirror = (svg: string) => `<g transform="translate(200 0) scale(-1 1)">${svg}</g>`
const both = (svg: string) => svg + mirror(svg)
const part = (species: string, svg: string) => `<g class="sp ${species.split(' ').map((s) => `sp-${s}`).join(' ')}">${svg}</g>`

const BODY = 'fill="url(#g-body)" class="part-edge"'

/** Detrás del cuerpo: orejas, colas, alas, cuernos... (asoman por fuera). */
export const SPECIES_BACK = [
  part('gato', both(`<path d="M52 84 L58 30 L94 58 Z" ${BODY} /><path d="M60 70 L63 42 L84 58 Z" class="cheek" opacity="0.75" />`) +
    `<path d="M150 154 C178 156 188 128 178 104 C174 96 166 98 168 106 C174 126 168 142 148 144 Z" ${BODY} />`),
  part('perro', both(`<path d="M60 58 C38 52 24 72 28 100 C30 116 42 120 48 110 C52 96 54 78 68 66 Z" class="sp-dark part-edge" />`) +
    `<path d="M154 150 C168 146 176 134 176 120" class="sp-tail" />`),
  part('conejo', both(`<path d="M74 60 C62 34 64 6 78 4 C92 4 92 34 88 58 Z" ${BODY} /><path d="M77 54 C70 34 71 14 79 12 C86 14 86 34 84 54 Z" class="cheek" opacity="0.7" />`)),
  part('oso', both(`<circle cx="56" cy="60" r="17" ${BODY} /><circle cx="56" cy="60" r="9" class="sp-dark" />`)),
  part('panda', both(`<circle cx="56" cy="60" r="17" fill="#23232a" />`)),
  part('zorro', both(`<path d="M50 88 L48 24 L96 58 Z" ${BODY} /><path d="M57 74 L56 38 L84 60 Z" fill="#3a2a22" opacity="0.8" />`) +
    `<path d="M146 156 C186 162 200 122 184 90 C180 110 168 120 156 124 C164 132 160 146 146 146 Z" ${BODY} />` +
    `<path d="M184 90 C194 106 194 122 186 134 C182 120 180 104 184 90 Z" fill="#fffaf2" />`),
  part('pinguino', both(`<path d="M44 102 C28 116 22 140 28 152 C38 148 44 134 48 120 Z" class="sp-dark part-edge" />`)),
  part('rana', both(`<circle cx="72" cy="56" r="19" ${BODY} /><ellipse cx="66" cy="50" rx="5" ry="3" fill="#fff" opacity="0.6" />`)),
  part('dragon', both(
    `<path d="M48 100 C30 74 10 70 2 84 C12 86 14 94 8 100 C18 100 22 108 16 116 C28 118 40 114 46 108 Z" class="sp-dark part-edge" />` +
    `<path d="M70 60 C62 44 64 30 72 20 C72 36 78 48 84 56 Z" fill="#fff3d6" stroke="#d9c39a" stroke-width="1" />`) +
    `<path d="M150 156 C176 160 188 146 190 128" class="sp-tail" /><path d="M183 130 L190 112 L198 130 Z" class="sp-dark" />`),
  part('caballero', `<path d="M100 50 C92 30 102 10 126 6 C114 20 112 34 110 52 Z" fill="#e63946" /><path d="M104 46 C100 32 108 18 122 12" fill="none" stroke="#fff" stroke-opacity="0.3" stroke-width="2" />`),
  part('alien', both(`<path d="M84 54 Q76 36 68 26" class="sp-stalk" /><circle cx="67" cy="24" r="6" class="eye-fill" /><circle cx="65" cy="22" r="1.8" fill="#fff" opacity="0.8" />`))
].join('')

/** Otra silueta en lugar del cuerpo redondo (mismos colores). */
export const SPECIES_BODY = [
  part('fantasma', `<path class="body-alt" d="M40 102 C40 70 66 48 100 48 C134 48 160 70 160 102 V164 Q150 176 140 164 Q130 152 120 164 Q110 176 100 164 Q90 152 80 164 Q70 176 60 164 Q50 152 40 164 Z" ${BODY} />`),
  part('slime', `<path class="body-alt" d="M100 46 C118 46 126 72 144 92 C166 116 170 146 156 160 C146 170 54 170 44 160 C30 146 34 116 56 92 C74 72 82 46 100 46 Z" ${BODY} /><ellipse cx="122" cy="70" rx="5" ry="9" fill="#fff" opacity="0.55" transform="rotate(30 122 70)" />`)
].join('')

/** Encima del cuerpo, debajo de la cara: tripas y patas. */
export const SPECIES_BELLY = [
  part('pinguino', `<ellipse cx="100" cy="130" rx="44" ry="36" fill="#fbfbfd" /><ellipse cx="84" cy="168" rx="11" ry="5" fill="#f4a024" /><ellipse cx="116" cy="168" rx="11" ry="5" fill="#f4a024" />`)
].join('')

/** Dentro de la cara, debajo de los ojos (se mueven con la mirada). */
export const SPECIES_IN_FACE = [
  part('panda', `<ellipse cx="82" cy="102" rx="14" ry="16" fill="#23232a" transform="rotate(-18 82 102)" /><ellipse cx="118" cy="102" rx="14" ry="16" fill="#23232a" transform="rotate(18 118 102)" />`)
].join('')

const CAT_NOSE = `<path d="M96 113 H104 L100 117.5 Z" class="cheek" /><path d="M100 117.5 Q97 122 93 120.5 M100 117.5 Q103 122 107 120.5" class="sp-line" />`
const WHISKERS = `<path d="M46 110 L68 114 M44 119 L68 118 M154 110 L132 114 M156 119 L132 118" class="sp-line" />`
const BEAR_NOSE = `<ellipse cx="100" cy="114" rx="6" ry="4.5" fill="#2a2228" /><path d="M100 118 V121 M100 121 Q96 125 92 123 M100 121 Q104 125 108 123" class="sp-line" />`

/** Encima de la cara: narices, bocas, bigotes, picos y el borde del casco. */
export const SPECIES_FRONT = [
  part('gato', CAT_NOSE + WHISKERS),
  part('conejo', CAT_NOSE + WHISKERS + `<rect x="96.8" y="120" width="6.4" height="5.5" rx="1.2" fill="#fff" stroke="#d9d2c3" stroke-width="0.6" />`),
  part('perro', `<ellipse cx="100" cy="115" rx="7.5" ry="5.2" fill="#2a2228" /><ellipse cx="97.6" cy="113.4" rx="2.4" ry="1.3" fill="#fff" opacity="0.5" /><path d="M100 120 Q95 125 89 122 M100 120 Q105 125 111 122" class="sp-line" />`),
  part('oso panda', `<ellipse cx="100" cy="119" rx="15" ry="10.5" fill="#fff" opacity="0.6" />` + BEAR_NOSE),
  part('zorro', `<path d="M56 114 Q78 120 92 113 Q100 128 108 113 Q122 120 144 114 Q134 140 100 142 Q66 140 56 114 Z" fill="#fffaf2" opacity="0.92" /><ellipse cx="100" cy="114" rx="5.5" ry="4" fill="#2a2228" />`),
  part('pinguino', `<path d="M91 113 Q100 108 109 113 L100 123 Z" fill="#f4a024" /><path d="M93 114 Q100 111 107 114" fill="none" stroke="#fff" stroke-opacity="0.45" stroke-width="1.2" />`),
  part('rana', `<path d="M78 120 Q100 131 122 120" class="sp-line sp-line-thick" />`),
  part('dragon', `<circle cx="95" cy="116" r="1.8" fill="#2a2228" /><circle cx="105" cy="116" r="1.8" fill="#2a2228" /><path d="M86 122 Q100 128 114 122" class="sp-line" />`),
  part('caballero', `<rect x="52" y="66" width="96" height="72" rx="32" fill="none" stroke="#b9c2cf" stroke-width="4" /><rect x="97.5" y="68" width="5" height="42" rx="2" fill="#b9c2cf" /><circle cx="47" cy="102" r="3" fill="#b9c2cf" /><circle cx="153" cy="102" r="3" fill="#b9c2cf" />`)
].join('')
