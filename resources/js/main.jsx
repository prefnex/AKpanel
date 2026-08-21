import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import ClientApp from './client/ClientApp';
import ErrorBoundary from './components/ErrorBoundary';
import '../css/app.css';

// Detect whether running in Client/Tenant Portal (Port 2083 or /client path) vs Root WHM Panel (Port 2087)
const injectedScope = String(window.__AKPANEL_SCOPE__ || '').toLowerCase();
const hostName = window.location.hostname.toLowerCase();
const isClientPortal =
  injectedScope === 'client' ||
  window.location.port === '2083' ||
  hostName.startsWith('cpanel.') ||
  window.location.pathname.startsWith('/client') ||
  window.location.pathname.startsWith('/cpanel') ||
  new URLSearchParams(window.location.search).get('portal') === 'client' ||
  localStorage.getItem('ak_panel_mode') === 'client';

const rootElement = document.getElementById('root');
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <BrowserRouter>
          {isClientPortal ? <ClientApp /> : <App />}
        </BrowserRouter>
      </ErrorBoundary>
    </React.StrictMode>
  );
}
