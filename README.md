# Mascota 🤖

Un pequeño robot que vive en el escritorio de Windows y te ayuda con tareas
cotidianas. Haz clic en él o pulsa **Ctrl+Espacio** y escribe: busca en la web,
abre apps, guarda notas, ponte recordatorios o arranca un pomodoro. Si copias un
texto, el robot te ofrece buscarlo, traducirlo, guardarlo o resumirlo. Y con
**IA local** (Ollama) entiende lo que le pides en lenguaje natural y puedes
chatear con él sin que nada salga de tu PC. Además te avisa si un enlace que
copias parece una trampa, y puedes cambiarle el color, ponerle accesorios,
un nombre y decidir cuánto habla.

Hecho con **Electron + TypeScript + Vite**, interfaz web y animaciones de muelle.

## Requisitos

- Windows 10 u 11
- Node.js 20 o superior (probado con Node 24)
- *Opcional, para la IA:* [Ollama](https://ollama.com) y un modelo (por defecto
  `gemma3:4b`, unos 3,3 GB). Sin Ollama todo lo demás funciona igual.

  ```powershell
  winget install Ollama.Ollama
  ollama pull gemma3:4b
  ```

  También puedes descargar el modelo desde la propia app: escribe `ia` en la
  barra o usa la bandeja (*IA local*).

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
| `npm test`          | Ejecuta los tests (vitest). Los de Ollama real se saltan.  |
| `npm run build`     | Comprueba los tipos, pasa los tests y compila en `out/`.   |
| `npm run preview`   | Ejecuta la versión compilada.                              |
| `npm run typecheck` | Solo comprueba los tipos.                                  |
| `npm run icons`     | Regenera los iconos PNG de `assets/`.                      |
| `npm run dist`      | Todo lo de `build` y además genera el instalador en `dist/`. |

## Instalar

```powershell
npm run dist
```

Genera `dist\Mascota-Setup-<versión>.exe`. Al ejecutarlo:

- Se instala solo para tu usuario: no pide permisos de administrador. Puedes
  elegir la carpeta, y crea accesos directos en el escritorio y en el menú
  Inicio.
- Al desinstalar se conservan tus notas, recordatorios y ajustes
  (`%APPDATA%\mascota`).
- **Windows SmartScreen** avisará de que el instalador es de un editor
  desconocido, porque no está firmado con un certificado de pago. Pulsa
  *Más información → Ejecutar de todas formas*.
- Si quieres que se abra al encender el PC, actívalo después en *Ajustes →
  Iniciar con Windows* o desde la bandeja.
- No puede estar abierta a la vez que `npm run dev`: es la misma app y solo
  se permite una.

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
| `ia`, `chat`, `?`     | Chat con la IA    | `ia ¿qué es una API REST?`                                       |
| `resumir`, `resume`   | Resumir           | `resumir` (el portapapeles) · `resumir <texto>`                  |
| `explicar`, `explica` | Explicar          | `explicar` (el portapapeles) · `explicar git rebase -i`          |
| `link`, `enlace`, `url` | Comprobar enlace | `link https://bit.ly/...` · sin texto: el del portapapeles       |
| `ajustes`, `config`, `skin` | Ajustes      | Abre la ventana de ajustes                                       |

Formatos de tiempo que entiende `rec`: `10m`, `45s`, `2h`, `1h30m`,
`en 20 minutos`, `1 hora y 30 minutos`, `18:30`, `a las 9`, `mañana 9:00`,
`mañana a las 8`. Si la hora ya pasó hoy, se programa para mañana.

### Detector de enlaces sospechosos

Al **copiar un enlace** (o pegarlo en la barra, donde aparece
*🛡️ Comprobar el enlace antes de abrirlo*), el robot lo analiza **en local** y
te da un veredicto con los motivos:

| Veredicto | Qué hace el robot |
| --------- | ----------------- |
| 🚨 **Parece una trampa** | Se pone en alerta, suena un aviso y el bocadillo se queda hasta que respondas. La opción por defecto es **No abrir**. |
| ⚠️ **Ojo con este enlace** | Se extraña y te enseña los motivos. |
| 🔗 **No veo señales de alarma** | Solo lo comenta si estaba acortado (para decirte adónde lleva) o si está en modo *Hablador*. Nunca dice "seguro". |

Qué mira:

