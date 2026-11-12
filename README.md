# Mascota

Asistente de escritorio para Windows con forma de robot. Una barra de comandos
al estilo Spotlight para buscar en la web, abrir aplicaciones, tomar notas,
programar recordatorios y usar un temporizador Pomodoro, con IA local opcional
que se ejecuta íntegramente en tu equipo.

[![Descargar para Windows](https://img.shields.io/badge/Descargar-Windows%2010%2F11-0a84ff?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/jmfl2/MascotaIA/releases/latest/download/Mascota-Setup.exe)

[![Última versión](https://img.shields.io/github/v/release/jmfl2/MascotaIA?label=versi%C3%B3n)](https://github.com/jmfl2/MascotaIA/releases/latest)
[![Licencia MIT](https://img.shields.io/badge/licencia-MIT-green)](LICENSE)
![Plataforma](https://img.shields.io/badge/plataforma-Windows%20x64-lightgrey)

## Características

- **Barra de comandos** (`Ctrl+Espacio`): búsqueda en Google, YouTube, Maps y
  GitHub, traductor, lanzador de aplicaciones y favoritos. Al abrirla, tus
  aplicaciones más usadas aparecen las primeras.
- **Productividad:** notas rápidas, recordatorios en lenguaje natural
  (`rec mañana 9:00 dentista`) y temporizador Pomodoro.
- **IA local con Ollama** (opcional): chat, resúmenes, explicaciones y
  comandos en lenguaje natural. Ningún texto sale de tu equipo.
- **Claude, ChatGPT, Perplexity y Gemini:** pregúntales desde la barra o desde
  lo que copias; se abre su web con la pregunta escrita. Con una clave de API
  de Anthropic (opcional), Claude responde dentro de la barra.
- **Calculadora y conversiones:** escribe `12*7+3`, `20% de 85` o
  `5 km en millas` y el resultado aparece el primero.
- **Detector de enlaces sospechosos:** analiza en local los enlaces que copias
  y avisa de suplantaciones, homógrafos y acortadores.
- **Portapapeles inteligente:** al copiar un texto ofrece buscarlo, traducirlo,
  guardarlo, resumirlo o preguntárselo a una IA, e ignora contraseñas y claves.
- **Se actualiza sola:** descarga las versiones nuevas de GitHub y comprueba su
  huella antes de instalarlas.
- **Suelta archivos en el robot:** pregúntale a una IA por ellos, resúmelos,
  comprímelos en un .zip, añádelos a favoritos o copia su ruta.
- **Música en la pestaña:** como la isla del iPhone, la pestaña de arriba
  muestra lo que suena en Spotify, el navegador u otras apps, con carátula y
  botones de anterior, pausa y siguiente.
- **Discreto:** vive escondido en una pestaña en el borde superior de la
  pantalla y apenas consume recursos en reposo.
- **Personalizable:** quince colores, cuarenta y siete accesorios por partes del
  cuerpo (con vista ampliada de cada parte), cinco formas de ojos, color propio
  para los ojos y los accesorios, nombre, nivel de conversación y tono de la IA.
- **Fechas especiales:** en Navidad, Año Nuevo, Halloween y San Valentín se
  disfraza solo, con nieve, confeti, murciélagos o corazones.
- **En español e inglés:** el idioma se elige en los ajustes; la primera vez se
  usa el de Windows.

## Instalación

1. Descarga el instalador:
   **[Mascota-Setup.exe](https://github.com/jmfl2/MascotaIA/releases/latest/download/Mascota-Setup.exe)**.
2. Ejecútalo. El instalador no está firmado con un certificado comercial, por lo
   que Windows SmartScreen mostrará un aviso de editor desconocido. Selecciona
   *Más información* y después *Ejecutar de todas formas*.
3. Sigue el asistente. La instalación es para el usuario actual y no requiere
   permisos de administrador.

Requisitos: Windows 10 u 11 de 64 bits.

### IA local (opcional)

Las funciones de IA necesitan [Ollama](https://ollama.com):

1. Descarga e instala Ollama:
   **[OllamaSetup.exe](https://ollama.com/download/OllamaSetup.exe)**.
2. Abre la barra de Mascota, escribe `ia` y selecciona *Descargar el modelo*
   (`gemma3:4b`, unos 3,3 GB). También está disponible en el icono de la
   bandeja, en *IA local*.

Sin Ollama, el resto de funciones está disponible con normalidad.

### Desinstalación

Desde *Configuración de Windows → Aplicaciones*. Los datos (notas,
recordatorios y ajustes) se conservan en `%APPDATA%\mascota`. Elimina esa
carpeta si no deseas mantenerlos.

## Uso

Acerca el ratón a la pestaña del borde superior y haz clic, o pulsa
`Ctrl+Espacio`. El robot aparece y se abre la barra de comandos.

Sin prefijo, el texto se busca en Google y se sugieren las aplicaciones que
coinciden. Con un prefijo seguido de un espacio se usa un comando concreto:

| Prefijo                     | Función            | Ejemplo                                                    |
| --------------------------- | ------------------ | ---------------------------------------------------------- |
| `g`                         | Google             | `g receta de croquetas`                                    |
| `a`, `abrir`, `app`, `open` | Apps y favoritos   | `a calculadora` · sin texto: favoritos                     |
| `yt`                        | YouTube            | `yt lofi para estudiar`                                    |
| `maps`, `map`               | Google Maps        | `maps farmacia de guardia`                                 |
| `gh`                        | GitHub             | `gh electron/electron`                                     |
| `trad`, `tr`                | Traductor          | `trad hello world` · `trad en: buenos días`                |
| `nota`, `notas`, `n`, `note` | Notas             | `nota comprar pilas` · `notas` para listar y buscar        |
| `rec`, `recordar`, `r`, `remind` | Recordatorios | `rec 10m sacar la ropa` · `rec 18:30 llamar` · `rec tomorrow 8am run` |
| `pomo`, `pomodoro`          | Pomodoro           | `pomo` (25/5) · `pomo 50/10`                               |
| `ia`, `ai`, `chat`, `?`     | Chat con la IA     | `ia ¿qué es una API REST?`                                 |
| `resumir`, `explicar`       | Resumir o explicar | Sin texto, usa el contenido del portapapeles               |
| `link`, `enlace`, `url`     | Comprobar enlace   | `link https://bit.ly/...`                                  |
| `claude`, `cl`              | Claude             | `claude ¿por qué el cielo es azul?`                        |
| `gpt`, `chatgpt`            | ChatGPT            | `gpt ideas para una cena`                                  |
| `pplx`, `perplexity`        | Perplexity         | `pplx mejores portátiles 2026`                             |
| `gem`, `gemini`             | Gemini             | Copia la pregunta y abre Gemini para pegarla               |
| `=`, `calc`                 | Calculadora        | `= 12*7+3` · `calc 30 c en f` (sin prefijo también)        |
| `ajustes`, `config`, `skin` | Ajustes            | Abre la ventana de ajustes                                 |

Los recordatorios aceptan `10m`, `45s`, `2h`, `1h30m`, `en 20 minutos`,
`18:30`, `a las 9`, `mañana 9:00` y `mañana a las 8`, y también en inglés
(`in 20 minutes`, `6:30pm`, `tomorrow at 8am`). Si la hora ya ha pasado, se
programan para el día siguiente.

### Teclado

| Tecla                       | Acción                                                  |
| --------------------------- | ------------------------------------------------------- |
| `↑` `↓` `RePág` `AvPág`     | Seleccionar fila                                        |
| `Intro`                     | Ejecutar la fila seleccionada                           |
| `Supr`                      | Borrar nota, cancelar recordatorio, quitar favorito o quitar de las más usadas |
| `Tab`                       | Fijar el comando de la fila seleccionada                |
| `Retroceso`                 | Con el campo vacío, quitar el comando fijado            |
| `Ctrl+N`                    | En el chat, empezar una conversación nueva              |
| `Esc`                       | Cerrar la barra o detener la respuesta de la IA         |

## Funciones

### IA local

- **Lenguaje natural:** al escribir una frase sin prefijo aparece la opción
  *Interpretar con IA*. La IA elige el comando adecuado y rellena la barra; la
  acción solo se ejecuta cuando confirmas con `Intro`. Por ejemplo,
  «recuérdame en media hora que saque la ropa» se convierte en el recordatorio
  `30m sacar la ropa`.
- **Chat:** con `ia` la barra pasa a ser una conversación con respuestas en
  tiempo real. La conversación no se guarda en disco.
- **Resumir y explicar:** disponible desde la barra o al copiar un texto largo.
- **Consumo de memoria:** el modelo solo se carga al usar la IA y se libera
  tras tres minutos sin uso, o al momento desde *bandeja → IA local → Liberar
  memoria*.
- **Privacidad:** la aplicación solo se comunica con Ollama en `127.0.0.1`.

### Detector de enlaces sospechosos

Al copiar un enlace, o al pegarlo en la barra, se analiza en local y se muestra
uno de tres veredictos: *parece una trampa* (la acción por defecto es no
abrirlo), *precaución* o *sin señales de alarma*. Se revisa lo siguiente:

- Suplantación de más de 40 marcas habituales (bancos, Correos, Agencia
  Tributaria, PayPal, Amazon, Microsoft...), con sustituciones como `paypa1` o
  `rnicrosoft`.
- Homógrafos (letras de otros alfabetos) y dominios en punycode.
- La marca fuera del dominio real (`paypal.com.verificar-cuenta.top`).
- Trucos de URL: usuario antes de `@`, direcciones IP, puertos inusuales,
  esquemas `javascript:` o `file:` y `http` sin cifrar.
- Dominios de alto riesgo, palabras de cebo y descargas con doble extensión.
- Acortadores: se consulta solo al acortador adónde redirige, sin visitar el
  destino.

Es un filtro heurístico, no un antivirus: puede no detectar un engaño bien
elaborado y puede marcar algún enlace legítimo.

### Portapapeles inteligente

Al copiar un texto, el robot ofrece buscarlo, traducirlo, guardarlo como nota o,
con la IA disponible, resumirlo o explicarlo. No ofrece nada cuando:

- la aplicación de origen lo marca como privado (gestores de contraseñas como
  Bitwarden, 1Password o KeePass);
- el texto parece una contraseña, una clave de API, un token, una clave privada,
  un IBAN o una cifra larga;
- un texto largo contiene credenciales (por ejemplo, un archivo `.env`).

El texto copiado nunca se guarda ni se registra, salvo que elijas guardarlo
como nota.

### Personalización

Desde *Ajustes* (bandeja, clic derecho sobre el robot o `ajustes` en la barra):

- **Color:** Clásico, Medianoche, Menta, Coral, Lavanda y Grafito.
- **Accesorios:** uno por zona del robot (cabeza, cara, manos, espalda,
  orejas, cuello y encima de la cabeza). Incluye gorros, gafas, auriculares y
  una serie de objetos temáticos de videojuegos, anime y terror.
- **Nombre** del robot, que también usa la IA.
- **Nivel de conversación:** *discreto* (solo avisos importantes), *normal* o
  *hablador* (saludos, ánimos y recordatorios de descanso).
- **Tono de la IA:** cercano, formal o divertido.
- **Modo de pantalla:** escondido en la pestaña superior (por defecto) o el
  robot siempre visible, que se puede arrastrar a cualquier posición.

### Otras funciones

- **Favoritos:** arrastra un archivo, una carpeta o un acceso directo sobre el
  robot para añadirlo. Se abren con `a <nombre>`.
- **Avisos:** los recordatorios y las fases del Pomodoro se muestran en un
  bocadillo junto al robot, o como notificación de Windows si está oculto.
- **Bandeja del sistema:** mostrar u ocultar, cambiar el atajo, activar o
  desactivar funciones e iniciar con Windows.
- **Atajo personalizado:** además de los predefinidos de la bandeja, admite
  cualquier [acelerador de Electron](https://www.electronjs.org/docs/latest/api/accelerator)
  en el campo `shortcut` de `%APPDATA%\mascota\config.json`.

## Privacidad y datos

Todos los datos se guardan en local, en `%APPDATA%\mascota`: configuración,
notas, recordatorios, favoritos y la caché de iconos. La aplicación no envía
telemetría. Las únicas conexiones a internet son las que abres tú (búsquedas y
enlaces) y la consulta al acortador al revisar un enlace acortado.

Los detalles de seguridad (aislamiento de las páginas, validación de URL e IPC,
límites de la IA) están en [docs/arquitectura.md](docs/arquitectura.md#seguridad).

## Desarrollo

Requisitos: Windows, [Node.js](https://nodejs.org) 20 o superior y Git.

```powershell
git clone https://github.com/jmfl2/MascotaIA.git
cd MascotaIA
npm install
npm run dev
```

| Script              | Descripción                                                  |
| ------------------- | ------------------------------------------------------------ |
| `npm run dev`       | Inicia la aplicación con recarga en caliente.                |
| `npm test`          | Ejecuta los tests (Vitest).                                  |
| `npm run typecheck` | Comprueba los tipos.                                         |
| `npm run build`     | Tipos, tests y compilación en `out/`.                        |
| `npm run preview`   | Ejecuta la versión compilada.                                |
| `npm run dist`      | Compila y genera el instalador en `dist/`.                   |
| `npm run icons`     | Regenera los iconos de `assets/`.                            |

Notas:

- Si PowerShell bloquea `npm` por la política de ejecución, usa `npm.cmd` o
  ejecuta una vez `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.
- Desde WSL, ejecuta los comandos en PowerShell o cmd: Electron debe ser el de
  Windows para que funcionen la transparencia y la bandeja del sistema.
- La versión instalada y `npm run dev` no pueden ejecutarse a la vez.

La estructura del código, cómo añadir comandos, los tests de integración y las
decisiones de diseño están documentados en
[docs/arquitectura.md](docs/arquitectura.md).

### Publicar una versión

1. Actualiza `version` en `package.json` y haz commit.
2. Ejecuta `npm run dist`, que genera `dist\Mascota-Setup.exe`.
3. En GitHub, crea una release con la etiqueta `v<versión>` y adjunta
   `Mascota-Setup.exe`. El botón de descarga de este README apunta siempre a la
   última release, así que no hay que cambiar el enlace.

Las copias instaladas (desde la 0.3.0) encuentran la release nueva solas: la
descargan, comprueban que su huella SHA-256 coincide con la que publica GitHub
y la instalan en silencio. Para eso la release no puede ser un borrador ni una
versión previa, la etiqueta debe ser `vX.Y.Z` y el instalador debe llamarse
`Mascota-Setup.exe`.

Tecnologías: Electron, TypeScript, Vite y Motion.

## Licencia

Distribuido bajo la [licencia MIT](LICENSE).
