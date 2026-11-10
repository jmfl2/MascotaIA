# Mascota 🤖

Un pequeño robot que vive en el escritorio de Windows y te ayuda con tareas
cotidianas. Haz clic en él o pulsa **Ctrl+Espacio** y escribe: busca en Google,
YouTube, Maps, GitHub o traduce texto sin abrir antes el navegador.

Hecho con **Electron + TypeScript + Vite**, interfaz web y animaciones de muelle.

## Requisitos

- Windows 10 u 11
- Node.js 20 o superior (probado con Node 24)

> Si trabajas desde WSL, ejecuta los comandos en **PowerShell o cmd de Windows**,
> no dentro de WSL. Electron tiene que ser el de Windows para que funcionen la
> transparencia, la bandeja del sistema y los clics que atraviesan la ventana.

## Puesta en marcha

```powershell
cd mascota
npm install
npm run dev
```

> **¿PowerShell dice que «la ejecución de scripts está deshabilitada»?** Es la
> política de ejecución por defecto de Windows, que bloquea `npm.ps1`. Usa
> `npm.cmd run dev` (o abre `cmd`), o permítelo para tu usuario una sola vez con
> `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

| Script              | Qué hace                                                 |
| ------------------- | -------------------------------------------------------- |
| `npm run dev`       | Arranca la app con recarga en caliente de la interfaz.   |
| `npm run build`     | Comprueba los tipos y compila todo en `out/`.            |
| `npm run preview`   | Ejecuta la versión compilada.                            |
| `npm run typecheck` | Solo comprueba los tipos.                                |
| `npm run icons`     | Regenera los iconos PNG de `assets/`.                    |

## Cómo se usa

- **Abrir la barra:** clic en el robot o `Ctrl+Espacio`.
- **Buscar en Google:** escribe y pulsa `Intro`.
- **Otros destinos:** empieza con un prefijo y un espacio. El prefijo se convierte en una etiqueta:

| Prefijo       | Destino     | Ejemplo                          |
| ------------- | ----------- | -------------------------------- |
| *(ninguno)* o `g` | Google  | `receta de croquetas`            |
| `yt`          | YouTube     | `yt lofi para estudiar`          |
| `maps`, `map` | Google Maps | `maps farmacia de guardia`       |
| `gh`          | GitHub      | `gh electron/electron` (abre el repo) o `gh spring physics` |
| `trad`, `tr`  | Traductor   | `trad hello world` → español, `trad en: buenos días` → inglés |

- **Teclado:** `↑`/`↓` para elegir otro destino para el mismo texto, `Tab` para
  fijar ese destino como etiqueta, `Retroceso` con el campo vacío para quitar la
  etiqueta y `Esc` para cerrar.
- **El robot:** se arrastra con el ratón (se encoge al cogerlo y rebota al
  soltarlo) y recuerda dónde lo dejaste. Te sigue con la mirada, se pone a
  escuchar cuando abres la barra, se alegra cuando ejecutas un comando, se
  confunde si algo falla y se duerme si no mueves el ratón en 3 minutos.
- **Bandeja del sistema:** clic para mostrar u ocultar el robot. Con clic derecho
  puedes cambiar el atajo, activar *Iniciar con Windows* o salir.

### Cambiar el atajo

Desde la bandeja puedes elegir entre varios atajos predefinidos. Para usar otro,
edita `shortcut` en `%APPDATA%\mascota\config.json` con cualquier
[acelerador de Electron](https://www.electronjs.org/docs/latest/api/accelerator)
(por ejemplo `"Super+Shift+K"`) y reinicia la app. Si otra aplicación ya usa el
atajo, la mascota vuelve al anterior y te avisa.

## Estructura

```
mascota/
├── src/
│   ├── main/        # proceso principal: ventanas, atajo, bandeja, IPC, configuración
│   ├── preload/     # puente seguro entre las páginas y Electron (window.mascota)
│   ├── renderer/    # interfaz: robot.html (robot SVG) y bar.html (barra de comandos)
│   ├── commands/    # un módulo por comando (google, youtube, maps, github, translate)
│   ├── shared/      # tipos y canales IPC comunes
│   └── ai/          # cliente de Ollama (fase 3)
├── assets/          # iconos (generados con npm run icons)
└── scripts/
```

## Añadir un comando

1. Crea `src/commands/micomando.ts`:

   ```ts
   import type { CommandModule } from './types'

   export const wikipedia: CommandModule = {
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
   }
   ```

2. Añádelo a `COMMANDS` en `src/commands/index.ts`.

La barra lo mostrará sola y el proceso principal lo validará: solo se abre si la
URL es `https` y su dominio está en `allowedHosts`.

## Seguridad

- **Aislamiento:** las páginas corren con `contextIsolation`, `sandbox` y sin
  `nodeIntegration`. Solo ven la API mínima de `window.mascota` que define
  `src/preload/index.ts`, nunca `ipcRenderer` ni `require`.
- **El renderer no abre URLs:** envía el id del comando y el texto. El proceso
  principal limpia el texto (normaliza Unicode y quita caracteres de control y
  caracteres invisibles o que invierten la dirección, `\p{Cc}`/`\p{Cf}`), lo
  codifica con `URLSearchParams` o `encodeURIComponent` y comprueba el protocolo
  y el dominio antes de llamar a `shell.openExternal`.
- **IPC:** cada mensaje comprueba que viene de la ventana esperada y se validan
  los tipos y longitudes del contenido.
- **Páginas cerradas:** se bloquean la navegación, las ventanas emergentes, los
  `<webview>` y todas las peticiones de permisos. Hay una política CSP estricta
  (`script-src 'self'`).
- **Sin HTML del usuario:** el texto escrito se pinta siempre con `textContent`.

## Decisiones de diseño

- **Electron y no Tauri:** Electron tiene `setIgnoreMouseEvents(true, { forward: true })`,
  así que las zonas transparentes dejan pasar los clics y la ventana sigue
  recibiendo el movimiento del ratón para saber cuándo estás encima del robot.
  Con Tauri esto es bastante más frágil en Windows.
- **Cristal CSS en vez de Acrylic:** Windows no permite combinar el Acrylic real
  con esquinas de 24 px en una ventana sin bordes (impone unos 8 px). Se eligió
  priorizar la forma de iOS: el panel es translúcido, con brillo, borde fino y
  sombra suave, pero no difumina el escritorio que hay detrás.
- **Dos ventanas:** el robot es una ventana pequeña de 200×200 y la barra es otra
  ventana centrada, como Spotlight, para que nunca se salga de la pantalla.
- **Muelles:** la barra usa `motion` (`type: 'spring'`). El robot usa un muelle
  propio (`src/renderer/robot/spring.ts`) en un único bucle por fotograma, porque
  sus objetivos cambian continuamente (la mirada sigue al cursor 30 veces por
  segundo). Las decoraciones de estado usan CSS con una curva de muelle `linear()`.
- **Arrastre propio:** no se usa `-webkit-app-region: drag` porque se come los
  clics e impide animar al robot mientras se mueve. El proceso principal sigue
  al cursor y mueve la ventana.

## Hoja de ruta

- [x] **Fase 1:** robot en el escritorio, barra de comandos, Google, YouTube, Maps, GitHub y el traductor.
- [ ] **Fase 2:** portapapeles inteligente, recordatorios y Pomodoro, lanzador de apps y notas rápidas.
- [ ] **Fase 3:** IA local con Ollama (lenguaje natural, resúmenes y chat).
- [ ] **Fase 4:** avisos de enlaces sospechosos, skins y personalidad.