- **Typosquatting:** `paypa1.com`, `rnicrosoft.com`, `netflx.com`… Compara con
  más de 40 marcas que se suelen suplantar (bancos españoles, Correos, la
  Agencia Tributaria, PayPal, Amazon, Microsoft…) teniendo en cuenta números en
  lugar de letras, "rn" por "m" y la distancia de edición.
- **Homógrafos:** letras de otros alfabetos que parecen latinas (`аpple.com` con
  una "а" cirílica) y dominios en punycode (`xn--`).
- **La marca en el sitio equivocado:** `paypal.com.verificar-cuenta.top` (el
  sitio real es `verificar-cuenta.top`), `santander-clientes.com`,
  `paypal.xyz`.
- **Trucos de la URL:** usuario escondido antes de una `@`
  (`https://www.google.com@evil.example`), una IP en lugar de dominio, puertos
  raros, `javascript:` o `file:`, `http` sin cifrar.
- **Señales que suman:** dominios terminados en `.top`, `.xyz`, `.zip`…,
  muchos subdominios o guiones, palabras como "verificar", "login" o "pago", y
  descargas de programas (sobre todo con doble extensión, `factura.pdf.exe`).
- **Acortadores** (bit.ly, t.co, tinyurl…): se pregunta **solo al acortador**
  adónde lleva, sin seguir la redirección, y se analiza el destino. Es la única
  petición de red del detector, y solo se hace con acortadores conocidos.

Se activa o desactiva en *Ajustes → Avisar de enlaces sospechosos*.

> Es un filtro de heurísticas, no un antivirus: puede no detectar una trampa
> bien hecha y puede avisar de algún enlace legítimo. Ante la duda, no abras.

### Skins y personalidad

Abre los **Ajustes** desde la bandeja, con clic derecho sobre el robot o con
`ajustes` en la barra. Los cambios se ven al momento en la vista previa (el
robot te sigue con la mirada; haz clic en él) y en el escritorio.

- **Color:** Clásico, Medianoche, Menta, Coral, Lavanda y Grafito.
- **Accesorios**, uno por zona (si eliges otro de la misma zona, sustituye al
  anterior):
  - *Cabeza:* gorro, corona pixel, gorra de hélice, sombrero de paja o bandana.
    Todos menos la bandana sustituyen a la antena.
  - *Cara:* gafas, gafas pixel o parche pirata. Se mueven con la mirada.
  - *Manos:* mando, libreta negra, manzana, linterna o vial.
  - *Encima:* vidas, tres corazones de 8 bits (uno ya gastado).
  - *Al lado / espalda:* espada o gancho colgando de una cadena.
  - *Orejas:* auriculares. *Cuello:* pajarita.

  Los temáticos (videojuegos, anime, terror) son objetos genéricos que
  recuerdan a esos mundos, sin logos, personajes ni diseños de ninguna obra
  concreta. Se dibujan desde un mapa de caracteres (`pixels()` en
  `robotSvg.ts`), así que añadir uno nuevo es dibujarlo con letras.
- **Nombre:** cómo se llama el robot. Lo usa la IA ("Te llamas…") y aparece al
  saludar.
- **Cuánto habla:**
  - *Discreto:* solo avisos importantes (recordatorios, pomodoro y enlaces
    sospechosos).
  - *Normal:* además te ofrece ayuda cuando copias algo.
  - *Hablador:* además te saluda al arrancar, te anima a mitad del pomodoro, te
    sugiere un descanso tras más de una hora seguida y te riñe si trasnochas.
    Como mucho, un comentario cada 20 minutos y nunca encima de otro aviso.
- **Tono de la IA:** cercano, formal (trata de usted) o divertido.

### IA local (Ollama)

- **Lenguaje natural:** si escribes una frase sin prefijo, aparece
  **✨ Interpretar con IA** debajo de Google. Al elegirla, la IA decide qué
  comando encaja y la barra se rellena como si lo hubieras escrito tú; pulsas
  `Intro` para confirmar. Ejemplos:

  | Escribes                                         | La barra queda en                           |
  | ------------------------------------------------ | ------------------------------------------- |
  | ponme vídeos de cómo cambiar la rueda de una bici | YouTube · `cómo cambiar la rueda de una bici` |
  | recuérdame en media hora que saque la ropa       | Recordatorios · `30m sacar la ropa`         |
  | cómo se dice "me encanta programar" en inglés    | Traductor · `en: me encanta programar`      |
  | dónde hay un hospital cerca de Plaza España      | Google Maps · `hospitales cerca Plaza España` |
  | qué es un agujero negro                          | Chat con la IA (te lo explica)              |

  Solo consulta al modelo cuando eliges esa fila: mientras escribes no se gasta
  GPU.
