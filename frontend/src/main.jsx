import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './app/App';
import { AuthProvider } from './features/auth/AuthProvider';
import { PlayerProvider } from './features/player/PlayerProvider';
import ErrorBoundary from './shared/components/ErrorBoundary';
import '@fontsource-variable/saira/wdth-italic.css';
import '@fontsource-variable/atkinson-hyperlegible-next/index.css';
import '@fontsource/share-tech-mono/400.css';
import '@fontsource/permanent-marker/400.css';
import './styles/base.css';
import './styles/navigation.css';
import './styles/discovery.css';

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
