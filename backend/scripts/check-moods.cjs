// Manual, read-only provider audit. No user account, MongoDB or playback needed.
require('reflect-metadata');
const path = require('node:path');
const fs = require('node:fs');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const { MusicProviders } = require('../dist/modules/music/music.providers');
const { MusicCache } = require('../dist/modules/music/music-cache');
const { assessMood, MOOD_POLICY_VERSION } = require('../dist/modules/music/mood-classifier');

const cases = [
  ['Daft Punk', 'The Game of Love', 'feliz'],
  ['Arctic Monkeys', 'This House is a Circus', 'feliz'],
  ['Daft Punk', 'The Grid', 'triste'],
  ['Thomas Bangalter', "Bangalter: Mythologies: X. L'Accouchement", 'triste'],
  ['Foster the People', 'Pumped Up Kicks', 'feliz'],
  ['Third Eye Blind', 'Semi-Charmed Life', 'feliz'],
  ['Pharrell Williams', 'Happy', 'feliz'],
  ['Coldplay', 'Fix You', 'triste'],
  ['John Legend', 'All of Me', 'romantico'],
  ['Jack Johnson', 'Banana Pancakes', 'relajado'],
  ['Yiruma', 'River Flows in You', 'cansado'],
  ['Eminem', 'Lose Yourself', 'motivado'],
];

async function main() {
  const providers = new MusicProviders(new MusicCache());
  const tracks = [];
  for (const [artist, title, mood] of cases) {
    const track = { id: title, artist, title, externalUrl: 'https://www.last.fm/' };
    try {
      const [info, detailedTags, match, lyrics] = await Promise.all([
        providers.info(track), providers.moodTags(track), providers.match(track), providers.lyrics(track),
      ]);
      const tags = [...new Set([...info.tags, ...detailedTags])];
      const audio = match?.isrc ? await providers.features(match.isrc) : null;
      const assessment = assessMood({ ...track, tags, audio: audio || undefined, lyrics, lyricsChecked: true }, mood);
      tracks.push({ artist, title, mood, isrc: match?.isrc, tags, audio, lyrics, assessment });
      console.log(`${mood}: ${artist} / ${title}: ${assessment.reason} (${assessment.score.toFixed(3)})`);
    } catch {
      tracks.push({ artist, title, mood, error: 'provider-unavailable' });
      console.log(`${title}: proveedor no disponible; resultado inconcluso.`);
      process.exitCode = 1;
    }
  }
  if (process.argv.includes('--write')) {
    const report = { checkedAt: new Date().toISOString(), policyVersion: MOOD_POLICY_VERSION,
      note: 'Convenience sample, not an accuracy benchmark. Only numeric lyric profiles; no lyrics or user data stored.', tracks };
    fs.writeFileSync(path.join(__dirname, '../../docs/mood-provider-sample.json'), `${JSON.stringify(report, null, 2)}\n`);
  }
}
main().catch(() => { console.error('No se pudo completar la auditoría de moods.'); process.exitCode = 1; });