- **Chat:** `ia` (o `Tab` sobre la fila de IA) cambia la lista por una
  conversación. La respuesta llega a medida que se escribe. `Esc` la detiene,
  `Ctrl+N` empieza otra conversación y *Copiar* (al pasar el ratón) copia una
  respuesta. La conversación vive en memoria: no se guarda en disco.
- **Resumir y explicar:** al copiar un texto largo (un artículo, un correo,
  código), el robot ofrece **✨ Resumir** o **Explicar**; con textos cortos
  ofrece también *Explicar*. Desde la barra: `resumir` o `explicar`.
- **Si Ollama no está:** nada falla. La barra explica qué pasa (no instalado,
  parado o falta el modelo) y ofrece *Iniciar Ollama* o *Descargar el modelo*.
  Las funciones de IA simplemente no aparecen hasta que esté listo.
- **Cambiar de modelo:** bandeja → *IA local* → *Usar modelo* (entre los que
  tengas descargados con `ollama pull`).
- **Privacidad:** la app solo habla con `http://127.0.0.1:11434` (la dirección
  no es configurable); tus textos no salen de tu PC.

### Teclado

| Tecla              | Acción                                                         |
| ------------------ | -------------------------------------------------------------- |
| `↑` `↓` `RePág` `AvPág` | Elegir fila                                               |
| `Intro`            | Abrir · guardar · copiar la nota · empezar                     |
| `Supr`             | Borrar nota, cancelar recordatorio o quitar de favoritos       |
| `Ctrl+N`           | En el chat: conversación nueva                                 |
| `Tab`              | Fijar como etiqueta el comando de la fila elegida              |
| `Retroceso`        | Con el campo vacío, quita la etiqueta                          |
| `Esc`              | Cerrar (en el chat, si está respondiendo: detener)             |

### La pestaña de arriba

Por defecto el robot no está siempre en pantalla: vive escondido en una
pestaña fina en el borde de arriba, en el centro.

- **Acércate** con el ratón y la pestaña crece y muestra su nombre y el atajo.
- **Haz clic** (o pulsa el atajo) y el robot baja de la pestaña y se abre la
  barra. Al cerrarla, vuelve a subir.
- Cuando tiene algo que decirte (un recordatorio, lo que copias…) baja con el
  bocadillo y sube al terminar.
- Con un pomodoro en marcha, la rayita se tiñe de rojo o verde y, al acercarte,
  se ve el progreso.
- **Clic derecho** en la pestaña: ajustes, ocultarla o volver al robot siempre
  en pantalla. También en *Ajustes → En pantalla* y en la bandeja.

### El robot

- **Arrástralo** a donde quieras (con el robot siempre en pantalla): se encoge
  al cogerlo, rebota al soltarlo y recuerda dónde lo dejaste.
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
está en español, al español si no), **Guardar nota** y, con la IA lista,
**Explicar**. Con un texto largo (hasta 20 000 caracteres) ofrece **Resumir** o
**Explicar** con la IA. El bocadillo se va solo a los 6 segundos (o se queda
mientras tengas el ratón encima).

Para no ser pesado ni curioso, **no ofrece nada** cuando:

- la app de origen pide privacidad: los gestores de contraseñas (Bitwarden,
  1Password, KeePass...) marcan lo que copian con
  `ExcludeClipboardContentFromMonitorProcessing` o `Clipboard Viewer Ignore`;
- el texto parece una contraseña, una clave de API, un token (GitHub, AWS,
  Slack, JWT...), una clave privada, un IBAN o solo números (códigos, tarjetas,
  teléfonos);
- es un texto largo que **contiene** una clave, un token o una línea tipo
  `password: …` (por ejemplo, un `.env` o un correo con credenciales);
- es un texto largo y la IA no está lista (no habría nada útil que ofrecer);
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
- **Portapapeles:** ver *Portapapeles inteligente* arriba.
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

## Hoja de ruta

- [x] **Fase 1:** robot en el escritorio, barra de comandos, Google, YouTube, Maps, GitHub y el traductor.
- [x] **Fase 2:** portapapeles inteligente, recordatorios y Pomodoro, lanzador de apps y favoritos, notas rápidas.
- [x] **Fase 3:** IA local con Ollama (lenguaje natural, resúmenes y chat).
- [x] **Fase 4:** avisos de enlaces sospechosos, skins y personalidad.
