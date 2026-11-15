import { canonicalArtistName } from './artist-names';
import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { artistGenres, Bucket, bucketOf, Candidate, curatedCandidates, hasPreferences, moodAffinity, normalize, personalAffinity, Preferences, PROFILES, quotaShortfall, rankRecommendations } from './recommendation-engine';
import { MusicCache } from './music-cache';
import { MusicProviders } from './music.providers';
import { RecommendationHistory } from './recommendation-history';
import { addAudio, audioCentroid, StoredTaste, TasteSignal, TasteStore } from './taste-profile';
import { DatabaseService } from '../database/database.module';
import { RecommendationBatch, Track } from './music.types';
import { matchingTitle } from './track-matching';
export { normalizeTrack, Track } from './music.types';

const identity = (track: Track) => `${normalize(track.artist)}|${matchingTitle(track.title)}`;
interface Source { kind: 'tag' | 'artist'; name: string; mood?: boolean; genre?: boolean; relatedTo?: string; via?: string; discovery?: boolean; page: number; exhausted: boolean; last: number; signatures?: Set<string>; retryAt?: number }
interface Session {
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
  private sessions = new Map<string, Session>();
  // Inyectable en pruebas para obtener un orden determinista.
  random: () => number = Math.random;
  constructor(@Optional() @Inject(MusicCache) cache?: MusicCache, @Optional() @Inject(DatabaseService) database?: DatabaseService) {
    this.providers = new MusicProviders(cache || new MusicCache(database));
    this.history = new RecommendationHistory(database);
    this.taste = new TasteStore(database);
  }
  search(term: string) { return this.providers.search(term); }
  artists(term: string) { return this.providers.artists(term); }
  suggestions(term: string) { return this.providers.suggestions(term); }
  previewUrl(id: string) { return this.providers.previewUrl(id); }

