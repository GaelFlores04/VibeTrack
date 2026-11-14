import { Component } from 'react';
export default class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <main><h1>No se pudo mostrar la página</h1><button onClick={() => window.location.reload()}>Recargar</button></main> : this.props.children; }
}
