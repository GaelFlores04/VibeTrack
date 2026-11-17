import Icon from './Icon';

export default function ResourceState({ resource, children }) {
  if (resource.loading) {
    return <div className="resource-state is-loading" role="status"><Icon name="disc" size={28} /><p>Cargando…</p></div>;
  }
  if (resource.error) {
    return (
      <div className="resource-state" role="alert">
        <p>{resource.error}</p>
        <button type="button" onClick={resource.retry}>Volver a intentarlo</button>
      </div>
    );
  }
  return children;
}
