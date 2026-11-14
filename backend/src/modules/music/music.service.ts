import { canonicalArtistName } from './artist-names';
import { BadRequestException, Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Candidate, curatedCandidates, hasPreferences, moodAffinity, normalize, personalAffinity, Preferences, PROFILES, rankRecommendations } from './recommendation-engine';
import { MusicCache } from './music-cache';
import { MusicProviders } from './music.providers';
import { RecommendationBatch, Track } from './music.types';
import { matchingTitle } from './track-matching';
export { normalizeTrack, Track } from './music.types';

const identity = (track: Track) => `${normalize(track.artist)}|${matchingTitle(track.title)}`;
interface Source { kind: 'tag' | 'artist'; name: string; mood?: boolean; genre?: boolean; relatedTo?: string; page: number; exhausted: boolean; last: number; signatures?: Set<string>; retryAt?: number }
interface Session {
  pool: Map<string, Candidate>; seen: Set<string>; sources: Source[]; pages: Map<number, RecommendationBatch>;
  historyKey?: string; expires: number; relatedLoaded: Set<string>; audioRetryAt: Map<number, number>; request?: Promise<RecommendationBatch>;
}
@Injectable()
export class MusicService {
  private readonly providers: MusicProviders;
  // Historial corto por cuenta y mood, independiente del UUID de la página.
  // No mezcla preferencias ni usuarios; expira y está acotado en memoria.
  private recent = new Map<string, { seen: Set<string>; expires: number }>();
  private sessions = new Map<string, Session>();
  constructor(@Optional() @Inject(MusicCache) cache?: MusicCache) { this.providers = new MusicProviders(cache || new MusicCache()); }
  search(term: string) { return this.providers.search(term); }
  artists(term: string) { return this.providers.artists(term); }
  suggestions(term: string) { return this.providers.suggestions(term); }

