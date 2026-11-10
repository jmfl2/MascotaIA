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
export const ROBOT_SVG = `<svg id="robot" class="robot" viewBox="0 0 200 200" aria-label="Robot mascota" role="img">
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
    <filter id="f-eye-glow" x="-100%" y="-100%" width="300%" height="300%">
      <feGaussianBlur stdDeviation="2.4" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
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
        <g filter="url(#f-eye-glow)">
          <g id="eye-l" transform="translate(82 100)">
            <rect class="eye-open eye-fill" x="-8" y="-11" width="16" height="22" rx="8" />
            <path class="eye-happy" d="M -9 3 Q 0 -8 9 3" opacity="0" />
          </g>
          <g id="eye-r" transform="translate(118 100)">
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

    <!-- Burbujas de estado -->
    <g class="zzz" aria-hidden="true">
      <text x="150" y="58">z</text>
      <text x="160" y="44">z</text>
      <text x="170" y="30">Z</text>
    </g>
    <text class="question" x="152" y="56" aria-hidden="true">?</text>
  </g>

  <!-- Zona sensible al ratón: fuera de ella los clics llegan al escritorio -->
  <rect id="hit" x="26" y="20" width="148" height="152" rx="56" />
</svg>`

/** Inserta el robot dentro de `host` y devuelve su elemento SVG. */
export function mountRobot(host: HTMLElement): SVGSVGElement {
  host.innerHTML = ROBOT_SVG
  return host.querySelector<SVGSVGElement>('svg')!
}
