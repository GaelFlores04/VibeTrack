export const MOOD_PRESENTATION = {
  feliz: { color: '#ffb547', light: '#ffe08a', dark: '#ff8a3d', moment: 'Dale play a un buen día.', hint: 'Luz, ritmo y ganas de cantar.' },
  relajado: { color: '#5fd6c4', light: '#c6fff1', dark: '#2b9a9a', moment: 'Baja un poco el ritmo.', hint: 'Una pausa con buena música.' },
  motivado: { color: '#ff7a5c', light: '#ffd0c2', dark: '#e2413b', moment: 'Encuentra tu impulso.', hint: 'Energía para lo que viene.' },
  triste: { color: '#6f86d9', light: '#c9d6ff', dark: '#3a4aa6', moment: 'También hay música para eso.', hint: 'Canciones que te acompañan.' },
  romantico: { color: '#ff8db8', light: '#ffd6e6', dark: '#d94f8a', moment: 'Quédate en ese momento.', hint: 'Un poco más cerca, canción a canción.' },
  cansado: { color: '#a99be0', light: '#e9e4ff', dark: '#6c5fb0', moment: 'Hoy toca ir despacio.', hint: 'Sonidos suaves para descansar.' },
};

export function moodPresentation(slug) {
  return MOOD_PRESENTATION[slug] || MOOD_PRESENTATION.relajado;
}