  async recommendations(slug: string, page: number, preferences?: Preferences | null, sessionId = 'default', userId = 'guest'): Promise<RecommendationBatch> {
    if (!Object.hasOwn(PROFILES, slug)) throw new NotFoundException('Mood no encontrado.');
    if (preferences) preferences = {
      genres: [...new Set(preferences.genres)].sort(),
      artists: [...new Set(preferences.artists.map(canonicalArtistName).filter(Boolean))].sort(),
    };
    const historyKey = userId !== 'guest' ? createHash('sha256').update(JSON.stringify([userId, slug, preferences])).digest('hex') : undefined;
    const fingerprint = createHash('sha256').update(JSON.stringify([slug, userId, preferences || null, sessionId])).digest('hex');
    let session = this.sessions.get(fingerprint);
    if (!session || session.expires < Date.now()) {
      if (page !== 1) throw new BadRequestException('La tanda caducó. Vuelve a comenzar desde la primera.');
      for (const [key, value] of this.sessions) if (value.expires < Date.now()) this.sessions.delete(key);
      if (this.sessions.size >= 100) {
        const oldestIdle = [...this.sessions].find(([, value]) => !value.request);
        if (oldestIdle) this.sessions.delete(oldestIdle[0]);
      }
      session = this.newSession(slug, preferences);
      session.historyKey = historyKey;
      for (const [key, value] of this.recent) if (value.expires <= Date.now()) this.recent.delete(key);
      const history = historyKey ? this.recent.get(historyKey) : undefined;
      if (history) session.seen = new Set(history.seen);
      this.sessions.set(fingerprint, session);
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
      relatedTo: old.relatedTo || track.relatedTo,
    } : track);
  }
  private async refill(session: Session): Promise<boolean> {
    const sources = session.sources.filter(source => !source.exhausted && (!source.retryAt || source.retryAt <= Date.now())).sort((a, b) => a.last - b.last).slice(0, 4);
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
        source.exhausted = result.nextPage === null || repeated;
        if (result.nextPage) source.page = result.nextPage;
        source.retryAt = undefined;
        for (const track of result.tracks) this.merge(session, { ...track, moodEvidence: source.mood ? [source.name] : [], sourceGenres: source.genre ? [source.name] : [], relatedTo: source.relatedTo });
      } catch { source.retryAt = Date.now() + 15000; }

    }));
    return success;
  }
  private async addRelated(session: Session, preferences?: Preferences | null) {
    if (!preferences?.artists.length) return;
    const results = await Promise.allSettled(preferences.artists.filter(artist => !session.relatedLoaded.has(artist)).map(async artist => ({ artist, similar: await this.providers.similar(artist) })));
    for (const result of results) if (result.status === 'fulfilled') {
      session.relatedLoaded.add(result.value.artist);
      // La afinidad pertenece al artista, no a la fuente por la que llegó la canción.
      for (const track of session.pool.values()) if (result.value.similar.some(name => normalize(name) === normalize(track.artist))) track.relatedTo ||= result.value.artist;
      for (const name of result.value.similar) if (!session.sources.some(source => source.kind === 'artist' && normalize(source.name) === normalize(name))) {
        session.sources.push({ kind: 'artist', name, relatedTo: result.value.artist, page: 1, exhausted: false, last: 0 });
      }
    }
  }
  private async buildBatch(session: Session, slug: string, page: number, preferences?: Preferences | null): Promise<RecommendationBatch> {
    const mode = hasPreferences(preferences) ? 'personalized' : 'discovery';
    const deadline = Date.now() + 12000;
    const attempted = new Set<string>();
    let failures = false;
    let refills = 0;
    const selected = () => rankRecommendations([...session.pool.values()].filter(track => !session.seen.has(identity(track))), slug, preferences, 7);
    const available = (track: Candidate) => !session.seen.has(identity(track)) && !attempted.has(identity(track)) && !track.metadataChecked && (!track.retryAt || track.retryAt <= Date.now()) && (!hasPreferences(preferences) || !!preferences?.genres.length || personalAffinity(track, preferences) > 0);
    {
      await this.addRelated(session, preferences);
      failures = !await this.refill(session); refills++;
    }
    // La disponibilidad de audio nunca determina si se puede mostrar una recomendación.
    for (let round = 0; round < 7 && Date.now() < deadline && selected().length < 7; round++) {
      let candidates = [...session.pool.values()].filter(available);
      if (!candidates.length || (hasPreferences(preferences) && !candidates.some(track => personalAffinity(track, preferences) > 0) && refills < 2)) {
        if (refills >= 3) break;
        await this.addRelated(session, preferences);
        const ok = await this.refill(session); failures ||= !ok; refills++;
        candidates = [...session.pool.values()].filter(available);
      }
      if (selected().length >= 7) break;
      // Con géneros elegidos es más directo verificar el género de temas del mood que
      // examinar un catálogo entero de rock/pop buscando etiquetas de ánimo escasas.
      const priority = (track: Candidate) => preferences?.genres.length
        ? 2 * moodAffinity(track, slug) + personalAffinity(track, preferences)
        : 3 * personalAffinity(track, preferences) + moodAffinity(track, slug);
      candidates.sort((a, b) => priority(b) - priority(a));
      const wave: Candidate[] = [];
      const counts = new Map<string, number>();
      for (const track of candidates) {
        if (priority(track) < priority(candidates[0])) break;
        const artist = normalize(track.artist);
        if ((counts.get(artist) || 0) >= 3) continue;
        wave.push(track); counts.set(artist, (counts.get(artist) || 0) + 1);
        if (wave.length === 12) break;
      }
      for (const track of candidates) { if (wave.length === 12) break; if (!wave.includes(track)) wave.push(track); }
      await Promise.all(wave.map(async track => {
        attempted.add(identity(track));
        const needsInfo = !track.curated && (!track.moodEvidence?.length || (hasPreferences(preferences) && !personalAffinity(track, preferences)));
        if (!needsInfo) { track.metadataChecked = true; return; }
        try {
          Object.assign(track, await this.providers.info(track));
          if (moodAffinity(track, slug) < .65) track.tags = [...new Set([...(track.tags || []), ...await this.providers.moodTags(track)])];
          track.metadataChecked = true;
          track.retryAt = undefined;
        } catch { failures = true; track.retryAt = Date.now() + 15000; }
      }));
    }
    const tracks = selected();
    if (tracks.length === 7) {
      tracks.forEach(track => { session.seen.add(identity(track)); session.pool.delete(identity(track)); });
      const batch: RecommendationBatch = { tracks, size: 7, page, status: 'ready', mode, nextPage: page < 100 ? page + 1 : null };
      if (session.historyKey) {
        const old = this.recent.get(session.historyKey);
        const seen = new Set([...(old?.seen || []), ...tracks.map(identity)]);
        while (seen.size > 350) seen.delete(seen.values().next().value!);
        this.recent.delete(session.historyKey);
        if (this.recent.size >= 500) this.recent.delete(this.recent.keys().next().value!);
        this.recent.set(session.historyKey, { seen, expires: Date.now() + 30 * 60000 });
      }
      session.pages.set(page, batch);
      session.audioRetryAt.set(page, Date.now() + 60000);
      // Se devuelve la selección enseguida. El frontend consulta el progreso del audio por separado.
      this.enrichBatch(batch);
      return batch;
    }
    const retry = failures || [...session.pool.values()].some(track => available(track) || !!track.retryAt) || (preferences?.artists || []).some(artist => !session.relatedLoaded.has(artist)) || session.sources.some(source => !source.exhausted);
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
  private enrichBatch(batch: RecommendationBatch) {
    batch.previewsPending = true;
    batch.tracks = batch.tracks.map(track => ({ ...track, previewStatus: track.previewUrl ? 'available' : 'loading' }));
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
