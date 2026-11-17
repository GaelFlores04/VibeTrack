const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
const mongoose = require('mongoose');

function describeMongoError(error) {
  const errors = [];
  const seen = new Set();
  function collect(item) {
    if (!item || typeof item !== 'object' || seen.has(item)) return;
    seen.add(item); errors.push(item);
    collect(item.cause); collect(item.reason); collect(item.error);
    if (item.servers instanceof Map) for (const server of item.servers.values()) collect(server);
  }
  collect(error);
  const codes = errors.map(item => item.code);
  const messages = errors.map(item => String(item.message || '')).join(' ');
  if (codes.includes(18) || codes.includes(8000) && /auth/i.test(messages) || /authentication failed|bad auth/i.test(messages)) return '[AUTH] Autenticación rechazada. Comprueba el usuario de Database Users y su contraseña; codifica los caracteres especiales de la contraseña en la URI.';
  if (codes.some(code => ['ENOTFOUND', 'EAI_AGAIN', 'ENODATA', 'ESERVFAIL', 'EREFUSED'].includes(code)) || /querySrv|queryTxt/i.test(messages)) return '[DNS] No se pudo resolver el servidor Atlas. Comprueba el host copiado de Atlas y la resolución DNS de tu red.';
  if (codes.some(code => ['EACCES', 'EPERM'].includes(code))) return '[PERMISSION] Este proceso no tiene permiso para abrir la conexión. Comprueba las restricciones del entorno o firewall.';
  if (/certificate|TLS|SSL/i.test(messages)) return '[TLS] Falló la conexión segura. Comprueba fecha/hora del equipo, certificados y posibles filtros de red.';
  if (errors.some(item => item.name === 'MongoParseError') || /Invalid scheme|Invalid connection string|URI malformed/i.test(messages)) return '[URI] Formato de conexión inválido. Vuelve a copiar la URI de Atlas y comprueba la codificación de la contraseña.';
  return '[NETWORK] No se pudo alcanzar el clúster. Comprueba que esté activo y autoriza tu IP actual en Network Access. También puede ser un bloqueo de red; este error no permite afirmar cuál.';
}

async function checkMongo() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) { console.log('MongoDB: falta MONGODB_URI en backend/.env.'); return false; }
  if (/<[^>]+>/.test(uri)) {
    console.error('MongoDB: la URI todavía contiene un marcador como <db_password>. Sustitúyelo por la contraseña real del usuario de base de datos, sin los signos < >.');
    return false;
  }
  let connection;
  try {
    connection = mongoose.createConnection(uri, { serverSelectionTimeoutMS: 10000 });
    await connection.asPromise();
    await connection.db.admin().ping();
    console.log('MongoDB: conexión y ping correctos. No se modificaron datos.');
    return true;
  } catch (error) {
    console.error(`MongoDB: ${describeMongoError(error)}`);
    return false;
  } finally { if (connection) await connection.close().catch(() => {}); }
}

async function checkLastfm() {
  const key = process.env.LASTFM_API_KEY?.trim();
  if (!key) { console.log('Last.fm: falta LASTFM_API_KEY en backend/.env.'); return false; }
  const moods = [ ['feliz', 'happy'], ['relajado', 'chillout'], ['motivado', 'workout'], ['triste', 'sad'], ['romántico', 'romantic'], ['cansado', 'ambient'] ];
  try {
    for (const [mood, tag] of moods) {
      const url = new URL('https://ws.audioscrobbler.com/2.0/');
      url.search = new URLSearchParams({ method: 'tag.gettoptracks', tag, api_key: key, format: 'json', limit: '2' }).toString();
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) { console.error(`Last.fm: respuesta HTTP ${response.status}. Reintenta más tarde.`); return false; }
      const body = await response.json();
      if (body.error) { console.error(`Last.fm: error ${Number(body.error)}. Revisa que la API key sea válida y esté activa.`); return false; }
      const tracks = body.tracks?.track;
      if (!Array.isArray(tracks) || tracks.length === 0) { console.error(`Last.fm: no hay resultados válidos para ${mood}.`); return false; }
      console.log(`Last.fm: ${mood}, consulta correcta (${tracks.length} muestras).`);
    }
    return true;
  } catch { console.error('Last.fm: no se pudo consultar el servicio. Comprueba la conexión de red y reintenta.'); return false; }
}

async function checkDeezer() {
  try {
    const response = await fetch('https://api.deezer.com/search?q=coldplay%20fix%20you&limit=1', { signal: AbortSignal.timeout(10000) });
    const body = await response.json();
    const track = body.data?.[0];
    if (!response.ok || body.error || !track) { console.error('Deezer: respuesta no válida. Reintenta más tarde.'); return { ok: false }; }
    console.log(`Deezer: búsqueda correcta${track.preview ? ' con preview' : ''}.`);
    return { ok: true, isrc: track.isrc };
  } catch { console.error('Deezer: no se pudo consultar el servicio. Comprueba la conexión de red.'); return { ok: false }; }
}

async function checkReccobeats(isrc) {
  if (process.env.RECCOBEATS_ENABLED === 'false') { console.log('ReccoBeats: desactivado (RECCOBEATS_ENABLED=false); se usarán sólo etiquetas.'); return true; }
  try {
    const response = await fetch(`https://api.reccobeats.com/v1/audio-features?ids=${encodeURIComponent(isrc || 'GBAYE0500605')}`, { signal: AbortSignal.timeout(10000) });
    const body = await response.json();
    const item = body.content?.[0];
    if (!response.ok || typeof item?.valence !== 'number') { console.error('ReccoBeats: sin rasgos de audio. La clasificación usará etiquetas de Last.fm.'); return false; }
    console.log(`ReccoBeats: rasgos de audio correctos (valence ${item.valence}, energy ${item.energy}).`);
    return true;
  } catch { console.error('ReccoBeats: no se pudo consultar el servicio. La clasificación usará etiquetas de Last.fm.'); return false; }
}

if (require.main === module) (async () => {
  const mongo = await checkMongo();
  if (process.argv.includes('--mongo-only')) { process.exitCode = mongo ? 0 : 1; return; }
  const lastfm = await checkLastfm();
  const deezer = await checkDeezer();
  const reccobeats = await checkReccobeats(deezer.isrc);
  // ReccoBeats es opcional: su caída no impide recomendar.
  process.exitCode = mongo && lastfm && deezer.ok ? 0 : 1;
  if (!reccobeats) console.log('Aviso: ReccoBeats no disponible; el servicio sigue funcionando con etiquetas.');
})().catch(() => { console.error('No se pudo completar la comprobación de servicios.'); process.exitCode = 1; });

module.exports = { describeMongoError };
