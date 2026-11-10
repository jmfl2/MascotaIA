# Arquitectura

Notas técnicas de Mascota: cómo está organizado el código, cómo ampliarlo y por
qué se tomaron algunas decisiones. Para instalarla y usarla, ver el
[README](../README.md).

## Estructura

```
mascota/
├── src/
│   ├── main/            # proceso principal
│   │   ├── index.ts         # arranque e IPC
│   │   ├── *Window.ts       # ventanas: robot, pestaña, barra y bocadillo
│   │   ├── dock.ts          # modo pestaña: cuándo baja y sube el robot
│   │   ├── commandRunner.ts # ejecuta los comandos y guarda sus acciones
│   │   ├── features.ts      # conecta recordatorios, pomodoro, portapapeles y favoritos
│   │   ├── ai/              # estado de Ollama, interpretación y conversación
│   │   └── services/        # notas, recordatorios, pomodoro, lanzador, portapapeles
│   ├── preload/         # puente seguro entre las páginas y Electron (window.mascota)
│   ├── renderer/        # interfaz: robot, pestaña, barra, bocadillo y ajustes
│   ├── commands/        # un módulo por comando + motor de sugerencias (sin Electron)
│   ├── security/        # detector de enlaces sospechosos y desacortador (sin Electron)
│   ├── shared/          # tipos IPC, skins y personalidad
│   └── ai/              # cliente de Ollama, prompts, NDJSON y Markdown seguro (sin Electron)
├── assets/              # iconos (generados con npm run icons)
└── scripts/
```

## Añadir un comando

Los comandos viven en `src/commands/` y **no importan Electron**: lo que
necesitan del sistema les llega en `ctx` (`CommandContext`). Así se prueban con
un contexto falso (`src/commands/testing.ts`).

**Un comando web** solo declara su URL:

```ts
// src/commands/wikipedia.ts
import { webCommand } from './web'

export const wikipedia = webCommand({
  id: 'wikipedia',
  name: 'Wikipedia',
  prefixes: ['wiki', 'w'],
  hint: 'Buscar en la enciclopedia',
  placeholder: 'Buscar en Wikipedia…',
  accent: '#64748b',
  iconPath: 'M4 6h16 M4 12h16 M4 18h10', // trazado SVG de 24x24
  allowedHosts: ['es.wikipedia.org'],
  buildUrl(query) {
    const url = new URL('https://es.wikipedia.org/w/index.php')
    url.searchParams.set('search', query)
    return url
  }
})
```

**Cualquier otro comando** implementa `suggest(query, ctx)` y devuelve filas con
su acción:

```ts
export const hola: CommandModule = {
  id: 'hola', name: 'Saludo', prefixes: ['hola'], hint: 'Di hola',
  placeholder: 'Tu nombre…', accent: '#ec4899', iconPath: 'M12 4v16',
  suggest(query, ctx) {
    return [{
      title: `Hola, ${query || 'mundo'}`,
      run: () => {
        ctx.copyText(`Hola, ${query}`)
        return { kind: 'close', mood: 'happy', toast: 'Copiado' }
      }
    }]
  }
}
```

Después, añádelo a `COMMANDS` en `src/commands/index.ts`. La barra lo mostrará
sola.

## Tests

```powershell
npm test                      # tests unitarios (no necesitan Ollama)

# Contra un Ollama real (comprueba que el prompt funciona con el modelo):
set OLLAMA_TEST=1
npx vitest run src/ai/ollama.integration.test.ts
# otro modelo: set OLLAMA_MODEL=qwen2.5:7b

# Contra un acortador real (youtu.be), sin visitar el destino:
set NET_TEST=1
npx vitest run src/security/expand.integration.test.ts
```

## Seguridad

- **Aislamiento:** las páginas corren con `contextIsolation`, `sandbox` y sin
  `nodeIntegration`. Solo ven la API mínima de `window.mascota` que define
  `src/preload/index.ts`, nunca `ipcRenderer` ni `require`.
- **El renderer no decide qué se ejecuta:** la barra envía el texto y recibe una
  lista de filas para pintar. Las acciones (abrir esta URL, borrar esta nota,
  lanzar esta app) se quedan en el proceso principal, y al pulsar `Intro` la
  barra solo dice "fila 3 de la consulta 42". Si la lista cambió entretanto, la
  petición se descarta.
- **URLs:** el texto se limpia (normalización Unicode, sin caracteres de control
  ni invisibles `\p{Cc}`/`\p{Cf}`), se codifica con `URLSearchParams` o
  `encodeURIComponent` y se comprueba que el resultado sea `https` y vaya a un
  dominio permitido antes de `shell.openExternal`.
- **Lanzador:** solo abre lo que está en el índice del menú Inicio o en tus
  favoritos; el texto que escribes nunca se usa como ruta. Las apps de la Store
  se lanzan con `explorer.exe shell:AppsFolder\<AppID>` pasando los argumentos
  como lista y sin shell. Los archivos soltados se comprueban (ruta absoluta y
  existente) antes de guardarlos.
