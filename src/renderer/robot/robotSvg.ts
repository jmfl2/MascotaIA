/**
 * El robot en SVG. Lo usan la ventana del robot y la vista previa de los ajustes.
 *
 * Las coordenadas están pensadas para una ventana de 200x200: el centro de la
 * cara (100, 102) coincide con FACE_CENTER en src/main/robotWindow.ts y la
 * silueta #hit con HIT. Las partes animadas tienen id y las mueve robot.ts;
 * los colores salen de variables CSS (ver appearance.ts).
 *
 * Es una cadena estática del propio código (no contiene nada del usuario).
 */
import { t } from '../../shared/i18n'

/**
 * Pixel art a partir de un dibujo con caracteres: cada carácter es un color
 * (un '#rrggbb' o una clase CSS) y '.' es un hueco. Junta los píxeles seguidos
 * del mismo color en un solo rectángulo para no llenar el SVG de nodos.
 */
export function pixels(rows: readonly string[], size: number, x0: number, y0: number, palette: Record<string, string>): string {
  const out: string[] = []
  rows.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      const ch = row[x]
      let end = x + 1
      while (end < row.length && row[end] === ch) end++
      const color = palette[ch]
      if (ch !== '.' && color) {
        const paint = color.startsWith('#') ? `fill="${color}"` : `class="${color}"`
        // +0.15 de solape: sin él se ven rayitas entre píxeles al escalar.
        out.push(`<rect x="${x0 + x * size}" y="${y0 + y * size}" width="${(end - x) * size + 0.15}" height="${size + 0.15}" ${paint} />`)
      }
      x = end
    }
  })
  return out.join('')
}

/** Corona de 8 bits con gemas. */
const CROWN = pixels(
  ['g.....g.....g', 'gg...ggg...gg', 'ggg.ggggg.ggg', 'gwggggggggggg', 'ggrgggbgggrgg', 'ggggggggggggg', 'ddddddddddddd'],
  4, 74, 28,
  { g: '#ffcc33', d: '#e0991a', w: '#fff3b8', r: '#ff3b5c', b: '#3ba0ff' }
)

/** Corazón con borde, lleno (r) o vacío (e), como una barra de vida. */
function heart(fill: 'r' | 'e', x: number): string {
  const f = (n: number) => fill.repeat(n)
  return pixels(
    ['.kk...kk.', `k${f(2)}k.k${f(2)}k`, `k${fill}w${fill}k${f(3)}k`, `k${f(7)}k`, `.k${f(5)}k.`, `..k${f(3)}k..`, `...k${fill}k...`, '....k....'],
    1.9, x, 18,
    { k: '#2b1d2e', r: '#ff3b5c', e: '#5d5468', w: '#ffffff' }
  )
}
const HEARTS = heart('r', 28) + heart('r', 47) + heart('e', 66)

/** Espada pixelada a la espalda (va detrás del cuerpo: solo asoma la empuñadura). */
const SWORD = pixels(
  ['..ggg..', '...h...', '...h...', '...h...', 'ggggggg', ...Array<string>(14).fill('..lmd..'), '...m...'],
  3.6, -12.6, -16.2,
  { g: '#ffcc33', h: '#8a5a2b', l: '#f4f8fc', m: '#c9d4e2', d: '#8fa0b8' }
)

/** Gafas de sol pixeladas: montura del color del accesorio, cristales que tapan los ojos. */
const PIXEL_GLASSES = pixels(
  ['ffffffffffffffffffffffff', '.fwwkkkkkf....fwwkkkkkf.', '.fwkkkkkkf....fwkkkkkkf.', '.fkkkkkkkf....fkkkkkkkf.', '..fkkkkkf......fkkkkkf..', '...fffff........fffff...'],
  3.6, 56.8, 88,
  { f: 'acc-main', k: '#06070b', w: '#ffffff' }
)

