// Una sola taxonomía para el formulario, su validación y las fuentes del recomendador.
export const GENRE_GROUPS = [
  { id: 'pop', label: 'Pop', children: [['dance pop', 'Dance pop'], ['synthpop', 'Synthpop'], ['dream pop', 'Dream pop'], ['electropop', 'Electropop'], ['k-pop', 'K-pop']] },
  { id: 'rock', label: 'Rock', children: [['alternative rock', 'Rock alternativo'], ['classic rock', 'Rock clásico'], ['progressive rock', 'Rock progresivo'], ['punk rock', 'Punk rock'], ['post-rock', 'Post-rock']] },
  { id: 'indie', label: 'Indie', children: [['indie pop', 'Indie pop'], ['indie rock', 'Indie rock'], ['shoegaze', 'Shoegaze'], ['bedroom pop', 'Bedroom pop']] },
  { id: 'electronic', label: 'Electrónica', children: [['house', 'House'], ['techno', 'Techno'], ['trance', 'Trance'], ['drum and bass', 'Drum and bass'], ['dubstep', 'Dubstep'], ['downtempo', 'Downtempo']] },
  { id: 'hip-hop', label: 'Hip-hop', children: [['rap', 'Rap'], ['trap', 'Trap'], ['boom bap', 'Boom bap'], ['lo-fi hip hop', 'Lo-fi hip-hop']] },
  { id: 'r&b', label: 'R&B y soul', children: [['contemporary r&b', 'R&B contemporáneo'], ['neo-soul', 'Neo-soul'], ['soul', 'Soul'], ['funk', 'Funk']] },
  { id: 'latin', label: 'Latina', children: [['latin pop', 'Pop latino'], ['reggaeton', 'Reguetón'], ['latin trap', 'Trap latino'], ['salsa', 'Salsa'], ['bachata', 'Bachata'], ['cumbia', 'Cumbia'], ['regional mexicano', 'Regional mexicano'], ['bossa nova', 'Bossa nova']] },
  { id: 'jazz', label: 'Jazz', children: [['smooth jazz', 'Smooth jazz'], ['bebop', 'Bebop'], ['jazz fusion', 'Jazz fusión'], ['vocal jazz', 'Jazz vocal']] },
  { id: 'classical', label: 'Clásica y piano', children: [['piano', 'Piano'], ['orchestral', 'Orquestal'], ['baroque', 'Barroco'], ['neoclassical', 'Neoclásica']] },
  { id: 'folk', label: 'Folk', children: [['indie folk', 'Indie folk'], ['acoustic', 'Acústica'], ['singer-songwriter', 'Cantautor']] },
  { id: 'metal', label: 'Metal', children: [['heavy metal', 'Heavy metal'], ['metalcore', 'Metalcore'], ['symphonic metal', 'Metal sinfónico'], ['death metal', 'Death metal']] },
  { id: 'ambient', label: 'Ambient', children: [['dark ambient', 'Dark ambient'], ['chillout', 'Chillout'], ['drone', 'Drone']] },
  { id: 'reggae', label: 'Reggae', children: [['dub', 'Dub'], ['ska', 'Ska'], ['dancehall', 'Dancehall']] },
  { id: 'blues', label: 'Blues', children: [['blues rock', 'Blues rock'], ['delta blues', 'Delta blues']] },
  { id: 'country', label: 'Country', children: [['country pop', 'Country pop'], ['americana', 'Americana'], ['bluegrass', 'Bluegrass']] },
  { id: 'soundtrack', label: 'Bandas sonoras', children: [['film score', 'Cine'], ['video game music', 'Videojuegos']] },
];
export const GENRE_KEYS = GENRE_GROUPS.flatMap(group => [group.id, ...group.children.map(([id]) => id)]);
export const genreSources = (id: string) => {
  const aliases: Record<string, string[]> = { 'r&b': ['rnb', 'soul'], latin: ['latin', 'reggaeton', 'latin pop'], electronic: ['electronic', 'house', 'dance'], 'hip-hop': ['hip-hop', 'rap'], classical: ['classical', 'piano'], rock: ['rock', 'alternative rock'], indie: ['indie', 'indie pop'], pop: ['pop', 'dance pop'], folk: ['folk', 'acoustic'] };
  return aliases[id] || [id];
};
