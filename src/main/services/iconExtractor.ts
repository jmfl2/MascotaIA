/**
 * Iconos de apps en alta resolución.
 *
 * `app.getFileIcon` de Electron en Windows da como mucho 32 px y, en accesos
 * directos (.lnk), con la flechita superpuesta; además no sirve para las apps
 * de la Microsoft Store. Aquí se piden al shell de Windows a 256 px (lista de
 * imágenes "jumbo", sin superposiciones), se reducen a 64 px con buen filtro y
 * se devuelven como PNG. Funciona igual con rutas y con `shell:AppsFolder\<AppID>`.
 *
 * Se lanza un único PowerShell por lote. Las rutas van por la entrada estándar,
 * una por línea, y solo se usan como nombre a resolver por el shell: nunca se
 * ejecutan ni se meten en el script.
 */
import { execFile } from 'node:child_process'
import { constants, setPriority } from 'node:os'

/** Tamaño del PNG: suficiente para 28 px de CSS hasta con escalado del 225 %. */
const SIZE = 64
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/
const MAX_PNG_BASE64 = 64 * 1024

const SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
[Console]::InputEncoding = [Text.Encoding]::UTF8
[Console]::OutputEncoding = [Text.Encoding]::UTF8
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;

public static class MascotaIcons {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  struct SHFILEINFO {
    public IntPtr hIcon; public int iIcon; public uint dwAttributes;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string szDisplayName;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 80)] public string szTypeName;
  }

  [ComImport, Guid("46EB5926-582E-4017-9FDF-E8998DAA0950"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IImageList {
    [PreserveSig] int Add(IntPtr a, IntPtr b, ref int c);
    [PreserveSig] int ReplaceIcon(int a, IntPtr b, ref int c);
    [PreserveSig] int SetOverlayImage(int a, int b);
    [PreserveSig] int Replace(int a, IntPtr b, IntPtr c);
    [PreserveSig] int AddMasked(IntPtr a, int b, ref int c);
    [PreserveSig] int Draw(IntPtr a);
    [PreserveSig] int Remove(int a);
    [PreserveSig] int GetIcon(int i, int flags, ref IntPtr icon);
  }

  [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
  static extern int SHParseDisplayName(string name, IntPtr ctx, out IntPtr pidl, uint sfgaoIn, out uint sfgaoOut);
  [DllImport("shell32.dll")]
  static extern IntPtr SHGetFileInfo(IntPtr pidl, uint attr, ref SHFILEINFO info, uint size, uint flags);
  [DllImport("shell32.dll")]
  static extern int SHGetImageList(int list, ref Guid riid, [MarshalAs(UnmanagedType.Interface)] out IImageList ppv);
  [DllImport("user32.dll")] static extern bool DestroyIcon(IntPtr h);
  [DllImport("ole32.dll")] static extern void CoTaskMemFree(IntPtr p);

  const uint SHGFI_SYSICONINDEX = 0x4000, SHGFI_PIDL = 0x8;
  const int SHIL_JUMBO = 4, ILD_TRANSPARENT = 1;
  static IImageList jumbo;

  // Lado del cuadrado (desde la esquina superior izquierda) que contiene píxeles visibles.
  static int Extent(Bitmap bmp) {
    var data = bmp.LockBits(new Rectangle(0, 0, bmp.Width, bmp.Height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
    try {
      var row = new byte[data.Stride];
      int extent = 0;
      for (int y = 0; y < bmp.Height; y++) {
        Marshal.Copy(IntPtr.Add(data.Scan0, y * data.Stride), row, 0, row.Length);
        for (int x = 0; x < bmp.Width; x++)
          if (row[x * 4 + 3] > 0) extent = Math.Max(extent, Math.Max(x, y) + 1);
      }
      return extent;
    } finally { bmp.UnlockBits(data); }
  }

  public static string Png(string target, int size) {
    IntPtr pidl; uint sfgao;
    if (SHParseDisplayName(target, IntPtr.Zero, out pidl, 0, out sfgao) != 0) return null;
    var info = new SHFILEINFO();
    try {
      if (SHGetFileInfo(pidl, 0, ref info, (uint)Marshal.SizeOf(info), SHGFI_SYSICONINDEX | SHGFI_PIDL) == IntPtr.Zero) return null;
    } finally { CoTaskMemFree(pidl); }

    if (jumbo == null) {
      Guid iid = typeof(IImageList).GUID;
      if (SHGetImageList(SHIL_JUMBO, ref iid, out jumbo) != 0) return null;
    }
    IntPtr hIcon = IntPtr.Zero;
    if (jumbo.GetIcon(info.iIcon, ILD_TRANSPARENT, ref hIcon) != 0 || hIcon == IntPtr.Zero) return null;
    try {
      using (var icon = Icon.FromHandle(hIcon))
      using (var big = icon.ToBitmap()) {
        // Un programa sin icono grande sale como uno de 32 o 48 px en la esquina del lienzo de 256.
        int extent = Extent(big);
        if (extent == 0) return null;
        int src = extent <= 32 ? 32 : extent <= 48 ? 48 : big.Width;
        using (var output = new Bitmap(size, size, PixelFormat.Format32bppArgb))
        using (var g = Graphics.FromImage(output))
        using (var ms = new MemoryStream()) {
          g.InterpolationMode = InterpolationMode.HighQualityBicubic;
          g.PixelOffsetMode = PixelOffsetMode.HighQuality;
          g.CompositingQuality = CompositingQuality.HighQuality;
          g.DrawImage(big, new Rectangle(0, 0, size, size), new Rectangle(0, 0, src, src), GraphicsUnit.Pixel);
          output.Save(ms, ImageFormat.Png);
          return Convert.ToBase64String(ms.ToArray());
        }
      }
    } finally { DestroyIcon(hIcon); }
  }
}
'@
$i = 0
while ($null -ne ($line = [Console]::In.ReadLine())) {
  $png = $null
  try { $png = [MascotaIcons]::Png($line, ${SIZE}) } catch { }
  if ($png) { [Console]::Out.WriteLine([string]$i + [char]9 + $png) }
  $i++
}
`

/** Trabajo de fondo: que no le quite CPU a lo que estés haciendo. */
export function lowPriority(pid: number | undefined): void {
  if (!pid) return
  try {
    setPriority(pid, constants.priority.PRIORITY_BELOW_NORMAL)
  } catch {
    /* el proceso ya terminó */
  }
}

/** Interpreta la salida del script: líneas "<índice>\t<png en base64>". */
export function parseIconOutput(stdout: string, targets: readonly string[]): Map<string, string> {
  const icons = new Map<string, string>()
  for (const line of stdout.split(/\r?\n/)) {
    const tab = line.indexOf('\t')
    if (tab < 1) continue
    const index = Number(line.slice(0, tab))
    const b64 = line.slice(tab + 1).trim()
    if (!Number.isInteger(index) || index < 0 || index >= targets.length) continue
    if (!b64 || b64.length > MAX_PNG_BASE64 || !BASE64.test(b64)) continue
    icons.set(targets[index], `data:image/png;base64,${b64}`)
  }
  return icons
}

/**
 * Extrae los iconos de `targets` (rutas o `shell:AppsFolder\<AppID>`).
 * Devuelve solo los que se pudieron sacar; si PowerShell falla, un mapa vacío.
 */
export function extractIcons(targets: readonly string[]): Promise<Map<string, string>> {
  // Una línea por elemento: lo que tenga saltos de línea no es una ruta válida.
  const list = targets.filter((t) => t && !/[\r\n\0]/.test(t))
  if (!list.length) return Promise.resolve(new Map())
  const encoded = Buffer.from(SCRIPT, 'utf16le').toString('base64')
  return new Promise((resolve) => {
    const child = execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      { timeout: 90_000, windowsHide: true, maxBuffer: 32 * 1024 * 1024, encoding: 'utf8' },
      (err, stdout) => {
        if (err) console.warn('[iconos] PowerShell falló:', err.message)
        // Aunque falle a medias (p. ej. tiempo límite), aprovechamos lo que ya escribió.
        resolve(parseIconOutput(stdout ?? '', list))
      }
    )
    lowPriority(child.pid)
    child.stdin?.on('error', () => {})
    child.stdin?.end(list.join('\n') + '\n', 'utf8')
  })
}
