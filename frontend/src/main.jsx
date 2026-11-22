import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './app/App';
import { AuthProvider } from './features/auth/AuthProvider';
import { PlayerProvider } from './features/player/PlayerProvider';
import ErrorBoundary from './shared/components/ErrorBoundary';
import '@fontsource-variable/atkinson-hyperlegible-next/index.css';
import '@fontsource-variable/big-shoulders-display';
import '@fontsource/courier-prime/400.css';
import '@fontsource/courier-prime/700.css';
import '@fontsource/permanent-marker/400.css';
// discovery.css aporta sólo la maquetación de las salas secundarias; el estudio lo define studio.css.
import './styles/discovery.css';
import './styles/studio.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <PlayerProvider>
            <App />
          </PlayerProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