export const ROBOT_SVG = `<svg id="robot" class="robot" viewBox="0 0 200 200" aria-label="${t('Robot mascota', 'Mascot robot')}" role="img">
  <defs>
    <linearGradient id="g-body" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" class="stop-body-top" />
      <stop offset="1" class="stop-body-bottom" />
    </linearGradient>
    <radialGradient id="g-body-shade" cx="0.42" cy="0.34" r="0.75">
      <stop offset="0.6" stop-color="#000" stop-opacity="0" />
      <stop offset="1" stop-color="#1e2a44" stop-opacity="0.16" />
    </radialGradient>
    <radialGradient id="g-sheen" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#fff" stop-opacity="0.95" />
      <stop offset="1" stop-color="#fff" stop-opacity="0" />
    </radialGradient>
    <linearGradient id="g-screen" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" class="stop-screen-top" />
      <stop offset="1" class="stop-screen-bottom" />
    </linearGradient>
    <linearGradient id="g-screen-gloss" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity="0.14" />
      <stop offset="1" stop-color="#fff" stop-opacity="0" />
    </linearGradient>
    <radialGradient id="g-shadow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" class="stop-shadow" />
      <stop offset="1" class="stop-shadow" stop-opacity="0" />
    </radialGradient>
    <radialGradient id="g-glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" class="stop-eye" stop-opacity="0.9" />
      <stop offset="1" class="stop-eye" stop-opacity="0" />
    </radialGradient>
    <pattern id="p-hazard" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="9" height="9" fill="#f5c518" />
      <rect width="4.5" height="9" fill="#17181c" />
    </pattern>
    <clipPath id="c-body">
      <rect x="40" y="48" width="120" height="120" rx="54" />
    </clipPath>
    <clipPath id="c-screen">
      <rect x="54" y="68" width="92" height="68" rx="30" />
    </clipPath>
  </defs>

  <ellipse id="shadow" cx="100" cy="186" rx="46" ry="7" fill="url(#g-shadow)" />

  <g id="rig">
    <!-- Antena -->
    <g id="antenna">
      <circle id="antenna-glow" cx="100" cy="31" r="15" fill="url(#g-glow)" opacity="0" />
      <path d="M100 50 V37" class="antenna-stem" />
      <circle cx="100" cy="31" r="7" fill="url(#g-body)" class="part-edge" />
      <circle cx="98" cy="29" r="2.2" fill="#fff" opacity="0.9" />
    </g>

    <!-- Accesorio: espada a la espalda (detrás del cuerpo) -->
    <g id="acc-espada" class="acc" transform="translate(150 54) rotate(36)">${SWORD}</g>

    <!-- Accesorio: cuchillo de combate a la espalda (asoma la hoja por arriba) -->
    <g id="acc-cuchillo" class="acc" transform="translate(62 62) rotate(-32)">
      <path d="M-4.5 0 V-30 Q-4.5 -40 0 -46 Q4.5 -40 4.5 -30 V0 Z" fill="#d7dde5" />
      <path d="M0 -44 Q3.4 -39 3.4 -30 V0 H0 Z" fill="#aab4c2" />
      <path d="M-2.6 -6 V-26 M-2.6 -30 l-1.6 -2 M-2.6 -26 l-1.6 -2 M-2.6 -22 l-1.6 -2" stroke="#8d97a6" stroke-width="0.9" fill="none" />
      <rect x="-9" y="0" width="18" height="4.5" rx="1.5" fill="#33373f" />
      <rect x="-4" y="4.5" width="8" height="18" rx="2.5" fill="#24272d" />
    </g>

    <!-- Orejas -->
    <rect x="29" y="94" width="14" height="32" rx="7" fill="url(#g-body)" class="part-edge" />
    <rect x="157" y="94" width="14" height="32" rx="7" fill="url(#g-body)" class="part-edge" />

    <!-- Cuerpo -->
    <rect x="40" y="48" width="120" height="120" rx="54" fill="url(#g-body)" class="part-edge" />
    <rect x="40" y="48" width="120" height="120" rx="54" fill="url(#g-body-shade)" />
    <ellipse cx="76" cy="64" rx="22" ry="9" fill="url(#g-sheen)" transform="rotate(-22 76 64)" />
    <rect id="belly-light" x="92" y="149" width="16" height="5" rx="2.5" class="eye-fill" opacity="0.5" />
    <!-- Barrita del pomodoro (sustituye a la luz del pecho mientras hay uno activo) -->
    <g id="pomo" opacity="0">
      <rect id="pomo-track" x="78" y="148.5" width="44" height="6" rx="3" class="pomo-track" />
      <rect id="pomo-fill" x="78" y="148.5" width="0" height="6" rx="3" fill="#ff6b5a" />
    </g>

    <!-- Accesorio: cinta de peligro cruzada sobre el cuerpo -->
    <g id="acc-cinta" class="acc" clip-path="url(#c-body)">
      <rect x="20" y="137" width="160" height="12" transform="rotate(-13 100 143)" fill="url(#p-hazard)" />
      <rect x="20" y="137" width="160" height="12" transform="rotate(-13 100 143)" fill="none" stroke="#000" stroke-opacity="0.18" stroke-width="1" />
      <rect x="20" y="137" width="160" height="3" transform="rotate(-13 100 143)" fill="#fff" opacity="0.18" />
    </g>

    <!-- Accesorio: pajarita -->
    <g id="acc-pajarita" class="acc">
      <path d="M100 163 L85 155.5 Q82 163 85 170.5 Z M100 163 L115 155.5 Q118 163 115 170.5 Z" class="acc-main" />
      <rect x="95.5" y="158.5" width="9" height="9" rx="3" class="acc-main" />
      <rect x="95.5" y="158.5" width="9" height="9" rx="3" fill="#000" opacity="0.2" />
    </g>

    <!-- Pantalla (cara) -->
    <rect x="54" y="68" width="92" height="68" rx="30" fill="url(#g-screen)" />
    <g clip-path="url(#c-screen)">
      <g id="face">
        <!-- El brillo de los ojos es un halo con degradado: un filtro de desenfoque
             habría que recalcularlo en cada fotograma. -->
        <g>
          <g id="eye-l" transform="translate(82 100)">
            <ellipse class="eye-halo" rx="15" ry="19" fill="url(#g-glow)" opacity="0.5" />
            <rect class="eye-open eye-fill" x="-8" y="-11" width="16" height="22" rx="8" />
            <path class="eye-happy" d="M -9 3 Q 0 -8 9 3" opacity="0" />
          </g>
          <g id="eye-r" transform="translate(118 100)">
            <ellipse class="eye-halo" rx="15" ry="19" fill="url(#g-glow)" opacity="0.5" />
            <rect class="eye-open eye-fill" x="-8" y="-11" width="16" height="22" rx="8" />
            <path class="eye-happy" d="M -9 3 Q 0 -8 9 3" opacity="0" />
          </g>
        </g>
        <!-- Accesorio: gafas (se mueven con la mirada) -->
        <g id="acc-gafas" class="acc">
          <circle cx="82" cy="100" r="15" class="acc-lens" />
          <circle cx="118" cy="100" r="15" class="acc-lens" />
          <path d="M96.5 97 Q100 93.5 103.5 97" class="acc-frame" />
        </g>
        <!-- Accesorio: parche pirata sobre el ojo derecho -->
        <g id="acc-parche" class="acc">
          <path d="M50 76 L150 116" stroke="#121317" stroke-width="3.2" />
          <ellipse cx="118" cy="100" rx="13.5" ry="14.5" fill="#121317" />
          <ellipse cx="114" cy="94" rx="5" ry="3" fill="#fff" opacity="0.12" />
        </g>
        <!-- Accesorio: gafas pixeladas -->
        <g id="acc-gafas-pixel" class="acc">${PIXEL_GLASSES}</g>
        <ellipse id="cheek-l" cx="70" cy="117" rx="6" ry="3.5" class="cheek" opacity="0" />
        <ellipse id="cheek-r" cx="130" cy="117" rx="6" ry="3.5" class="cheek" opacity="0" />
        <g class="thinking-dots">
          <circle cx="91" cy="124" r="2.2" class="eye-fill" />
          <circle cx="100" cy="124" r="2.2" class="eye-fill" />
          <circle cx="109" cy="124" r="2.2" class="eye-fill" />
        </g>
      </g>
      <rect x="54" y="68" width="92" height="30" fill="url(#g-screen-gloss)" />
    </g>

    <!-- Accesorio: máscara de gas (respirador sobre la parte baja de la pantalla) -->
    <g id="acc-mascara-gas" class="acc">
      <path d="M36 108 Q52 102 70 112 M164 108 Q148 102 130 112" fill="none" stroke="#25282e" stroke-width="5" stroke-linecap="round" />
      <path d="M68 112 Q100 99 132 112 Q135 136 100 149 Q65 136 68 112 Z" fill="#3a3f47" />
      <path d="M72 114 Q100 103 128 114" fill="none" stroke="#fff" stroke-opacity="0.14" stroke-width="2" />
      <circle cx="78" cy="127" r="6" fill="#2a2d33" />
      <circle cx="122" cy="127" r="6" fill="#2a2d33" />
      <circle cx="100" cy="133" r="12.5" fill="#5d636d" />
      <circle cx="100" cy="133" r="8.5" fill="#2b2f36" />
      <path d="M94 129.5 H106 M93 133 H107 M94 136.5 H106" stroke="#6f7680" stroke-width="1.3" stroke-linecap="round" />
      <circle cx="96" cy="127" r="2" fill="#fff" opacity="0.25" />
    </g>

    <!-- Accesorio: vendas en la cabeza, con una mancha -->
    <g id="acc-vendas" class="acc">
      <path d="M49 66 Q100 45 151 66 L152 77 Q100 57 48 77 Z" fill="#efe8d8" />
      <path d="M52 70 Q100 51 148 70 M60 63 L57 74 M84 55 L82 66 M112 54 L114 65 M138 61 L141 72" fill="none" stroke="#c9bfa8" stroke-width="1.2" />
      <ellipse cx="122" cy="61" rx="6.5" ry="4" fill="#a8231b" opacity="0.75" transform="rotate(14 122 61)" />
      <circle cx="128" cy="66" r="1.6" fill="#a8231b" opacity="0.6" />
      <path d="M52 73 Q44 80 46 94 L52 92 Q51 82 56 76 Z" fill="#e6dec9" />
    </g>

    <!-- Accesorio: gorro de lana (tapa la antena) -->
    <g id="acc-gorro" class="acc">
      <path d="M48 62 C48 18, 152 18, 152 62 Z" class="acc-main" />
      <path d="M72 60 C70 36, 75 30, 80 27 M100 60 V23 M128 60 C130 36, 125 30, 120 27" class="acc-knit" />
      <rect x="44" y="53" width="112" height="14" rx="7" class="acc-main" />
      <rect x="44" y="53" width="112" height="14" rx="7" fill="#000" opacity="0.14" />
      <circle cx="100" cy="21" r="9.5" fill="#fff" stroke="#000" stroke-opacity="0.15" stroke-width="1.5" />
    </g>

    <!-- Accesorio: auriculares -->
    <g id="acc-auriculares" class="acc">
      <path d="M33 100 C28 28, 172 28, 167 100" class="acc-band" />
      <rect x="21" y="86" width="23" height="44" rx="10" class="acc-main" />
      <rect x="156" y="86" width="23" height="44" rx="10" class="acc-main" />
      <rect x="25" y="92" width="6" height="32" rx="3" fill="#fff" opacity="0.28" />
      <rect x="160" y="92" width="6" height="32" rx="3" fill="#fff" opacity="0.28" />
    </g>

    <!-- Accesorio: bandana con el nudo a un lado -->
    <g id="acc-bandana" class="acc">
      <path d="M57 63 Q100 47 143 63 L145 72 Q100 57 55 72 Z" class="acc-main" />
      <path d="M56 69 Q100 54 144 69" fill="none" stroke="#000" stroke-opacity="0.16" stroke-width="1.6" />
      <path d="M151 66 Q166 62 180 72 L172 78 Q162 70 151 70 Z" class="acc-main" />
      <path d="M150 70 Q160 78 166 92 L158 94 Q154 81 147 72 Z" class="acc-main" />
      <path d="M151 66 Q166 62 180 72 L172 78 Q162 70 151 70 Z M150 70 Q160 78 166 92 L158 94 Q154 81 147 72 Z" fill="#000" opacity="0.14" />
      <circle cx="148" cy="67" r="5.5" class="acc-main" />
    </g>

    <!-- Accesorio: gorra de hélice (tapa la antena) -->
    <g id="acc-helice" class="acc">
      <path d="M58 60 C58 25, 142 25, 142 60 Z" class="acc-main" />
      <path d="M89 60 C90 38, 110 38, 111 60 Z" fill="#ffd23f" />
      <path d="M64 50 C67 39, 76 33, 84 31" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="3" stroke-linecap="round" />
      <rect x="52" y="54" width="96" height="9" rx="4.5" class="acc-main" />
      <rect x="52" y="54" width="96" height="9" rx="4.5" fill="#000" opacity="0.15" />
      <rect x="98" y="21" width="4" height="13" rx="2" fill="#6b7280" />
      <ellipse cx="87" cy="21" rx="13" ry="3.4" fill="#ff4d6d" />
      <ellipse cx="113" cy="21" rx="13" ry="3.4" fill="#3ba0ff" />
      <circle cx="100" cy="21" r="3.4" fill="#ffd23f" />
    </g>

    <!-- Accesorio: corona pixelada (tapa la antena) -->
    <g id="acc-corona" class="acc" transform="rotate(-7 100 50)">${CROWN}</g>

    <!-- Accesorio: vidas encima de la cabeza -->
    <g id="acc-vidas" class="acc">${HEARTS}</g>

    <!-- Accesorio: mando en la mano -->
    <g id="acc-mando" class="acc" transform="translate(38 154) rotate(-14)">
      <circle cx="-15" cy="5" r="9.5" class="acc-dark" />
      <circle cx="15" cy="5" r="9.5" class="acc-dark" />
      <rect x="-24" y="-11" width="48" height="20" rx="10" class="acc-dark" />
      <rect x="-21" y="-9" width="22" height="4" rx="2" fill="#fff" opacity="0.12" />
      <rect x="-20" y="-2.6" width="11" height="3.6" rx="1" fill="#e5e7eb" />
      <rect x="-16.3" y="-6.3" width="3.6" height="11" rx="1" fill="#e5e7eb" />
      <circle cx="12" cy="-4" r="2.6" fill="#ff4d6d" />
      <circle cx="17.5" cy="0.5" r="2.6" fill="#3ba0ff" />
      <circle cx="6.5" cy="0.5" r="2.6" fill="#34c759" />
      <circle cx="12" cy="5" r="2.6" fill="#ffd23f" />
    </g>

    <!-- Accesorio: sombrero de paja (tapa la antena) -->
    <g id="acc-sombrero-paja" class="acc">
      <ellipse cx="100" cy="58" rx="68" ry="12" fill="#e2bd5f" />
      <ellipse cx="100" cy="56.5" rx="62" ry="9" fill="#efcf78" />
      <path d="M66 57 C66 22, 134 22, 134 57 Z" fill="#f2d683" />
      <path d="M67 50 C80 54, 120 54, 133 50 L134 57 C120 61, 80 61, 66 57 Z" class="acc-main" />
      <path d="M78 40 C86 30, 114 30, 122 40 M72 64 H128 M58 61 H142" fill="none" stroke="#c99d3d" stroke-width="1.3" stroke-linecap="round" opacity="0.7" />
      <path d="M74 46 C76 34, 86 28, 96 27" fill="none" stroke="#fff" stroke-opacity="0.4" stroke-width="2.4" stroke-linecap="round" />
    </g>

    <!-- Accesorio: libreta negra en la mano (sin nada escrito) -->
    <g id="acc-libreta" class="acc" transform="translate(40 150) rotate(-12)">
      <rect x="-15" y="-20" width="31" height="39" rx="2.5" fill="#15161b" />
      <rect x="14.5" y="-18" width="2.2" height="35" fill="#e9e5d8" />
      <rect x="-15" y="-20" width="5" height="39" rx="2" fill="#000" />
      <rect x="-7" y="-15" width="18" height="2" rx="1" fill="#fff" opacity="0.1" />
    </g>

    <!-- Accesorio: manzana roja en la mano -->
    <g id="acc-manzana" class="acc" transform="translate(38 152) rotate(-8)">
      <path d="M0 -9 C-6 -15, -17 -12, -17 0 C-17 11, -8 17, 0 13 C8 17, 17 11, 17 0 C17 -12, 6 -15, 0 -9 Z" fill="#e0243a" />
      <path d="M-10 -5 C-12 -1, -12 4, -9 8" fill="none" stroke="#fff" stroke-opacity="0.45" stroke-width="2.6" stroke-linecap="round" />
      <path d="M0 -9 C0 -14, 2 -17, 4 -19" fill="none" stroke="#5b3a1e" stroke-width="2.4" stroke-linecap="round" />
      <path d="M3 -15 C8 -21, 14 -19, 15 -16 C10 -12, 6 -12, 3 -15 Z" fill="#3fbf5a" />
    </g>

    <!-- Accesorio: linterna encendida en la mano -->
    <g id="acc-linterna" class="acc" transform="translate(40 156) rotate(20)">
      <path d="M-7 -24 L-22 -58 L22 -58 L7 -24 Z" fill="#fff3b0" opacity="0.2" />
      <rect x="-5.5" y="-14" width="11" height="28" rx="3" fill="#2f3540" />
      <rect x="-5.5" y="-6" width="11" height="2.4" fill="#4a5160" />
      <rect x="-8" y="-24" width="16" height="11" rx="2.5" fill="#4a5160" />
      <ellipse cx="0" cy="-24" rx="6.5" ry="2" fill="#fff6c2" />
      <rect x="-1.6" y="0" width="3.2" height="5" rx="1" fill="#ff4d6d" />
    </g>

    <!-- Accesorio: vial con líquido que brilla -->
    <g id="acc-vial" class="acc" transform="translate(37 152) rotate(-16)">
      <rect x="-7" y="-18" width="14" height="34" rx="6" fill="#dfe9f2" opacity="0.5" />
      <rect x="-5.5" y="-3" width="11" height="17.5" rx="5" fill="#4ff08a" />
      <rect x="-5.5" y="-3" width="11" height="3" rx="1.5" fill="#b6ffd0" />
      <circle cx="-1.5" cy="6" r="1.2" fill="#fff" opacity="0.8" />
      <circle cx="2" cy="10" r="0.9" fill="#fff" opacity="0.7" />
      <rect x="-7" y="-18" width="14" height="34" rx="6" fill="none" stroke="#fff" stroke-opacity="0.8" stroke-width="1.2" />
      <rect x="-8" y="-23" width="16" height="7" rx="2" fill="#3b3f48" />
      <rect x="-4.6" y="-14" width="2.2" height="24" rx="1.1" fill="#fff" opacity="0.5" />
    </g>

    <!-- Accesorio: hierba en una maceta, en la mano -->
    <g id="acc-hierba" class="acc" transform="translate(38 150) rotate(-6)">
      <path d="M0 2 C-3 -8, -12 -14, -16 -12 C-14 -5, -7 0, 0 2 Z" fill="#2f9e44" />
      <path d="M0 2 C3 -8, 12 -14, 16 -12 C14 -5, 7 0, 0 2 Z" fill="#37b24d" />
      <path d="M0 3 C-2 -8, -1 -18, 2 -22 C5 -16, 4 -6, 0 3 Z" fill="#51cf66" />
      <path d="M0 2 V-14" stroke="#1e7a34" stroke-width="1" />
      <path d="M-11 2 H11 L8.5 17 H-8.5 Z" fill="#c8693a" />
      <rect x="-12.5" y="0" width="25" height="5" rx="1.6" fill="#b25a2f" />
      <path d="M-6 8 H6" stroke="#fff" stroke-opacity="0.2" stroke-width="1.6" stroke-linecap="round" />
    </g>

    <!-- Accesorio: spray de primeros auxilios (con una cruz genérica) -->
    <g id="acc-spray" class="acc" transform="translate(40 152) rotate(-12)">
      <rect x="-3" y="-25" width="6" height="5" rx="1" fill="#2b2f36" />
      <rect x="-1" y="-28" width="6" height="3" rx="1" fill="#2b2f36" />
      <rect x="-6" y="-21" width="12" height="5" rx="2" fill="#9aa3ae" />
      <rect x="-8" y="-17" width="16" height="33" rx="4" fill="#eef2f5" />
      <rect x="-8" y="-9" width="16" height="13" fill="#2f9e44" />
      <path d="M0 -7 V2 M-4.5 -2.5 H4.5" stroke="#fff" stroke-width="2.6" stroke-linecap="round" />
      <rect x="-6" y="-15" width="2.4" height="28" rx="1.2" fill="#fff" opacity="0.6" />
    </g>

    <!-- Accesorio: gancho colgando de una cadena, al lado -->
    <g id="acc-gancho" class="acc">
      <path d="M181 14 V58" stroke="#6b7078" stroke-width="3" stroke-dasharray="5 2.5" />
      <path d="M181 58 V80 C181 100, 158 100, 158 84" fill="none" stroke="#8b9099" stroke-width="5" stroke-linecap="round" />
      <path d="M158 84 L154 77" stroke="#8b9099" stroke-width="5" stroke-linecap="round" />
      <path d="M179 66 V80 C179 94, 164 96, 161 88" fill="none" stroke="#fff" stroke-opacity="0.35" stroke-width="1.4" stroke-linecap="round" />
      <circle cx="176" cy="93" r="2.2" fill="#8a3b1f" opacity="0.75" />
      <circle cx="181" cy="72" r="1.6" fill="#8a3b1f" opacity="0.75" />
    </g>

    <!-- Burbujas de estado -->
    <g class="zzz" aria-hidden="true">
      <text x="150" y="58">z</text>
      <text x="160" y="44">z</text>
      <text x="170" y="30">Z</text>
    </g>
    <text class="question" x="152" y="56" aria-hidden="true">?</text>
    <!-- Notas que flotan mientras suena música -->
    <g class="notes" aria-hidden="true">
      <text x="154" y="74">♪</text>
      <text x="164" y="54">♫</text>
      <text x="30" y="66">♪</text>
    </g>
    <!-- Destellos cuando está emocionado -->
    <g class="sparkles" aria-hidden="true">
      <path d="M38 40 l2.4 6 l6 2.4 l-6 2.4 l-2.4 6 l-2.4 -6 l-6 -2.4 l6 -2.4 z" />
      <path d="M160 30 l1.8 4.6 l4.6 1.8 l-4.6 1.8 l-1.8 4.6 l-1.8 -4.6 l-4.6 -1.8 l4.6 -1.8 z" />
      <path d="M170 84 l1.6 4 l4 1.6 l-4 1.6 l-1.6 4 l-1.6 -4 l-4 -1.6 l4 -1.6 z" />
    </g>
  </g>

  <!-- Zona sensible al ratón: fuera de ella los clics llegan al escritorio -->
  <rect id="hit" x="26" y="20" width="148" height="152" rx="56" />
</svg>`

/** Inserta el robot dentro de `host` y devuelve su elemento SVG. */
export function mountRobot(host: HTMLElement): SVGSVGElement {
  host.innerHTML = ROBOT_SVG
  return host.querySelector<SVGSVGElement>('svg')!
}