  async recommendations(slug: string, page: number, preferences?: Preferences | null, sessionId = 'default', userId = 'guest'): Promise<RecommendationBatch> {
    if (!Object.hasOwn(PROFILES, slug)) throw new NotFoundException('Mood no encontrado.');
    if (preferences) preferences = {
      genres: [...new Set(preferences.genres)].sort(),
      artists: [...new Set(preferences.artists.map(canonicalArtistName).filter(Boolean))].sort(),
    };
    const historyKey = userId !== 'guest' ? createHash('sha256').update(JSON.stringify(['history', userId, slug])).digest('hex') : undefined;
    const fingerprint = createHash('sha256').update(JSON.stringify([slug, userId, preferences || null, sessionId])).digest('hex');
    let session = this.sessions.get(fingerprint);
    if (!session || session.expires < Date.now()) {
      if (page !== 1) throw new BadRequestException('La tanda caducó. Vuelve a comenzar desde la primera.');
      for (const [key, value] of this.sessions) if (value.expires < Date.now()) this.sessions.delete(key);
      if (this.sessions.size >= 100) {
        const oldestIdle = [...this.sessions].find(([, value]) => !value.request);
        if (oldestIdle) this.sessions.delete(oldestIdle[0]);
      }
      const created = this.newSession(slug, preferences);
      created.historyKey = historyKey;
      // Se registra antes de esperar el historial para que peticiones simultáneas compartan sesión.
      if (historyKey) created.historyReady = this.history.load(historyKey).then(ids => { for (const id of ids) created.history.add(id); });
      if (userId !== 'guest') {
        created.tasteKey = this.tasteKey(userId);
        created.tasteReady = this.taste.load(created.tasteKey).then(value => { created.stored = value; });
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
    if (session.request) { await session.request; return this.recommendations(slug, page, preferences, sessionId, userId); }
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
      ...(preferences?.genres || []).map(name => source('tag', name, { genre: true })),
    ];
    const mood = PROFILES[slug].tags.map(name => source('tag', name, { mood: true }));
    return {
      pool: new Map((hasPreferences(preferences) ? [] : curatedCandidates(slug)).map(track => [identity(track), track])),
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
    session.pool.set(key, old ? {
      ...track, ...old,
      moodEvidence: [...new Set([...(old.moodEvidence || []), ...(track.moodEvidence || [])])],
      sourceGenres: [...new Set([...(old.sourceGenres || []), ...(track.sourceGenres || [])])],
      tags: [...new Set([...(old.tags || []), ...(track.tags || [])])],
      relatedTo: old.relatedTo || track.relatedTo, via: old.via || track.via,
    } : track);
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
    if (!preferences?.artists.length) return;
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
    const results = await Promise.allSettled(preferences.artists.filter(artist => !session.relatedLoaded.has(artist)).map(async artist => ({ artist, similar: await this.providers.similar(artist) })));
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
  private tasteKey(userId: string) { return createHash('sha256').update(JSON.stringify(['taste', userId])).digest('hex'); }
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
    const mode = hasPreferences(preferences) ? 'personalized' : 'discovery';
    const deadline = Date.now() + 12000;
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
    const surprise = personalized && this.random() < .35;
    // Gusto = etiquetas de tus artistas y géneros + perfil aprendido; sonido = promedio de lo que
    // escuchas y de los temas de tus artistas que ya se clasificaron en esta sesión.
    const tasteOf = () => {
      const tags: Record<string, number> = { ...session.stored.tags };
      for (const [name, value] of Object.entries(session.artistTags)) tags[name] = Math.max(tags[name] || 0, value);
      for (const genre of preferences?.genres || []) tags[normalize(genre)] = Math.max(tags[normalize(genre)] || 0, .8);
      let audio = session.stored.audio;
      for (const track of session.pool.values()) if (track.audio && personalAffinity(track, preferences) >= 1) audio = addAudio(audio, track.audio, .5);
      return { tags, artists: session.stored.artists, audio: audioCentroid(audio) };
    };
    // Se recalcula una vez por ronda (no por candidata): recorrer el pool en cada consulta es cuadrático.
    let currentTaste = tasteOf();
    // El estilo (género) de tus artistas cuenta como cercano en cuanto se conoce.
    const effective = (): Preferences | null | undefined => preferences ? { ...preferences, ...(Object.keys(session.styleOf).length ? { styleOf: session.styleOf } : {}), taste: currentTaste, surprise } : preferences;
    const fresh = (track: Candidate) => !session.seen.has(identity(track)) && !session.history.has(identity(track));
    const selected = () => rankRecommendations([...session.pool.values()].filter(fresh), slug, effective(), 7, noise);
    const available = (track: Candidate) => fresh(track) && !attempted.has(identity(track)) && !track.metadataChecked && (!track.retryAt || track.retryAt <= Date.now());
    const discoveryCandidate = (track: Candidate) => (moodAffinity(track, slug) > 0 || !!track.via) && !personalAffinity(track, preferences) && !track.relatedTo;
    // ¿Quedan candidatas sin revisar que podrían cubrir ese grupo?
    const pending = (bucket: Bucket) => { const current = effective(); return [...session.pool.values()].some(track => available(track)
      && (bucket === 'discovery' ? discoveryCandidate(track) : bucketOf(track, current) === bucket)); };
    // Lista cuando hay 7 y cada cupo (favoritos, cercanos, descubrimientos) está cubierto o ya no
    // tiene candidatas; pasados 7 s se acepta la mejor mezcla disponible.
    const ready = () => selected().length >= 7 && (Date.now() - start > 7000
      || quotaShortfall([...session.pool.values()].filter(fresh), slug, effective()).every(bucket => !pending(bucket)));
    {
      await this.addRelated(session, preferences);
      // Los artistas a dos pasos van en su propio turno: en la cola común quedaban siempre al final.
      const [main] = await Promise.all([this.refill(session, source => !source.discovery), this.refill(session, source => !!source.discovery)]);
      failures = !main; refills++;
      currentTaste = tasteOf();
    }
    // La disponibilidad de audio nunca determina si se puede mostrar una recomendación.
    // El plazo gobierna; las verificaciones ya cacheadas son instantáneas y no deben agotar el presupuesto.
    for (let round = 0; round < 40 && Date.now() < deadline && !ready(); round++) {
      let candidates = [...session.pool.values()].filter(available);
      // Los descubrimientos y los géneros dependen de los tags del mood: si no quedan temas con esa
      // evidencia se pide la siguiente página antes que recorrer catálogos completos.
      const needsMood = personalized && !candidates.some(track => moodAffinity(track, slug) > 0)
        && session.sources.some(source => source.mood && !source.exhausted && (!source.retryAt || source.retryAt <= Date.now()));
      const needsPersonal = personalized && !candidates.some(track => personalAffinity(track, preferences) > 0) && refills < 2;
      // Sin temas de artistas a dos pasos por revisar, se trae el siguiente de esos artistas.
      const needsDiscovery = personalized && !candidates.some(track => track.via)
        && session.sources.some(source => source.discovery && !source.exhausted && (!source.retryAt || source.retryAt <= Date.now()));
      if (!candidates.length || needsMood || needsPersonal || needsDiscovery) {
        if (refills < 6) {
          await this.addRelated(session, preferences);
          const only = needsMood ? (source: Source) => !!source.mood : needsDiscovery && !needsPersonal ? (source: Source) => !!source.discovery : undefined;
          const ok = await this.refill(session, only); failures ||= !ok; refills++;
          candidates = [...session.pool.values()].filter(available);
        } else if (!candidates.length) break;
      }
      if (ready()) break;
      // Con géneros elegidos es más directo verificar el género de temas del mood que
      // examinar un catálogo entero de rock/pop buscando etiquetas de ánimo escasas.
      const level = (track: Candidate) => preferences?.genres.length
        ? 2 * moodAffinity(track, slug) + personalAffinity(track, preferences)
        : 3 * personalAffinity(track, preferences) + moodAffinity(track, slug);
      // Dentro de un nivel se prefieren temas conocidos; el ruido mantiene la variedad entre visitas.
      const maxListeners = Math.max(1, ...candidates.map(track => track.listeners || 0));
      const popularity = (track: Candidate) => track.listeners ? Math.log1p(track.listeners) / Math.log1p(maxListeners) : 0;
      const priority = (track: Candidate) => level(track) + .25 * noise(track) + .35 * popularity(track);
      candidates.sort((a, b) => priority(b) - priority(a));
      const top = Math.max(...candidates.map(level));
      const wave: Candidate[] = [];
      const counts = new Map<string, number>();
      const add = (track: Candidate, limit: number) => { if (wave.length < limit && !wave.includes(track)) wave.push(track); };
      // Ola de 12: tus artistas y cercanos primero, pero siempre se reservan turnos para
      // descubrimientos y, con audio disponible, para temas de tus géneros aún sin clasificar.
      const genreSlots = !!preferences?.genres.length && !!session.audioWorks;
      const personalSlots = !personalized ? 12 : genreSlots ? 6 : 9;
      for (const track of candidates) {
        if (level(track) < top) continue;
        const artist = normalize(track.artist);
        if ((counts.get(artist) || 0) >= 3) continue;
        add(track, personalSlots); counts.set(artist, (counts.get(artist) || 0) + 1);
        if (wave.length === personalSlots) break;
      }
      if (genreSlots) for (const track of candidates) if (!moodAffinity(track, slug) && personalAffinity(track, preferences) > 0) add(track, 9);
      // Descubrimientos: primero los que llegan desde tus artistas (similares de similares) y los menos
      // trillados; la popularidad no ordena aquí para no revisar siempre los mismos éxitos.
      if (personalized) candidates.filter(discoveryCandidate)
        .sort((a, b) => ((b.via ? .4 : 0) + .4 * moodAffinity(b, slug) + .3 * noise(b)) - ((a.via ? .4 : 0) + .4 * moodAffinity(a, slug) + .3 * noise(a)))
        .forEach(track => add(track, 12));
      // Temas sólo del género (sin evidencia de mood) cuestan dos consultas a Last.fm si no hay audio:
      // se revisan únicamente cuando no queda nada mejor.
      const costly = (track: Candidate) => !session.audioWorks && !moodAffinity(track, slug) && personalAffinity(track, preferences) < .8;
      for (const track of candidates) if (!personalized || !costly(track)) add(track, 12);
      if (!wave.length) for (const track of candidates) add(track, 12);
      await Promise.all(wave.map(async track => {
        attempted.add(identity(track));
        if (track.curated) { track.metadataChecked = true; return; }
        // Last.fm sólo se consulta cuando falta saber el género (gustos/estilo) o no hay rasgos de audio.
        const needsGenre = personalized && !personalAffinity(track, effective());
        try {
          let [info] = await Promise.all([needsGenre ? this.providers.info(track) : undefined, this.loadAudio(track)]);
          if (track.audio) session.audioWorks = true;
          if (!track.audio && !track.moodEvidence?.length && !info) info = await this.providers.info(track);
          if (info) { track.tags = [...new Set([...(track.tags || []), ...info.tags])]; track.listeners = info.listeners || track.listeners; }
          if (!track.audio && moodAffinity(track, slug) < .65) track.tags = [...new Set([...(track.tags || []), ...await this.providers.moodTags(track)])];
          track.metadataChecked = true;
          track.retryAt = undefined;
        } catch { failures = true; track.retryAt = Date.now() + 15000; }
      }));
      currentTaste = tasteOf();
    }
    const tracks = selected();
    const sourcesLeft = session.sources.some(source => !source.exhausted);
    if (tracks.length < 7 && session.history.size && !sourcesLeft && ![...session.pool.values()].some(track => available(track) || !!track.retryAt)) {
      // Ya se mostró todo lo compatible con estos gustos: se reinicia el ciclo antes que dejar al usuario sin tanda.
      session.history.clear();
      if (session.historyKey) await this.history.clear(session.historyKey);
      return this.buildBatch(session, slug, page, preferences);
    }
    if (tracks.length === 7) {
      tracks.forEach(track => { session.seen.add(identity(track)); session.pool.delete(identity(track)); });
      const batch: RecommendationBatch = { tracks, size: 7, page, status: 'ready', mode, nextPage: page < 100 ? page + 1 : null };
      if (session.historyKey) void this.history.add(session.historyKey, tracks.map(identity));
      // El sonido de tus artistas en la tanda ancla el perfil (peso menor que una preview escuchada).
      const anchors: TasteSignal[] = tracks.filter(track => track.audio && personalAffinity(track, preferences) >= 1).map(track => ({ artist: track.artist, audio: track.audio, weight: .3 }));
      if (session.tasteKey && anchors.length) void this.taste.record(session.tasteKey, anchors);
      session.pages.set(page, batch);
      session.audioRetryAt.set(page, Date.now() + 60000);
      // Se devuelve la selección enseguida. El frontend consulta el progreso del audio por separado.
      this.enrichBatch(batch);
      return batch;
    }
    const retry = failures || [...session.pool.values()].some(track => available(track) || !!track.retryAt) || (preferences?.artists || []).some(artist => !session.relatedLoaded.has(artist)) || sourcesLeft;
    const previous = session.pages.size > 0;
    // La primera tanda puede mostrar avances; las siguientes nunca reemplazan siete por una lista menor.
    const initial = previous ? [] : tracks;
    return {
      tracks: initial, size: 7, page, status: retry ? 'retry' : 'exhausted', retryAfterMs: failures ? 15000 : 1000, mode, nextPage: null, previewsPending: false,
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
      track.audioChecked = true;
      if (!match) return;
      track.match = match;
      const features = match.isrc ? await this.providers.features(match.isrc).catch(() => null) : null;
      if (features) { track.audio = features; track.energy = features.energy; }
    } catch { /* Deezer no disponible: se reintenta en otra tanda. */ }
  }
  private enrichBatch(batch: RecommendationBatch) {
    batch.previewsPending = true;
    // La coincidencia de Deezer obtenida al clasificar ya trae el preview: no se vuelve a buscar.
    batch.tracks = batch.tracks.map(track => {
      const match = (track as Candidate).match;
      return match?.previewUrl
        ? { ...match, lastfmUrl: track.externalUrl, recommendationReason: track.recommendationReason, previewStatus: 'available' as const }
        : { ...track, previewStatus: track.previewUrl ? 'available' as const : 'loading' as const };
    });
    let fallbackBudget = 2;
    void Promise.all(batch.tracks.map(async (track, index) => {
      if (track.previewUrl) return;
      try {
        let result = await this.providers.preview(track);
        if (!result.previewUrl && result.previewStatus !== 'temporary_error' && fallbackBudget > 0) {
          fallbackBudget--; result = await this.providers.preview(track, true);
        }
        batch.tracks[index] = { ...track, ...result };
      } catch { batch.tracks[index] = { ...track, previewStatus: 'temporary_error' }; }
    })).finally(() => { batch.previewsPending = false; });
  }
}
