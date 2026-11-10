/**
 * Marcas que se suelen suplantar en el phishing (especialmente en España) y sus
 * dominios oficiales. Si un enlace imita una de estas marcas sin ser uno de sus
 * dominios, es sospechoso.
 *
 * `label` es el nombre que se compara con el dominio (sin TLD).
 */
export interface Brand {
  name: string
  label: string
  domains: readonly string[]
}

export const BRANDS: readonly Brand[] = [
  // Tecnología y servicios
  { name: 'Google', label: 'google', domains: ['google.com', 'google.es', 'goo.gl', 'g.co', 'gmail.com', 'youtube.com', 'youtu.be', 'google-analytics.com', 'googleapis.com', 'googleusercontent.com', 'gstatic.com', 'googletagmanager.com', 'googlevideo.com', 'withgoogle.com', 'google.dev'] },
  { name: 'YouTube', label: 'youtube', domains: ['youtube.com', 'youtu.be'] },
  { name: 'Microsoft', label: 'microsoft', domains: ['microsoft.com', 'live.com', 'office.com', 'outlook.com', 'microsoftonline.com', 'bing.com', 'xbox.com'] },
  { name: 'Outlook', label: 'outlook', domains: ['outlook.com', 'live.com', 'office.com', 'microsoft.com'] },
  { name: 'Office', label: 'office', domains: ['office.com', 'microsoft.com', 'office365.com'] },
  { name: 'Apple', label: 'apple', domains: ['apple.com', 'icloud.com', 'apple.co'] },
  { name: 'iCloud', label: 'icloud', domains: ['icloud.com', 'apple.com'] },
  { name: 'Amazon', label: 'amazon', domains: ['amazon.es', 'amazon.com', 'amazon.co.uk', 'amazon.de', 'amazon.fr', 'amazon.it', 'amzn.to', 'amzn.eu', 'aws.amazon.com', 'amazon-adsystem.com'] },
  { name: 'Netflix', label: 'netflix', domains: ['netflix.com'] },
  { name: 'Spotify', label: 'spotify', domains: ['spotify.com', 'spoti.fi'] },
  { name: 'Facebook', label: 'facebook', domains: ['facebook.com', 'fb.com', 'fb.me', 'meta.com'] },
  { name: 'Instagram', label: 'instagram', domains: ['instagram.com'] },
  { name: 'WhatsApp', label: 'whatsapp', domains: ['whatsapp.com', 'whatsapp.net', 'wa.me'] },
  { name: 'Telegram', label: 'telegram', domains: ['telegram.org', 't.me'] },
  { name: 'LinkedIn', label: 'linkedin', domains: ['linkedin.com', 'lnkd.in'] },
  { name: 'Twitter / X', label: 'twitter', domains: ['twitter.com', 'x.com', 't.co'] },
  { name: 'GitHub', label: 'github', domains: ['github.com', 'github.io', 'githubusercontent.com'] },
  { name: 'Dropbox', label: 'dropbox', domains: ['dropbox.com'] },
  { name: 'Discord', label: 'discord', domains: ['discord.com', 'discord.gg', 'discordapp.com'] },
  { name: 'Steam', label: 'steampowered', domains: ['steampowered.com', 'steamcommunity.com'] },
  { name: 'Steam', label: 'steamcommunity', domains: ['steamcommunity.com', 'steampowered.com'] },
  { name: 'Epic Games', label: 'epicgames', domains: ['epicgames.com'] },
  // Pagos y criptomonedas
  { name: 'PayPal', label: 'paypal', domains: ['paypal.com', 'paypal.me', 'paypal-community.com', 'paypalobjects.com'] },
  { name: 'Bizum', label: 'bizum', domains: ['bizum.es'] },
  { name: 'Binance', label: 'binance', domains: ['binance.com'] },
  { name: 'Coinbase', label: 'coinbase', domains: ['coinbase.com'] },
  // Bancos españoles
  { name: 'Santander', label: 'santander', domains: ['santander.com', 'bancosantander.es', 'santander.es'] },
  { name: 'BBVA', label: 'bbva', domains: ['bbva.es', 'bbva.com'] },
  { name: 'CaixaBank', label: 'caixabank', domains: ['caixabank.es', 'caixabank.com'] },
  { name: 'Bankinter', label: 'bankinter', domains: ['bankinter.com'] },
  { name: 'Sabadell', label: 'bancsabadell', domains: ['bancsabadell.com'] },
  { name: 'ING', label: 'ingdirect', domains: ['ing.es'] },
  { name: 'Openbank', label: 'openbank', domains: ['openbank.es'] },
  { name: 'Unicaja', label: 'unicaja', domains: ['unicajabanco.es', 'unicaja.es'] },
  { name: 'Kutxabank', label: 'kutxabank', domains: ['kutxabank.es'] },
  { name: 'Abanca', label: 'abanca', domains: ['abanca.com'] },
  // Compras y envíos
  { name: 'Correos', label: 'correos', domains: ['correos.es', 'correos.com'] },
  { name: 'SEUR', label: 'seur', domains: ['seur.com'] },
  { name: 'DHL', label: 'dhl', domains: ['dhl.com', 'dhl.es'] },
  { name: 'eBay', label: 'ebay', domains: ['ebay.es', 'ebay.com'] },
  { name: 'AliExpress', label: 'aliexpress', domains: ['aliexpress.com', 'aliexpress.us'] },
  { name: 'Wallapop', label: 'wallapop', domains: ['wallapop.com'] },
  { name: 'Vinted', label: 'vinted', domains: ['vinted.es', 'vinted.com'] },
  // Administración
  { name: 'Agencia Tributaria', label: 'agenciatributaria', domains: ['agenciatributaria.gob.es', 'agenciatributaria.es'] },
  { name: 'Seguridad Social', label: 'seg-social', domains: ['seg-social.es', 'seg-social.gob.es'] },
  { name: 'DGT', label: 'dgt', domains: ['dgt.es', 'dgt.gob.es'] }
]

