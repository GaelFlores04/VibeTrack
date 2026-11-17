import type { SpotifyTasteTrack } from '../spotify/spotify-taste';
import { TasteRulesStore, TasteRuleInput } from './taste-rules';
import { canonicalArtistName } from './artist-names';
import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { artistGenres, Bucket, bucketOf, Candidate, curatedCandidates, directlyPreferred, hasPreferences, preferenceLevel, moodAffinity, normalize, personalAffinity, Preferences, PROFILES, quotaGap, quotas, quotaShortfall, rankRecommendations } from './recommendation-engine';
import { MusicCache } from './music-cache';
import { MusicProviders } from './music.providers';
import { RecommendationHistory } from './recommendation-history';
import { SpotifyArtistsStore, TasteSource } from './spotify-artists';
import { audioCentroid, mergeTaste, StoredTaste, TasteStore } from './taste-profile';
import { DatabaseService } from '../database/database.module';
import { RecommendationBatch, Track } from './music.types';
import { matchingTitle, recordingKeys } from './track-matching';
import { assessMood, MOOD_MIN, MOOD_POLICY_VERSION } from './mood-classifier';
import { genreSources, GENRE_KEYS } from './genres';
import { FeedbackStore, feedbackKey, feedbackProfile, Rating, FeedbackProfile } from './feedback';
export { normalizeTrack, Track } from './music.types';

const RELAXED_NOTICE = 'Con «Sólo mis gustos» casi no hay canciones de tus artistas y géneros para este mood: añadimos artistas parecidos y descubrimientos que sí encajan.';
const retrievalMood = (track: Candidate, slug: string) => moodAffinity(track, slug) || (track.moodEvidence?.length ? .5 : 0);
const identity = (track: Track) => `${normalize(track.artist)}|${matchingTitle(track.title)}`;
interface Source { kind: 'tag' | 'artist'; name: string; mood?: boolean; genre?: boolean; relatedTo?: string; via?: string; discovery?: boolean; feedback?: boolean; page: number; exhausted: boolean; last: number; signatures?: Set<string>; retryAt?: number }
interface Session {
  owner?: string; mood?: string; feedbackTracks: Map<string, Candidate>;
  // Fuente "Sólo Spotify": las reglas de gusto de VibeTrack que suman afinidad no participan.
  spotifyOnly?: boolean;
  // "Sólo mis gustos" sin canciones para este mood: la sesión se comporta como el nivel 4 y avisa.
  relaxed?: boolean;
  pool: Map<string, Candidate>; seen: Set<string>; sources: Source[]; pages: Map<number, RecommendationBatch>;
  historyKey?: string; expires: number; relatedLoaded: Set<string>; audioRetryAt: Map<number, number>; request?: Promise<RecommendationBatch>;
  // Canciones mostradas en visitas anteriores: se evitan mientras haya alternativas.
  history: Set<string>; historyReady: Promise<void>;
  // Variación estable dentro de la sesión y distinta entre sesiones.
  noise: Map<string, number>;
  // Género de cada artista elegido, usado como respaldo cuando sus canciones no encajan con el mood.
  styleOf: Record<string, string>; styleLoaded: Set<string>;
  // ReccoBeats respondió con rasgos en esta sesión: clasificar por audio es barato.
  audioWorks?: boolean;
  // Perfil de gusto: guardado por cuenta + etiquetas de tus artistas en esta sesión.
  tasteKey?: string; stored: StoredTaste; tasteReady: Promise<void>; artistTags: Record<string, number>;
  // Favoritos cuyos "similares de similares" ya se añadieron como fuentes de descubrimiento.
  secondLoaded: Set<string>;
}
@Injectable()
export class MusicService {
  private readonly providers: MusicProviders;
  // Historial por cuenta y mood, independiente del UUID de la página y de las preferencias:
  // cambiar de gustos o volver otro día no debe repetir la misma primera tanda.
  private readonly history: RecommendationHistory;
  private readonly taste: TasteStore;
  private readonly spotify: SpotifyArtistsStore;
  private readonly feedback: FeedbackStore;
  private readonly rules: TasteRulesStore;
  private sessions = new Map<string, Session>();
  // Inyectable en pruebas para obtener un orden determinista.
  random: () => number = Math.random;
  constructor(@Optional() @Inject(MusicCache) cache?: MusicCache, @Optional() @Inject(DatabaseService) database?: DatabaseService) {
    this.providers = new MusicProviders(cache || new MusicCache(database));
    this.history = new RecommendationHistory(database);
    this.taste = new TasteStore(database);
    this.spotify = new SpotifyArtistsStore(database);
    this.feedback = new FeedbackStore(database);
    this.rules = new TasteRulesStore(database);
  }
  tasteRules(userId: string) { return this.rules.load(userId); }
  saveTasteRule(userId: string, input: TasteRuleInput) { return this.rules.save(userId, input); }
  removeTasteRule(userId: string, key: string) { return this.rules.remove(userId, key); }
  search(term: string) { return this.providers.search(term); }
  artists(term: string) { return this.providers.artists(term); }
  suggestions(term: string) { return this.providers.suggestions(term); }
  previewUrl(id: string) { return this.providers.previewUrl(id); }

