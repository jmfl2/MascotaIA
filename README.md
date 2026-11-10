# Mascota 🤖

Un pequeño robot que vive en el escritorio de Windows y te ayuda con tareas
cotidianas. Haz clic en él o pulsa **Ctrl+Espacio** y escribe: busca en la web,
abre apps, guarda notas, ponte recordatorios o arranca un pomodoro. Y si copias
un texto, el robot te ofrece buscarlo, traducirlo o guardarlo.

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

| Script              | Qué hace                                                   |
| ------------------- | ---------------------------------------------------------- |
| `npm run dev`       | Arranca la app con recarga en caliente de la interfaz.     |
| `npm test`          | Ejecuta los tests (vitest).                                |
| `npm run build`     | Comprueba los tipos, pasa los tests y compila en `out/`.   |
| `npm run preview`   | Ejecuta la versión compilada.                              |
| `npm run typecheck` | Solo comprueba los tipos.                                  |
| `npm run icons`     | Regenera los iconos PNG de `assets/`.                      |

## Cómo se usa

Abre la barra con un clic en el robot o con `Ctrl+Espacio`.

### Sin prefijo

Escribe y pulsa `Intro` para buscar en Google. Si lo que escribes coincide con
una app del menú Inicio o con un favorito, aparece en la lista; si coincide muy
bien (`spoti` → Spotify), aparece la primera. Con el campo vacío ves todos los
comandos.

### Con prefijo

Empieza con un prefijo y un espacio: el prefijo se convierte en una etiqueta.

| Prefijo               | Qué hace          | Ejemplo                                                          |
| --------------------- | ----------------- | ---------------------------------------------------------------- |
| `g`                   | Google            | `g receta de croquetas`                                          |
| `abrir`, `a`, `app`   | Apps y favoritos  | `a calculadora`, `a descargas` · sin texto: tus favoritos        |
| `yt`                  | YouTube           | `yt lofi para estudiar`                                          |
| `maps`, `map`         | Google Maps       | `maps farmacia de guardia`                                       |
| `gh`                  | GitHub            | `gh electron/electron` (abre el repo) o `gh spring physics`      |
| `trad`, `tr`          | Traductor         | `trad hello world` → español, `trad en: buenos días` → inglés     |
| `nota`, `notas`, `n`  | Notas rápidas     | `nota comprar pilas` · `notas` lista y busca                     |
| `rec`, `recordar`, `r`| Recordatorios     | `rec 10m sacar la ropa` · `rec 18:30 llamar` · `rec mañana 9:00 dentista` |
| `pomo`, `pomodoro`    | Pomodoro          | `pomo` (25/5) · `pomo 50/10` · si ya hay uno: detener o saltar fase |

Formatos de tiempo que entiende `rec`: `10m`, `45s`, `2h`, `1h30m`,
`en 20 minutos`, `1 hora y 30 minutos`, `18:30`, `a las 9`, `mañana 9:00`,
`mañana a las 8`. Si la hora ya pasó hoy, se programa para mañana.

### Teclado

| Tecla              | Acción                                                         |
| ------------------ | -------------------------------------------------------------- |
| `↑` `↓` `RePág` `AvPág` | Elegir fila                                               |
| `Intro`            | Abrir · guardar · copiar la nota · empezar                     |
| `Supr`             | Borrar nota, cancelar recordatorio o quitar de favoritos       |
| `Tab`              | Fijar como etiqueta el comando de la fila elegida              |
| `Retroceso`        | Con el campo vacío, quita la etiqueta                          |
| `Esc`              | Cerrar                                                         |

### El robot

- **Arrástralo** a donde quieras: se encoge al cogerlo, rebota al soltarlo y
  recuerda dónde lo dejaste.
- **Suelta encima** una carpeta, un archivo o un acceso directo y se añade a
  favoritos (luego: `a nombre`).
- Te sigue con la mirada, escucha cuando abres la barra, se alegra al ejecutar
  un comando, se confunde si algo falla y se duerme si no mueves el ratón en
  3 minutos.
- **Bocadillo:** avisa de recordatorios (con *Hecho* y *En 10 min*), del final
  de cada fase del pomodoro y de lo que copias. Si el robot está oculto, los
  avisos llegan como notificación de Windows.