- **Portapapeles:** ver *Portapapeles inteligente* en el [README](../README.md#portapapeles-inteligente).
- **Enlaces:** el análisis es local. Al desacortar solo se contacta con hosts de
  la lista de acortadores, por https, con `redirect: 'manual'` y sin leer el
  cuerpo de la respuesta; en cuanto el siguiente salto no es un acortador, no se
  hace ninguna petición más. Ante un enlace sospechoso, la acción por defecto es
  no abrirlo.
- **Ajustes:** la skin, los accesorios y la personalidad se validan contra
  listas cerradas en el proceso principal; el nombre se limpia de caracteres de
  control e invisibles y se recorta a 20 caracteres.
- **IA:** el modelo nunca ejecuta nada. Para interpretar, devuelve un JSON
  restringido por esquema (`format` de Ollama) con un comando de una lista
  cerrada y un texto; se valida y se coloca en la barra como si lo hubieras
  escrito, de modo que pasa por las mismas validaciones y tú confirmas con
  `Intro`. Las respuestas del chat se pintan con un Markdown propio que solo
  crea nodos con `textContent` (sin `innerHTML`): un modelo no puede inyectar
  HTML ni enlaces. Solo se contacta con `127.0.0.1`.
- **IPC:** cada mensaje comprueba que viene de la ventana esperada y se validan
  tipos y longitudes.
- **Páginas cerradas:** se bloquean la navegación, las ventanas emergentes, los
  `<webview>` y todas las peticiones de permisos, con una CSP estricta
  (`script-src 'self'`). El texto se pinta siempre con `textContent`.
- **Datos:** los JSON de `%APPDATA%\mascota` se validan campo a campo al leerlos
  y se escriben de forma atómica (archivo temporal + renombrar).

## Decisiones de diseño

- **Electron y no Tauri:** Electron tiene `setIgnoreMouseEvents(true, { forward: true })`,
  así que las zonas transparentes dejan pasar los clics. Con Tauri esto es
  bastante más frágil en Windows.
- **Clics a través, decididos por el proceso principal:** cada ~33 ms compara la
  posición global del cursor con la silueta del robot y activa o desactiva la
  captura del ratón. Así también funciona al arrastrar un archivo por encima,
  cuando la página no recibe eventos del ratón.
- **Cristal CSS en vez de Acrylic:** Windows no permite combinar el Acrylic real
  con esquinas de 24 px en una ventana sin bordes (impone unos 8 px). Se eligió
  priorizar la forma de iOS: el panel es translúcido, con brillo, borde fino y
  sombra suave, pero no difumina el escritorio que hay detrás.
- **Cuatro ventanas:** el robot (200×200), la pestaña de arriba, la barra
  centrada como Spotlight y el bocadillo, que se coloca al lado del robot con
  más sitio y lo sigue al moverlo.
- **Modo pestaña con «motivos»:** el robot está fuera mientras haya algún
  motivo (barra abierta, bocadillo visible) y sube 0,9 s después de que no
  quede ninguno. Así, si se cierra la barra y llega un aviso, no sube y baja.
  Escondido, su ventana está oculta y no gasta en animarse. La cercanía del
  ratón a la pestaña la calcula el proceso principal (sondeando más despacio si
  el cursor está lejos), igual que el robot sabe si lo tienes encima.
- **Muelles:** la barra y el bocadillo usan `motion` (`type: 'spring'`). El robot
  usa un muelle propio (`src/renderer/robot/spring.ts`) en un único bucle por
  fotograma, porque sus objetivos cambian continuamente (la mirada sigue al
  cursor 30 veces por segundo). Las decoraciones de estado usan CSS con una
  curva de muelle `linear()`.
- **Arrastre propio:** no se usa `-webkit-app-region: drag` porque se come los
  clics e impide animar al robot mientras se mueve.
- **Recordatorios por sondeo:** se revisan cada 5 s en lugar de usar un
  `setTimeout` por recordatorio, que se desajusta al suspender el PC y no admite
  esperas de más de unos 24 días.
- **IA bajo demanda y con confirmación:** interpretar solo consulta al modelo
  si eliges la fila, y el resultado se muestra antes de ejecutarse.
- **Modelo precalentado, pero solo cuando hace falta:** al entrar en `ia`,
  `resumir` o `explicar` se carga el modelo en segundo plano. Abrir la barra
  para otra cosa no lo carga, porque un modelo de 4B ocupa varios GB de RAM.
  Ollama lo suelta tras 3 minutos sin uso, y desde la bandeja (*IA local →
  Liberar memoria*) se puede soltar al momento. Todas las peticiones usan el
  mismo tamaño de contexto: si cambiara, Ollama recargaría el modelo.
- **Ollama en modo ahorro:** el `ollama serve` que arranca la mascota atiende
  una petición a la vez, con un solo modelo cargado, flash attention y caché de
  contexto en 8 bits. Al salir de la mascota se cierra ese servidor. Si Ollama
  ya estaba abierto por su cuenta, se respeta su configuración y solo se
  descarga el modelo.
- **`ollama serve` y no la app de bandeja de Ollama:** al arrancar Ollama desde
  la mascota se lanza solo el servidor, sin ventana. Lanzada desde Electron, la
  app de bandeja no llegaba a levantar su servidor.
- **Iconos de apps desde el shell de Windows:** `app.getFileIcon` da como mucho
  32 px, pone la flecha de acceso directo y no sirve para las apps de la Store.
  Por eso, tras indexar, un único PowerShell pide al shell los iconos a 256 px
  sin superposiciones (`src/main/services/iconExtractor.ts`) y los reduce a
  64 px. Tarda unos segundos en segundo plano; mientras tanto se ve el de
  Electron. Las rutas le llegan por la entrada estándar, nunca dentro del script.
- **Skins por variables CSS:** cada skin es una lista de colores en
  `src/shared/appearance.ts` que se aplica como variables CSS al SVG. Así una
  skin nueva es una línea de código y los degradados, ojos y accesorios la
  siguen solos. El SVG del robot vive en `robotSvg.ts` y lo comparten el
  escritorio y la vista previa de los ajustes.
- **Electron 45:** la API del portapapeles es asíncrona (como `navigator.clipboard`)
  y los formatos nativos de Windows se consultan con
  `clipboard.has('electron application/osclipboard;format="…"')`.