/** Servicios que acortan enlaces (ocultan el destino real). */
export const SHORTENERS: ReadonlySet<string> = new Set([
  'bit.ly', 'bitly.com', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly', 'rebrand.ly', 'cutt.ly',
  'shorturl.at', 'tiny.cc', 'rb.gy', 'bl.ink', 't.ly', 'v.gd', 's.id', 'lnkd.in', 'amzn.to', 'amzn.eu', 'youtu.be',
  'shorturl.com', 'short.io', 'tr.im', 'clck.ru', 'qrco.de', 'linktr.ee', 'spoti.fi', 'fb.me', 'wa.me', 'shrtco.de'
])

/** TLD muy usados en campañas de abuso (no son malos por sí mismos, pero suman). */
export const RISKY_TLDS: ReadonlySet<string> = new Set([
  'zip', 'mov', 'top', 'xyz', 'click', 'country', 'gq', 'tk', 'ml', 'cf', 'ga', 'work', 'support', 'rest', 'quest',
  'cam', 'icu', 'buzz', 'monster', 'lol', 'cyou', 'sbs', 'cfd', 'bond', 'beauty', 'hair', 'skin', 'makeup', 'boats',
  'autos', 'mom', 'loan', 'win', 'bid', 'review', 'party', 'trade', 'date', 'racing', 'stream', 'download', 'link'
])

/** Sufijos de dos niveles más habituales (para saber cuál es el dominio "real"). */
export const MULTI_PART_SUFFIXES: ReadonlySet<string> = new Set([
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'com.es', 'org.es', 'nom.es', 'gob.es', 'edu.es', 'com.mx', 'gob.mx',
  'com.ar', 'com.br', 'com.co', 'com.pe', 'com.ve', 'com.uy', 'com.ec', 'cl.cl', 'co.jp', 'com.au', 'co.nz', 'co.in',
  'com.tr', 'co.za', 'com.cn', 'com.hk', 'com.sg', 'co.kr', 'com.pl', 'com.pt', 'github.io', 'web.app', 'pages.dev',
  'netlify.app', 'vercel.app', 'herokuapp.com', 'blogspot.com', 'azurewebsites.net', 'firebaseapp.com'
])

/** Palabras típicas de las páginas de phishing. */
export const PHISHING_WORDS = [
  'login', 'log-in', 'signin', 'sign-in', 'verify', 'verificar', 'verificacion', 'secure', 'seguro', 'segura',
  'account', 'cuenta', 'update', 'actualizar', 'actualizacion', 'wallet', 'password', 'contrasena', 'banking',
  'confirm', 'confirmar', 'unlock', 'desbloquear', 'suspend', 'suspendida', 'bloqueada', 'reembolso', 'refund',
  'premio', 'regalo', 'gratis', 'factura', 'invoice', 'paquete', 'entrega', 'aduana', 'pago', 'payment', 'acceso',
  'clientes', 'support', 'soporte', 'recovery', 'recuperar'
]

/** Extensiones de archivos que ejecutan código al abrirlos. */
export const EXECUTABLE_EXT = /\.(exe|scr|msi|bat|cmd|pif|vbs|vbe|jse|wsf|hta|ps1|jar|apk|lnk|iso|img)$/i
