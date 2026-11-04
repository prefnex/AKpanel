import React, { Suspense, lazy } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'motion/react';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import ErrorBoundary from './components/ErrorBoundary';
import { ThemeProvider } from './lib/theme';
import { queryClient } from './lib/query';
import { Toaster } from './components/ui/sonner';
import { TooltipProvider } from './components/ui/tooltip';
import '../css/app.css';
import '../css/legacy-light.css';

const App = lazy(() => import('./App'));
const ClientApp = lazy(() => import('./client/ClientApp'));

// Detect whether running in Client/Tenant Portal (Port 2083 or /client path) vs Root Admin Panel (Port 2087)
const injectedScope = String(
  document.querySelector('meta[name="akpanel-scope"]')?.getAttribute('content') || ''
).toLowerCase();
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
        <ThemeProvider defaultTheme="dark">
          <QueryClientProvider client={queryClient}>
            <MotionConfig reducedMotion="user">
              <TooltipProvider delayDuration={200}>
                <BrowserRouter>
                  <Suspense fallback={null}>{isClientPortal ? <ClientApp /> : <App />}</Suspense>
                </BrowserRouter>
                <Toaster position="bottom-right" richColors closeButton />
              </TooltipProvider>
            </MotionConfig>
          </QueryClientProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
}