  async recommendations(slug: string, page: number, preferences?: Preferences | null, sessionId = 'default', userId = 'guest'): Promise<RecommendationBatch> {
    const originalPreferences = preferences;
    if (!Object.hasOwn(PROFILES, slug)) throw new NotFoundException('Mood no encontrado.');
    if (preferences) preferences = {
      ...(preferences.preferenceLevel !== undefined ? { preferenceLevel: preferences.preferenceLevel } : {}),
      genres: [...new Set(preferences.genres)].sort(),
      artists: [...new Set(preferences.artists.map(canonicalArtistName).filter(Boolean))].sort(),
    };
    // Fuente de gustos elegida en la cuenta: lo configurado en la app, lo que escuchas en Spotify o ambos.
    const { names: spotifyNames, source: tasteSource, tracks: spotifyTracks, genres: spotifyGenres } = userId !== 'guest' ? await this.spotify.load(userId) : { names: [], source: 'app' as TasteSource, tracks: [], genres: [] };
    // Sólo Spotify: se ignora por completo el cuestionario de VibeTrack (géneros y artistas), también
    // si la importación aún no trajo datos; sólo se conserva el nivel de preferencia elegido.
    const spotifyOnly = userId !== 'guest' && tasteSource === 'spotify';
    const useSpotify = spotifyNames.length > 0 && tasteSource !== 'app';
    if (spotifyOnly) {
      const level = preferences?.preferenceLevel !== undefined ? { preferenceLevel: preferences.preferenceLevel } : {};
      preferences = { ...level, genres: useSpotify ? spotifyGenres || [] : [], artists: useSpotify ? [...spotifyNames].sort() : [], spotifyArtists: useSpotify ? [...spotifyNames].sort() : [] };
    } else if (useSpotify) {
      const explicit = preferences?.artists || [];
      const extra = spotifyNames.filter(name => !explicit.some(artist => normalize(artist) === normalize(name)));
      preferences = { ...preferences, genres: preferences?.genres || [], artists: [...new Set([...explicit, ...extra])].sort(), spotifyArtists: extra.sort() };
    }
    if (useSpotify || (spotifyOnly && spotifyTracks?.length)) preferences = { ...preferences!, spotifyTracks: spotifyTracks || [], genres: [...new Set([...(preferences?.genres || []), ...(spotifyGenres || [])])] };
    const historyKey = userId !== 'guest' ? createHash('sha256').update(JSON.stringify(['history', userId, slug])).digest('hex') : undefined;
    const fingerprint = createHash('sha256').update(JSON.stringify([MOOD_POLICY_VERSION, slug, userId, preferences || null, sessionId, spotifyOnly ? 'spotify' : useSpotify ? tasteSource : 'app'])).digest('hex');
    let session = this.sessions.get(fingerprint);
    if (!session || session.expires < Date.now()) {
      if (page !== 1) throw new BadRequestException('La tanda caducó. Vuelve a comenzar desde la primera.');
      for (const [key, value] of this.sessions) if (value.expires < Date.now()) this.sessions.delete(key);
      if (this.sessions.size >= 100) {
        const oldestIdle = [...this.sessions].find(([, value]) => !value.request);
        if (oldestIdle) this.sessions.delete(oldestIdle[0]);
      }
      const created = this.newSession(slug, preferences);
      created.owner = userId; created.mood = slug; created.spotifyOnly = spotifyOnly;
      created.historyKey = historyKey;
      // Se registra antes de esperar el historial para que peticiones simultáneas compartan sesión.
      if (historyKey) created.historyReady = this.history.load(historyKey).then(ids => { for (const id of ids) created.history.add(id); });
      if (userId !== 'guest') {
        // Lo que escuchas en la app se sigue aprendiendo siempre; para recomendar se usa la fuente elegida.
        created.tasteKey = this.tasteKey(userId);
        const appTaste = spotifyOnly ? Promise.resolve({ artists: {}, tags: {} }) : this.taste.load(created.tasteKey);
        const spotifyTaste = useSpotify ? this.taste.load(this.spotifyTasteKey(userId)) : Promise.resolve(null);
        created.tasteReady = Promise.all([appTaste, spotifyTaste]).then(([app, fromSpotify]) => { created.stored = fromSpotify ? mergeTaste(app, fromSpotify) : app; });
      }
      this.sessions.set(fingerprint, session = created);
    }
    const cached = session.pages.get(page);
    if (cached) {
      session.expires = Date.now() + 30 * 60000;
      if (!cached.previewsPending && cached.tracks.some(track => track.previewStatus === 'temporary_error') && (session.audioRetryAt.get(page) || 0) <= Date.now()) {
        session.audioRetryAt.set(page, Date.now() + 60000);
        this.enrichBatch(cached);
      }
      return cached;
    }
    if (session.request) { await session.request; return this.recommendations(slug, page, originalPreferences, sessionId, userId); }
    if (page !== session.pages.size + 1) throw new BadRequestException('Pide las tandas en orden.');
    session.expires = Date.now() + 30 * 60000;
    const request = this.buildBatch(session, slug, page, preferences);
    session.request = request;
    try { return await request; } finally { session.request = undefined; }
  }
  private newSession(slug: string, preferences?: Preferences | null): Session {
    const source = (kind: 'tag' | 'artist', name: string, extras = {}): Source => ({ kind, name, page: 1, exhausted: false, last: 0, ...extras });
    const personal = [
      ...(preferences?.artists || []).map(name => source('artist', name)),
      // Cada género busca también en sus etiquetas reales de Last.fm (latin → reggaeton, latin pop…).
      ...(preferences?.genres || []).flatMap(name => genreSources(name).map(tag => source('tag', tag, { genre: true }))),
    ];
    const imported = (preferences?.spotifyTracks || []).map(track => {
      const url = `https://www.last.fm/music/${encodeURIComponent(track.artist)}/_/${encodeURIComponent(track.title)}`;
      return { ...track, id: `lastfm:${url}`, externalUrl: url, provider: 'lastfm' as const };
    });
    const mood = PROFILES[slug].tags.map(name => source('tag', name, { mood: true }));
    return {
      pool: new Map([...imported, ...(hasPreferences(preferences) ? [] : curatedCandidates(slug))].map(track => [identity(track), track])), feedbackTracks: new Map(),
      seen: new Set(), sources: [...personal.slice(0, 2), ...mood, ...personal.slice(2)], pages: new Map(),
      expires: Date.now() + 30 * 60000, relatedLoaded: new Set(), audioRetryAt: new Map(),
      history: new Set(), historyReady: Promise.resolve(), noise: new Map(), styleOf: {}, styleLoaded: new Set(),
      stored: { artists: {}, tags: {} }, tasteReady: Promise.resolve(), artistTags: {}, secondLoaded: new Set(),
    };
  }
  private merge(session: Session, track: Candidate) {
    const related = session.sources.find(source => source.kind === 'artist' && source.relatedTo && normalize(source.name) === normalize(track.artist));
    if (related) track.relatedTo ||= related.relatedTo;
    const key = identity(track);
    if (session.seen.has(key)) return;
    const old = session.pool.get(key);
    if (!old) { session.pool.set(key, track); return; }
    // Se actualiza el mismo objeto: los catálogos pueden llegar mientras esa canción se clasifica
    // y reemplazarlo haría que la clasificación en curso escribiera sobre una copia perdida.
    const target = old as unknown as Record<string, unknown>;
    for (const [field, value] of Object.entries(track)) if (target[field] === undefined) target[field] = value;
    old.moodEvidence = [...new Set([...(old.moodEvidence || []), ...(track.moodEvidence || [])])];
    old.sourceGenres = [...new Set([...(old.sourceGenres || []), ...(track.sourceGenres || [])])];
    old.tags = [...new Set([...(old.tags || []), ...(track.tags || [])])];
    old.relatedTo ||= track.relatedTo; old.via ||= track.via;
  }
  private async refill(session: Session, only?: (source: Source) => boolean): Promise<boolean> {
    const sources = session.sources.filter(source => (!only || only(source)) && !source.exhausted && (!source.retryAt || source.retryAt <= Date.now())).sort((a, b) => a.last - b.last).slice(0, 4);
    if (!sources.length) return true;
    let success = false;
    await Promise.all(sources.map(async source => {
      source.last = Date.now();
      try {
        const result = await this.providers.candidates(source.kind, source.name, source.page);
        success = true;
        source.signatures ||= new Set();
        const repeated = source.signatures.has(result.signature);
        source.signatures.add(result.signature);
        // Un artista de descubrimiento aporta sólo su página principal: sus temas más representativos.
        source.exhausted = result.nextPage === null || repeated || !!source.discovery;
        if (result.nextPage) source.page = result.nextPage;
        source.retryAt = undefined;
        for (const track of result.tracks) this.merge(session, { ...track, moodEvidence: source.mood ? [source.name] : [], sourceGenres: source.genre ? [source.name] : [], relatedTo: source.relatedTo, via: source.via });
      } catch { source.retryAt = Date.now() + 15000; }

    }));
    return success;
  }
  private async addRelated(session: Session, preferences?: Preferences | null) {
    if (!preferences?.artists.length || preferences.preferenceLevel === 5) return;
    preferences = { ...preferences, artists: preferences.artists.slice(0, 5) };
    const similarRequest = Promise.allSettled(preferences.artists.filter(artist => !session.relatedLoaded.has(artist)).map(async artist => ({ artist, similar: await this.providers.similar(artist) })));
    const styles = await Promise.allSettled(preferences.artists.filter(artist => !session.styleLoaded.has(artist)).map(async artist => ({ artist, tags: await this.providers.artistTags(artist) })));
    for (const result of styles) if (result.status === 'fulfilled') {
      session.styleLoaded.add(result.value.artist);
      for (const genre of artistGenres(result.value.tags)) if (!preferences.genres.includes(genre)) session.styleOf[genre] ||= result.value.artist;
      // Las etiquetas de tus artistas describen tu gusto (p. ej. "garage rock", "post-punk").
      for (const tag of result.value.tags) {
        const name = normalize(tag.name);
        if (name && name !== normalize(result.value.artist) && tag.count >= 10) session.artistTags[name] = Math.max(session.artistTags[name] || 0, tag.count / 100);
      }
    }
    const results = await similarRequest;
    for (const result of results) if (result.status === 'fulfilled') {
      session.relatedLoaded.add(result.value.artist);
      // La afinidad pertenece al artista, no a la fuente por la que llegó la canción.
      for (const track of session.pool.values()) if (result.value.similar.some(name => normalize(name) === normalize(track.artist))) track.relatedTo ||= result.value.artist;
      for (const name of result.value.similar) if (!session.sources.some(source => source.kind === 'artist' && normalize(source.name) === normalize(name))) {
        session.sources.push({ kind: 'artist', name, relatedTo: result.value.artist, page: 1, exhausted: false, last: 0 });
      }
    }
    // Similares de tus similares: artistas a dos pasos, menos obvios pero conectados con lo que escuchas.
    const known = (name: string) => preferences.artists.some(artist => normalize(artist) === normalize(name)) || session.sources.some(source => source.kind === 'artist' && normalize(source.name) === normalize(name));
    const pending = preferences.artists.filter(artist => session.relatedLoaded.has(artist) && !session.secondLoaded.has(artist));
    const second = await Promise.allSettled(pending.map(async artist => {
      const first = session.sources.filter(source => source.relatedTo === artist).slice(0, 2).map(source => source.name);
      return { artist, names: (await Promise.allSettled(first.map(name => this.providers.similar(name)))).flatMap(item => item.status === 'fulfilled' ? item.value.slice(2) : []) };
    }));
    for (const result of second) if (result.status === 'fulfilled') {
      session.secondLoaded.add(result.value.artist);
      let added = 0;
      for (const name of result.value.names) {
        if (added === 3 || known(name)) continue;
        session.sources.push({ kind: 'artist', name, via: result.value.artist, discovery: true, page: 1, exhausted: false, last: 0 });
        added++;
      }
    }
  }
  // Importación desde Spotify: los artistas más escuchados alimentan el perfil de gusto y los 5
  // primeros pasan a contar como favoritos. Sólo se guardan nombres y pesos agregados.
  async importSpotifyTaste(userId: string, artists: Array<{ name: string; weight: number; genres?: string[] }>, tracks: SpotifyTasteTrack[] = [], genres: string[] = []) {
    const top = artists.filter(item => item.name && item.weight > 0).slice(0, 50);
    const signals = await Promise.all(top.map(async (item, index) => ({
      artist: item.name, tags: item.genres?.length ? item.genres.map(name => ({ name, count: 100 }))
        : index < 5 ? await this.providers.artistTags(item.name).catch(() => []) : [], weight: Math.min(1, item.weight),
    })));
    await this.taste.replace(this.spotifyTasteKey(userId), signals);
    const knownGenres = GENRE_KEYS.filter(genre => genres.some(tag => normalize(tag) === normalize(genre)));
    await this.spotify.save(userId, top.map(item => item.name), tracks, knownGenres);
  }
  async forgetSpotify(userId: string) { this.spotify.forget(userId); await this.taste.remove(this.spotifyTasteKey(userId)); }
  tasteSource(userId: string) { return this.spotify.load(userId).then(value => value.source); }
  setTasteSource(userId: string, source: TasteSource) { return this.spotify.setSource(userId, source); }
  private spotifyTasteKey(userId: string) { return createHash('sha256').update(JSON.stringify(['taste-spotify', userId])).digest('hex'); }
  // ISRC de una pista de Deezer: identifica la misma grabación en Spotify.
  async isrcFor(id: string): Promise<string | undefined> {
    const match = /^deezer:(\d{1,20})$/.exec(id);
    return match ? (await this.providers.trackById(match[1]).catch(() => null))?.isrc : undefined;
  }
  private tasteKey(userId: string) { return createHash('sha256').update(JSON.stringify(['taste', userId])).digest('hex'); }
  async ratings(userId: string, mood: string) {
    if (!Object.hasOwn(PROFILES, mood)) throw new NotFoundException('Mood no encontrado.');
    return Object.fromEntries(Object.entries(await this.feedback.load(userId, mood)).map(([key, entry]) => [key, entry.rating]));
  }
  async ratingHistory(userId: string, mood: string) {
    if (!Object.hasOwn(PROFILES, mood)) throw new NotFoundException('Mood no encontrado.');
    return Object.entries(await this.feedback.load(userId, mood)).map(([key, entry]) => ({ key, title: entry.title, artist: entry.artist, rating: entry.rating, updatedAt: entry.updatedAt })).sort((a, b) => b.updatedAt - a.updatedAt);
  }
  async removeRating(userId: string, mood: string, key: string) {
    if (!Object.hasOwn(PROFILES, mood) || !/^[a-f0-9]{64}$/.test(key)) throw new BadRequestException('Valoración no válida.');
    await this.feedback.remove(userId, mood, key);
  }
  async rate(userId: string, mood: string, trackId: string, rating: Rating | null) {
    if (!Object.hasOwn(PROFILES, mood)) throw new NotFoundException('Mood no encontrado.');
    // El cliente sólo envía el ID; artista, etiquetas y audio proceden de su tanda en el servidor.
    for (const session of this.sessions.values()) {
      if (session.owner !== userId || session.mood !== mood) continue;
      for (const batch of session.pages.values()) {
        const shown = batch.tracks.find(track => track.id === trackId);
        if (shown) {
          const classified = session.feedbackTracks.get(feedbackKey(shown));
          return this.feedback.set(userId, mood, { ...classified, ...shown }, rating, 'mood');
        }
      }
      // Las selecciones parciales también se han mostrado y pertenecen a esta cuenta y mood.
      const partial = [...session.feedbackTracks.values()].find(track => track.id === trackId);
      if (partial) return this.feedback.set(userId, mood, partial, rating, 'mood');
    }
    throw new BadRequestException('Esta tanda ya caducó. Abre una nueva para valorar sus canciones.');
  }
  private async addFeedbackSources(session: Session, profile: FeedbackProfile, page: number) {
    const artists = [...new Set(profile.liked.map(entry => entry.artist))]
      .filter(name => (profile.artists.get(normalize(name)) || 0) > 0)
      .sort((a, b) => (profile.artists.get(normalize(b)) || 0) - (profile.artists.get(normalize(a)) || 0) || a.localeCompare(b));
    const tags = [...profile.tags].filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]).map(([name]) => name);
    // Rotar las fuentes deja participar a los demás likes y mantiene las fuentes del mood.
    const rotate = (items: string[], count: number) => items.length ? Array.from({ length: Math.min(count, items.length) }, (_, index) => items[((page - 1) * count + index) % items.length]) : [];
    const desired: Source[] = [
      ...rotate(artists, 2).map(name => ({ kind: 'artist' as const, name, feedback: true, page: 1, exhausted: false, last: 0 })),
      ...rotate(tags, 1).map(name => ({ kind: 'tag' as const, name, genre: true, feedback: true, page: 1, exhausted: false, last: 0 })),
    ];
    const anchor = rotate(artists, 1)[0];
    if (anchor) {
      const similar = await this.providers.similar(anchor).catch(() => []);
      for (const name of similar.slice(0, 2)) desired.push({ kind: 'artist', name, relatedTo: anchor, feedback: true, page: 1, exhausted: false, last: 0 });
    }
    session.sources = session.sources.filter(source => !source.feedback || desired.some(item => item.kind === source.kind && normalize(item.name) === normalize(source.name)));
    const added = desired.filter(item => !session.sources.some(source => source.kind === item.kind && normalize(source.name) === normalize(item.name)));
    // Se intercalan tras las dos primeras fuentes; se conservan moods y preferencias explícitas.
    session.sources.splice(2, 0, ...added);
  }
  // Aprende de una preview escuchada: artista, etiquetas y sonido. Sólo agregados.
  async recordPlay(userId: string, id: string) {
    const track = await this.providers.trackById(id);
    if (!track) return;
    const [tags, audio] = await Promise.all([
      this.providers.artistTags(track.artist).catch(() => []),
      track.isrc ? this.providers.features(track.isrc).catch(() => null) : null,
    ]);
    await this.taste.record(this.tasteKey(userId), [{ artist: track.artist, tags, audio, weight: 1 }]);
  }
  private async buildBatch(session: Session, slug: string, page: number, preferences?: Preferences | null): Promise<RecommendationBatch> {
    await Promise.all([session.historyReady, session.tasteReady]);
    const feedback = feedbackProfile(session.owner && session.owner !== 'guest' ? await this.feedback.load(session.owner, slug) : {});
    const savedRules = session.owner && session.owner !== 'guest' ? await this.rules.load(session.owner) : [];
    // Con "Sólo Spotify" se ignoran las reglas de VibeTrack que orientan el gusto (más/menos de algo y
    // cualquier regla de género); sólo se respetan las exclusiones explícitas de canciones y artistas.
    const rules = session.spotifyOnly ? savedRules.filter(rule => rule.action === 'exclude' && rule.target !== 'genre') : savedRules;
    preferences = { genres: [], artists: [], ...preferences, rules };
    if (session.relaxed) preferences = { ...preferences, preferenceLevel: 4 };
    for (const rule of rules.filter(rule => rule.action === 'more')) {
      if (rule.target === 'song') {
        const url = `https://www.last.fm/music/${encodeURIComponent(rule.artist!)}/_/${encodeURIComponent(rule.name)}`;
        this.merge(session, { id: `lastfm:${url}`, title: rule.name, artist: rule.artist!, externalUrl: url, provider: 'lastfm' });
      } else {
        const kind = rule.target === 'artist' ? 'artist' : 'tag';
        if (!session.sources.some(source => source.kind === kind && source.name === rule.name)) session.sources.unshift({ kind, name: rule.name, genre: kind === 'tag', page: 1, last: 0, exhausted: false });
      }
    }
    await this.addFeedbackSources(session, feedback, page);
    const mode = hasPreferences(preferences) ? 'personalized' : 'discovery';
    const deadline = Date.now() + 9000; // Por intento; el cliente hace como mucho 4 (< 1 min en total).
    const attempted = new Set<string>();
    let failures = false;
    let refills = 0;
    const noise = (track: Candidate) => {
      const id = identity(track);
      let value = session.noise.get(id);
      if (value === undefined) { value = this.random(); session.noise.set(id, value); }
      return value;
    };
    const start = Date.now();
    const personalized = hasPreferences(preferences);
    // Una de cada ~3 tandas incluye una sorpresa (decidido al preparar la tanda; estable en reintentos).
    const surprise = personalized && (preferences?.preferenceLevel ?? 3) < 4 && this.random() < .35;
    // Gusto = etiquetas de tus artistas y géneros + perfil aprendido de escuchas.
    // Mostrar o clasificar una recomendación no se interpreta como aceptación.
    const tasteOf = () => {
      const tags: Record<string, number> = { ...session.stored.tags };
      for (const [name, value] of Object.entries(session.artistTags)) tags[name] = Math.max(tags[name] || 0, value);
      for (const genre of preferences?.genres || []) tags[normalize(genre)] = Math.max(tags[normalize(genre)] || 0, .8);
      const audio = session.stored.audio;
      return { tags, artists: session.stored.artists, audio: audioCentroid(audio) };
    };
    // Se recalcula una vez por ronda (no por candidata): recorrer el pool en cada consulta es cuadrático.
    let currentTaste = tasteOf();
    // El estilo (género) de tus artistas cuenta como cercano en cuanto se conoce.
    const effective = (): Preferences => ({ ...preferences!, ...(Object.keys(session.styleOf).length ? { styleOf: session.styleOf } : {}), taste: currentTaste, surprise, feedback, rules });
    const fresh = (track: Candidate) => !recordingKeys(track).some(key => session.seen.has(key) || session.history.has(key));
    const selected = () => rankRecommendations([...session.pool.values()].filter(track => track.metadataChecked && fresh(track)), slug, effective(), 7, noise);
    const available = (track: Candidate) => fresh(track) && !attempted.has(identity(track)) && !track.metadataChecked && (!track.retryAt || track.retryAt <= Date.now());
    const discoveryCandidate = (track: Candidate) => (retrievalMood(track, slug) > 0 || !!track.via) && !personalAffinity(track, preferences) && !track.relatedTo;
    // ¿Quedan candidatas sin revisar que podrían cubrir ese grupo?
    const favoriteSource = (source: Source) => source.kind === 'artist' && (preferences?.artists || []).some(artist => normalize(artist) === normalize(source.name));
    const pending = (bucket: Bucket) => { const current = effective(); return (bucket === 'favorite' && session.sources.some(source => favoriteSource(source) && !source.exhausted && (!source.retryAt || source.retryAt <= Date.now()))) || [...session.pool.values()].some(track => available(track)
      && (bucket === 'discovery' ? discoveryCandidate(track) : bucketOf(track, current) === bucket)); };
    const checkedPool = () => [...session.pool.values()].filter(track => track.metadataChecked && fresh(track));
    let target = quotas(effective());
    // Lista cuando hay 7 y cada cupo (favoritos, cercanos, descubrimientos) está cubierto o ya no
    // tiene candidatas; pasados 6 s se acepta la mejor mezcla disponible. Excepción: si la tanda
    // apenas trae favoritos y aún quedan por revisar, se sigue buscando hasta los 8 s.
    const ready = () => {
      const chosen = selected();
      if (chosen.length < 7) return false;
      const shortfall = quotaShortfall(checkedPool(), slug, effective());
      if (shortfall.every(bucket => !pending(bucket))) return true;
      const elapsed = Date.now() - start;
      if (elapsed <= 6000) return false;
      const current = effective();
      const starved = target.favorite > 0 && elapsed <= 8000
        && chosen.filter(track => bucketOf(track, current) === 'favorite').length < Math.ceil(target.favorite / 2) && pending('favorite');
      return !starved;
    };
    // La expansión de similares (y similares de similares) corre en segundo plano: la primera ronda
    // de clasificación empieza en cuanto llegan los catálogos de tus artistas y del mood.
    let related: Promise<void> | undefined;
    const expand = () => {
      if (!related) related = this.addRelated(session, preferences).catch(() => {}).finally(() => { related = undefined; });
      return related;
    };
    {
      const catalogs = Promise.all([this.refill(session, favoriteSource), this.refill(session, source => !favoriteSource(source) && !source.discovery)]);
      const background = expand();
      const [main] = await catalogs;
      failures = !main; refills++;
      // Sin favoritos que revisar, los cercanos dependen de la expansión: se espera.
      if (!preferences?.artists.length) await background;
      currentTaste = tasteOf();
    }
    // La disponibilidad de audio nunca determina si se puede mostrar una recomendación.
    // El plazo gobierna; las verificaciones ya cacheadas son instantáneas y no deben agotar el presupuesto.
    for (let round = 0; round < 40 && Date.now() < deadline && !ready(); round++) {
      // Nivel 5 ("Sólo mis gustos"): si tras revisar una muestra suficiente casi nada de tus artistas y
      // géneros encaja con el mood, esperar al límite no lo cambiaría. Se pasa al nivel 4 (similares y
      // descubrimientos) en esta sesión, con aviso, en lugar de tardar ~40 s y entregar 0 canciones.
      if (personalized && !session.relaxed && preferenceLevel(preferences) === 5 && selected().length < 7) {
        let tried = 0, passed = 0;
        for (const track of session.pool.values()) if (track.metadataChecked && directlyPreferred(track, preferences)) {
          tried++; if (moodAffinity(track, slug) >= MOOD_MIN) passed++;
        }
        if (tried >= 25 && passed / tried < .1) {
          session.relaxed = true;
          preferences = { ...preferences!, preferenceLevel: 4 };
          target = quotas(effective());
          void expand();
        }
      }
      let candidates = [...session.pool.values()].filter(available);
      // Los descubrimientos y los géneros dependen de los tags del mood: si no quedan temas con esa
      // evidencia se pide la siguiente página antes que recorrer catálogos completos.
      const needsMood = personalized && !candidates.some(track => retrievalMood(track, slug) > 0)
        && session.sources.some(source => source.mood && !source.exhausted && (!source.retryAt || source.retryAt <= Date.now()));
      const gap = quotaGap(checkedPool(), slug, effective());
      const needsPersonal = personalized && gap.favorite > 0
        && session.sources.some(source => favoriteSource(source) && !source.exhausted && (!source.retryAt || source.retryAt <= Date.now()))
        && !candidates.some(track => personalAffinity(track, preferences) >= 1);
      // Sin temas de artistas a dos pasos por revisar, se trae el siguiente de esos artistas.
      const needsDiscovery = personalized && !candidates.some(track => discoveryCandidate(track))
        && session.sources.some(source => source.discovery && !source.exhausted && (!source.retryAt || source.retryAt <= Date.now()));
      if (!candidates.length || needsMood || needsPersonal || needsDiscovery) {
        if (refills < 6) {
          if (!needsPersonal && !needsMood) await expand();
          const only = needsPersonal ? favoriteSource : needsMood ? (source: Source) => !!source.mood : needsDiscovery ? (source: Source) => !!source.discovery : undefined;
          const ok = await this.refill(session, only); failures ||= !ok; refills++;
          candidates = [...session.pool.values()].filter(available);
        } else if (!candidates.length) break;
      }
      if (ready()) break;
      // Con géneros elegidos es más directo verificar el género de temas del mood que
      // examinar un catálogo entero de rock/pop buscando etiquetas de ánimo escasas.
      const level = (track: Candidate) => preferences?.genres.length
        ? 2 * retrievalMood(track, slug) + personalAffinity(track, preferences)
        : 3 * personalAffinity(track, preferences) + retrievalMood(track, slug);
      // Dentro de un nivel se prefieren temas conocidos; el ruido mantiene la variedad entre visitas.
      const maxListeners = Math.max(1, ...candidates.map(track => track.listeners || 0));
      const popularity = (track: Candidate) => track.listeners ? Math.log1p(track.listeners) / Math.log1p(maxListeners) : 0;
      // Prioridad y nivel se calculan una vez por candidata, no en cada comparación del ordenamiento.
      const levels = new Map(candidates.map(track => [track, level(track)]));
      const priorities = new Map(candidates.map(track => [track, levels.get(track)! + .25 * noise(track) + .35 * popularity(track)]));
      candidates.sort((a, b) => priorities.get(b)! - priorities.get(a)!);
      const top = Math.max(...levels.values());
      const wave: Candidate[] = [];
      const add = (track: Candidate, limit: number) => { if (wave.length < limit && !wave.includes(track)) wave.push(track); };
      const personalLevel = (track: Candidate) => personalAffinity(track, effective());
      const near = (track: Candidate) => { const p = personalLevel(track); return p > 0 && p < 1; };
      // Turnos de la ola según lo que falta en cada cupo y lo que rinde cada grupo para este mood:
      // si tus artistas casi no encajan (p. ej. 1 de cada 8), se revisan más de sus temas, no menos.
      // Un grupo con su cupo cubierto no gasta consultas.
      const yieldOf = (bucket: Bucket) => {
        const current = effective();
        let checked = 0, passed = 0;
        for (const track of session.pool.values()) if (track.metadataChecked && bucketOf(track, current) === bucket) {
          checked++; if (moodAffinity(track, slug) >= MOOD_MIN) passed++;
        }
        return (passed + 1) / (checked + 3);
      };
      const slots = (bucket: Bucket, min: number, max: number) => gap[bucket] > 0 ? Math.min(max, Math.max(min, Math.ceil(gap[bucket] / yieldOf(bucket)))) : 0;
      const favoriteSlots = !personalized ? 12 : preferences?.artists.length ? slots('favorite', 4, 10) : 0;
      if (!personalized) {
        for (const track of candidates) if (level(track) >= top) add(track, favoriteSlots);
      } else if (favoriteSlots) {
        // Turnos rotativos entre tus artistas (en orden de prioridad) para no agotar uno solo.
        const byArtist = new Map<string, Candidate[]>();
        for (const track of candidates) if (personalLevel(track) >= 1) {
          const artist = normalize(track.artist);
          byArtist.set(artist, [...(byArtist.get(artist) || []), track]);
        }
        const queues = [...byArtist.values()];
        while (wave.length < favoriteSlots && queues.some(queue => queue.length)) {
          for (const queue of queues) if (queue.length) add(queue.shift()!, favoriteSlots);
        }
      }
      if (personalized) {
        // Cercanos: primero los artistas similares y a dos pasos (basta Deezer para clasificarlos);
        // los temas sólo de género, cuando el audio funciona.
        const nearOrder = (track: Candidate) => (track.relatedTo ? .5 : track.via ? .45 : 0) + .4 * retrievalMood(track, slug) + .3 * noise(track);
        const nearLimit = wave.length + slots('near', 2, 5);
        candidates.filter(track => near(track) && (track.relatedTo || track.via || retrievalMood(track, slug) > 0 || session.audioWorks))
          .sort((x, y) => nearOrder(y) - nearOrder(x)).forEach(track => add(track, nearLimit));
        // Descubrimientos: los menos trillados; la popularidad no ordena aquí para no revisar siempre los mismos éxitos.
        const discoveryLimit = wave.length + slots('discovery', 1, 3);
        candidates.filter(discoveryCandidate).sort((x, y) => (.4 * retrievalMood(y, slug) + .3 * noise(y)) - (.4 * retrievalMood(x, slug) + .3 * noise(x)))
          .forEach(track => add(track, discoveryLimit));
      }
      // Si tus artistas y cercanos casi no encajan con este mood (≥ 25 revisadas, < 10 %), los temas con
      // evidencia del mood (sus etiquetas: "sad", "happy"…) son los que de verdad llenan la tanda: se
      // revisan como relleno aunque su cupo sea 0. No aplica al nivel 5 estricto, que no los admite.
      if (personalized && preferenceLevel(preferences) < 5) {
        const current = effective();
        let tried = 0, passed = 0;
        for (const track of session.pool.values()) if (track.metadataChecked && bucketOf(track, current) !== 'discovery') {
          tried++; if (moodAffinity(track, slug) >= MOOD_MIN) passed++;
        }
        const missing = 7 - selected().length;
        if (missing > 0 && tried >= 25 && passed / tried < .1) {
          const limit = wave.length + Math.min(6, missing + 2);
          candidates.filter(track => retrievalMood(track, slug) > 0).sort((x, y) => noise(y) - noise(x)).forEach(track => add(track, limit));
        }
      }
      // Temas sólo del género (sin evidencia de mood) cuestan dos consultas a Last.fm si no hay audio:
      // se revisan únicamente cuando no queda nada mejor. Relleno modesto: los cupos ya guiaron la ola.
      const costly = (track: Candidate) => !session.audioWorks && !retrievalMood(track, slug) && personalAffinity(track, preferences) < .8;
      if (wave.length < 8) for (const track of candidates) if (!personalized || !costly(track)) add(track, 8);
      if (!wave.length) for (const track of candidates) add(track, 12);
      // Si quedan pocos temas de tus artistas por revisar, la siguiente página de su catálogo se pide
      // ya, en paralelo a esta ola, en lugar de esperar a quedarse sin ninguno.
      const favoritesLeft = candidates.filter(track => personalAffinity(track, preferences) >= 1 && !wave.includes(track)).length;
      const prefetch = personalized && gap.favorite > 0 && favoritesLeft < favoriteSlots
        && session.sources.some(source => favoriteSource(source) && !source.exhausted && (!source.retryAt || source.retryAt <= Date.now()))
        ? this.refill(session, favoriteSource) : undefined;
      const classify = async (track: Candidate) => {
        attempted.add(identity(track));
        // Last.fm sólo se consulta cuando falta saber el género (gustos/estilo) o no hay rasgos de audio.
        const needsGenre = personalized && !personalAffinity(track, effective());
        try {
          // Las etiquetas de Last.fm se piden siempre que no haya evidencia de mood: llevan señales
          // contrarias ("sad", "sadcore") que el audio no ve, también para tus artistas favoritos.
          const wantInfo = needsGenre || !track.tags?.length || !!track.curated;
          // De tus artistas ya se conoce el género y los oyentes: basta track.getTopTags, que trae
          // además las etiquetas de ánimo (una consulta en vez de dos, sin esperar a la letra).
          const tagsOnly = wantInfo && !needsGenre && !track.curated && !!track.listeners && personalAffinity(track, preferences) >= 1;
          const infoRequest = !wantInfo ? undefined
            : tagsOnly ? this.providers.moodTags(track).then(tags => { track.moodTagsChecked = true; return { tags, listeners: track.listeners || 0 }; })
            : this.providers.info(track);
          const [info] = await Promise.all([infoRequest, this.loadAudio(track)]);
          if (track.audio) session.audioWorks = true;
          if (info) { track.tags = [...new Set([...(track.tags || []), ...info.tags])]; track.listeners = info.listeners || track.listeners; }
          // La clasificación usa audio y etiquetas; la letra ya no se consulta (lenta, con límite de
          // uso en LRCLIB y ausente en muchas canciones). Si falta evidencia emocional, se piden las
          // etiquetas detalladas, que pueden aportarla o revelar una contradicción.
          if (assessMood(track, slug).reason === 'insufficient-evidence' && !track.moodTagsChecked) {
            track.tags = [...new Set([...(track.tags || []), ...await this.providers.moodTags(track)])];
            track.moodTagsChecked = true;
          }
          // Letra sólo si está disponible al momento: puede aportar evidencia (afecto, tristeza) o
          // vetar una contradicción en canciones admitidas sólo por audio. Nunca deja la canción
          // pendiente: si LRCLIB tarda más de 1,5 s, falla o no la tiene, se decide sin ella.
          const current = assessMood(track, slug);
          // En triste, los temas de tus artistas con sonido animado pero no eufórico pueden ser
          // tristes por la letra: se consulta sólo para ellos (pocos y con el mismo tope de 1,5 s).
          const sadLyricsCandidate = slug === 'triste' && current.reason === 'incompatible-audio' && track.audio && track.audio.valence <= .65
            && personalAffinity(track, preferences) >= 1;
          if (track.audio && !track.lyricsChecked && ['feliz', 'triste', 'romantico'].includes(slug)
            && (sadLyricsCandidate || current.reason === 'insufficient-evidence' || (current.reason === 'compatible' && !current.evidence.includes('track-tags')))) {
            let timer: NodeJS.Timeout | undefined;
            const lyrics = this.providers.lyrics(track, true).catch(() => null);
            track.lyrics = await Promise.race([lyrics, new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 1500); })]);
            clearTimeout(timer);
            track.lyricsChecked = true;
          }
          track.metadataChecked = true;
          track.retryAt = undefined;
        } catch { failures = true; track.retryAt = Date.now() + 15000; }
      };
      // Una canción lenta (letra o catálogo que tardan) no bloquea la ola: pasado el límite se
      // evalúa lo ya clasificado y la rezagada termina en segundo plano para la siguiente ronda.
      let timer: NodeJS.Timeout | undefined;
      const limit = new Promise<void>(resolve => { timer = setTimeout(resolve, Math.max(800, Math.min(3000, deadline - Date.now()))); });
      await Promise.race([Promise.all([Promise.all(wave.map(classify)), prefetch]), limit]);
      clearTimeout(timer);
      currentTaste = tasteOf();
    }
    const tracks = selected();
    for (const track of tracks) {
      session.feedbackTracks.set(feedbackKey(track), track);
      if (track.match) session.feedbackTracks.set(feedbackKey(track.match), track);
    }
    const sourcesLeft = session.sources.some(source => !source.exhausted);
    if (tracks.length < 7 && session.history.size && !sourcesLeft && ![...session.pool.values()].some(track => available(track) || !!track.retryAt)) {
      // Ya se mostró todo lo compatible con estos gustos: se reinicia el ciclo antes que dejar al usuario sin tanda.
      session.history.clear();
      if (session.historyKey) await this.history.clear(session.historyKey);
      return this.buildBatch(session, slug, page, preferences);
    }
    if (tracks.length === 7) {
      tracks.forEach(track => { recordingKeys(track).forEach(key => session.seen.add(key)); session.pool.delete(identity(track)); });
      const batch: RecommendationBatch = { tracks, size: 7, page, status: 'ready', mode, nextPage: page < 100 ? page + 1 : null, ...(session.relaxed ? { notice: RELAXED_NOTICE } : {}) };
      if (session.historyKey) void this.history.add(session.historyKey, tracks.flatMap(recordingKeys));
      session.pages.set(page, batch);
      session.audioRetryAt.set(page, Date.now() + 60000);
      // Se devuelve la selección enseguida. El frontend consulta el progreso del audio por separado.
      this.enrichBatch(batch);
      return batch;
    }
    const retry = failures || [...session.pool.values()].some(track => available(track) || !!track.retryAt) || (preferences?.artists || []).some(artist => !session.relatedLoaded.has(artist)) || sourcesLeft;
    const previous = session.pages.size > 0;
    // La primera tanda puede mostrar avances; las siguientes nunca reemplazan siete por una lista menor.
    // Los avances también deben poder escucharse: antes llegaban sin preview ni portada.
    const initial = previous ? [] : await this.playable(tracks);
    return {
      ...(session.relaxed ? { notice: RELAXED_NOTICE } : {}),
      tracks: initial, size: 7, page, status: retry ? 'retry' : 'exhausted', retryAfterMs: failures ? 3000 : 1000, mode, nextPage: null, previewsPending: false,
      message: previous
        ? (retry ? 'Seguimos buscando otras 7 recomendaciones. Puedes continuar con la tanda actual.' : 'No encontramos otras 7 coincidencias para este mood y tus gustos. La tanda actual sigue disponible.')
        : (retry ? initial.length ? `Encontramos ${initial.length} de 7 recomendaciones. Puedes reintentar para completar la selección.` : failures ? 'No pudimos completar la consulta al catálogo musical. Reintenta en unos segundos.' : 'Todavía no encontramos coincidencias suficientes para este mood y tus gustos. Puedes reintentar o cambiar de mood.' : 'No hay suficientes coincidencias para completar 7 con este mood y tus gustos. Puedes ajustar tus preferencias o cambiar de mood.'),
    };
  }
  // Coincidencia en Deezer + rasgos de audio por ISRC. Nunca lanza: sin datos se usan las etiquetas.
  private async loadAudio(track: Candidate) {
    if (track.audioChecked) return;
    try {
      const match = await this.providers.match(track);
      if (!match) { track.audioChecked = true; return; }
      track.match = match;
      const features = match.isrc ? await this.providers.features(match.isrc) : null;
      track.audioChecked = true;
      if (features) { track.audio = features; track.energy = features.energy; }
    } catch { /* Deezer no disponible: se reintenta en otra tanda. */ }
  }
  // La coincidencia de Deezer obtenida al clasificar ya trae el preview: no se vuelve a buscar.
  private withMatch(track: Track): Track {
    const match = (track as Candidate).match;
    return match?.previewUrl
      ? { ...track, ...match, lastfmUrl: track.externalUrl, recommendationReason: track.recommendationReason, previewStatus: 'available' as const }
      : { ...track, previewStatus: track.previewUrl ? 'available' as const : 'loading' as const };
  }
  // Tanda parcial: no se guarda en la sesión ni se sondea, así que el preview se resuelve aquí
  // (con un tope de espera; lo que no llegue a tiempo queda como no disponible).
  private async playable(tracks: Track[]): Promise<Track[]> {
    const ready = tracks.map(track => this.withMatch(track));
    let timer: NodeJS.Timeout | undefined;
    const limit = new Promise<void>(resolve => { timer = setTimeout(resolve, 2500); });
    await Promise.race([Promise.all(ready.map(async (track, index) => {
      if (track.previewUrl) return;
      try { ready[index] = { ...track, ...await this.providers.preview(track) }; } catch { /* queda sin preview */ }
    })), limit]);
    clearTimeout(timer);
    return ready.map(track => track.previewStatus === 'loading' && !track.previewUrl ? { ...track, previewStatus: 'unavailable' as const } : track);
  }
  private enrichBatch(batch: RecommendationBatch) {
    batch.previewsPending = true;
    batch.tracks = batch.tracks.map(track => this.withMatch(track));
    let fallbackBudget = 2;
    void Promise.all(batch.tracks.map(async (track, index) => {
      if (track.previewUrl) return;
      try {
        let result = await this.providers.preview(track);
        if (!result.previewUrl && result.previewStatus !== 'temporary_error' && fallbackBudget > 0) {
          fallbackBudget--; result = await this.providers.preview(track, true);
        }
        const aliases = recordingKeys(result);
        const duplicate = batch.tracks.some((other, position) => position !== index && recordingKeys(other).some(key => aliases.includes(key)));
        batch.tracks[index] = duplicate ? { ...track, previewStatus: 'unavailable' } : { ...track, ...result };
      } catch { batch.tracks[index] = { ...track, previewStatus: 'temporary_error' }; }
    })).finally(() => { batch.previewsPending = false; });
  }
}
