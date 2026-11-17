// Proveedores simulados y deterministas. No abre conexiones ni lee credenciales.
function createMusicFixture(options = {}) {
  const artists = options.artists || ['Artist A', 'Artist B', 'Pop Artist'];
  const count = options.count ?? 60;
  const calls = [];
  let failApple = false;
  const records = artists.flatMap((artist, a) => Array.from({ length: count }, (_, i) => ({ artist, title: `Song ${i + 1}`, id: a * 1000 + i + 1, index: i + 1 })));
  const lastfm = item => ({ name: item.title, artist: { name: item.artist }, url: `https://www.last.fm/music/${encodeURIComponent(item.artist)}/_/${encodeURIComponent(item.title)}`, listeners: '100000' });
  const itunes = item => ({ kind: 'song', trackId: item.id, artistName: item.artist, trackName: item.title, trackViewUrl: `https://music.apple.com/track/${item.id}`, collectionName: 'Fixture album', primaryGenreName: 'Rock', artworkUrl100: 'https://example.test/cover.jpg', ...(options.missing?.includes(item.index) ? {} : { previewUrl: `https://example.test/${item.id}.m4a` }) });
  const json = value => new Response(JSON.stringify(value));
  const isrc = item => `QZFIX${String(item.id).padStart(7, '0')}`;
  const deezer = item => ({ id: item.id, type: 'track', readable: true, title: item.title, link: `https://www.deezer.com/track/${item.id}`, duration: 200, isrc: isrc(item), artist: { name: item.artist }, album: { title: 'Fixture album', cover_medium: 'https://example.test/cover.jpg' }, ...(options.missing?.includes(item.index) ? {} : { preview: `https://cdnt-preview.dzcdn.net/${item.id}.mp3` }) });
  async function fetcher(input) {
    const url = new URL(String(input));
    calls.push({ host: url.hostname, method: url.searchParams.get('method'), term: url.searchParams.get('term'), tag: url.searchParams.get('tag'), attribute: url.searchParams.get('attribute') });
    // Ausencia confirmada, distinta de una caída temporal del proveedor.
    if (url.hostname === 'lrclib.net') return url.pathname.endsWith('/get') ? new Response('', { status: 404 }) : json([]);
    if (url.hostname === 'api.deezer.com') {
      if (failApple || options.deezerDown) return new Response('', { status: 503 });
      const track = url.pathname.match(/^\/track\/(\d+)$/);
      if (track) { const item = records.find(record => record.id === Number(track[1])); return json(item ? deezer(item) : { error: { code: 800 } }); }
      const q = (url.searchParams.get('q') || '').toLowerCase();
      return json({ data: records.filter(item => `${item.artist} ${item.title}`.toLowerCase().includes(q)).slice(0, Number(url.searchParams.get('limit') || 25)).map(deezer) });
    }
    if (url.hostname === 'api.reccobeats.com') {
      const ids = (url.searchParams.get('ids') || '').split(',');
      // Por defecto sin rasgos de audio: las pruebas de etiquetas siguen aisladas.
      return json({ content: records.filter(item => ids.includes(isrc(item))).flatMap(item => { const features = options.audio?.(item); return features ? [{ isrc: isrc(item), acousticness: .2, danceability: .6, ...features }] : []; }) });
    }
    if (url.hostname === 'itunes.apple.com') {
      if (failApple) return new Response('', { status: 503 });
      const term = url.searchParams.get('term').toLowerCase();
      const items = url.searchParams.get('attribute') === 'artistTerm' ? records.filter(item => item.artist.toLowerCase() === term) : records.filter(item => `${item.artist} ${item.title}`.toLowerCase().includes(term));
      return json({ results: items.map(itunes) });
    }
    if (url.hostname !== 'ws.audioscrobbler.com') throw new Error('El fixture no permite red externa.');
    const method = url.searchParams.get('method');
    const page = Number(url.searchParams.get('page') || 1);
    if (method === 'artist.search') {
      const term = url.searchParams.get('artist').toLowerCase();
      return json({ results: { artistmatches: { artist: artists.filter(name => name.toLowerCase().includes(term)).map(name => ({ name, mbid: '', url: `https://www.last.fm/music/${encodeURIComponent(name)}` })) } } });
    }
    if (method === 'track.search') return json({ results: { trackmatches: { track: records.slice(0, 4).map(item => ({ name: item.title, artist: item.artist })) } } });
    if (method === 'artist.getSimilar') return json({ similarartists: { artist: (options.similar || []).map(name => ({ name, match: '0.9' })) } });
    if (method === 'track.getInfo' || method === 'track.getTopTags') {
      const index = Number((url.searchParams.get('track') || '').split(' ').at(-1));
      const tags = options.wrongMood?.includes(index) ? ['sad', 'rock'] : ['happy', 'rock'];
      // Como en Last.fm: getTopTags trae las mismas etiquetas que getInfo, con su recuento.
      if (method === 'track.getTopTags') return json({ toptags: { tag: tags.map(name => ({ name, count: 100 })) } });
      return json({ track: { listeners: '100000', toptags: { tag: tags.map(name => ({ name })) } } });
    }
    const source = method === 'artist.getTopTracks' ? url.searchParams.get('artist') : url.searchParams.get('tag') === 'rock' ? artists[0] : artists[2];
    const items = options.emptyMood && method === 'tag.getTopTracks' ? [] : records.filter(item => item.artist === source).slice((page - 1) * 50, page * 50).map(lastfm);
    return json(method === 'artist.getTopTracks' ? { toptracks: { track: items } } : { tracks: { track: items } });
  }
  return { fetcher, calls, artists, records, setFailApple: value => { failApple = value; } };
}
module.exports = { createMusicFixture };