- **Pomodoro:** mientras hay uno activo, la luz del pecho se convierte en una
  barrita de progreso (roja concentrándote, verde descansando).

### Portapapeles inteligente

Al copiar un texto corto, el robot ofrece **Buscar**, **Traducir** (al inglés si
está en español, al español si no) o **Guardar nota**. El bocadillo se va solo a
los 6 segundos (o se queda mientras tengas el ratón encima). *Resumir* llegará
con la IA local en la fase 3.

Para no ser pesado ni curioso, **no ofrece nada** cuando:

- la app de origen pide privacidad: los gestores de contraseñas (Bitwarden,
  1Password, KeePass...) marcan lo que copian con
  `ExcludeClipboardContentFromMonitorProcessing` o `Clipboard Viewer Ignore`;
- el texto parece una contraseña, una clave de API, un token (GitHub, AWS,
  Slack, JWT...), una clave privada, un IBAN o solo números (códigos, tarjetas,
  teléfonos);
- es muy largo (más de 300 caracteres) o tiene varias líneas (código, tablas);
- la barra está abierta.

El texto copiado **nunca se guarda en disco ni se registra**, salvo que pulses
*Guardar nota*. Se desactiva desde la bandeja: *Portapapeles inteligente*.

### Bandeja del sistema

Clic para mostrar u ocultar el robot. Con clic derecho: abrir la barra, cambiar
el atajo, activar o desactivar el portapapeles inteligente, detener el pomodoro,
*Iniciar con Windows* y salir.

### Cambiar el atajo

Desde la bandeja puedes elegir entre varios atajos predefinidos. Para usar otro,
edita `shortcut` en `%APPDATA%\mascota\config.json` con cualquier
[acelerador de Electron](https://www.electronjs.org/docs/latest/api/accelerator)
(por ejemplo `"Super+Shift+K"`) y reinicia la app. Si otra aplicación ya usa el
atajo, la mascota vuelve al anterior y te avisa.

### Tus datos

Todo se guarda en local, en `%APPDATA%\mascota\`: `config.json`, `notes.json`,
`reminders.json` y `favorites.json`. Los recordatorios sobreviven a un reinicio:
si vencen con la app cerrada, avisan al abrirla. El pomodoro vive en memoria.

## Estructura

```
mascota/
├── src/
│   ├── main/            # proceso principal
│   │   ├── index.ts         # arranque e IPC
│   │   ├── *Window.ts       # ventanas: robot, barra y bocadillo
│   │   ├── commandRunner.ts # ejecuta los comandos y guarda sus acciones
│   │   ├── features.ts      # conecta recordatorios, pomodoro, portapapeles y favoritos
│   │   └── services/        # notas, recordatorios, pomodoro, lanzador, portapapeles
│   ├── preload/         # puente seguro entre las páginas y Electron (window.mascota)
│   ├── renderer/        # interfaz: robot.html, bar.html y bubble.html
│   ├── commands/        # un módulo por comando + motor de sugerencias (sin Electron)
│   ├── shared/          # tipos y canales IPC comunes
│   └── ai/              # cliente de Ollama (fase 3)
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
- **Portapapeles:** ver *Portapapeles inteligente* arriba.
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
- **Tres ventanas:** el robot (200×200), la barra centrada como Spotlight y el
  bocadillo, que se coloca al lado del robot con más sitio y lo sigue al moverlo.
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
- **Electron 45:** la API del portapapeles es asíncrona (como `navigator.clipboard`)
  y los formatos nativos de Windows se consultan con
  `clipboard.has('electron application/osclipboard;format="…"')`.

## Hoja de ruta

- [x] **Fase 1:** robot en el escritorio, barra de comandos, Google, YouTube, Maps, GitHub y el traductor.
- [x] **Fase 2:** portapapeles inteligente, recordatorios y Pomodoro, lanzador de apps y favoritos, notas rápidas.
- [ ] **Fase 3:** IA local con Ollama (lenguaje natural, resúmenes y chat).
- [ ] **Fase 4:** avisos de enlaces sospechosos, skins y personalidad.
