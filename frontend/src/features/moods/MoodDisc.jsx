import { moodPresentation } from './moodPresentation';

export default function MoodDisc({ slug }) {
  const { color, light, dark } = moodPresentation(slug);
  return (
    <span
      className="mood-disc"
      aria-hidden="true"
      style={{ background: `radial-gradient(circle, ${light} 0 30%, ${color} 31% 62%, ${dark} 63%)` }}
    />
  );
}
