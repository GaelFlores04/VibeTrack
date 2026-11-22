import { Link } from 'react-router-dom';
import { moodPresentation } from './moodPresentation';

// El estante de nogal: una caja de vinilos por mood, rotulada a mano y con su pegatina de color.
// Sacar una caja (pulsarla) abre la sesión de ese mood. Dos baldas de tres cajas.
export default function MoodShelf({ moods = [], compact = false }) {
  if (!moods.length) return <p className="shelf-empty">El estante está vacío por ahora.</p>;
  const planks = [moods.slice(0, 3), moods.slice(3, 6)].filter(row => row.length);
  return <div className={`mood-shelf${compact ? ' is-compact' : ''}`}>
    {planks.map((row, index) => <ul key={index} className="shelf-plank" data-keyboard-group="linear" aria-label={index ? 'Balda de abajo' : 'Balda de arriba'}>
      {row.map(mood => {
        const look = moodPresentation(mood.slug);
        return <li key={mood.slug}>
          <Link className="record-box" to={`/recomendaciones/${mood.slug}`} style={{ '--sticker': look.color }}
            aria-describedby={`box-${mood.slug}`}>
            <span className="box-vinyl" aria-hidden="true" />
            <span className="box-front">
              <span className="box-sticker" aria-hidden="true" />
              <span className="box-label">{mood.name}</span>
            </span>
          </Link>
          <p className="box-tag" id={`box-${mood.slug}`}>{compact ? look.hint : `${look.moment} ${look.hint}`}</p>
        </li>;
      })}
    </ul>)}
  </div>;
}
