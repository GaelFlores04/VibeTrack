export default function ResourceState({ resource, children }) {
  if (resource.loading) return <p role="status">Cargando…</p>;
  if (resource.error) return <div role="alert"><p>{resource.error}</p><button onClick={resource.retry}>Reintentar</button></div>;
  return children;
}
