import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Offline shell (see public/sw.js). Registered after load so it never competes
// with the first paint. Localhost is skipped so `npm run dev` stays uncached.
if ('serviceWorker' in navigator && !/^(localhost|127\.)/.test(location.hostname)) {
  // Cuando un service worker nuevo toma el control (deploy con sw.js nuevo), la
  // página ya cargada viene del anterior: se recarga una vez. Sin controller
  // previo es la primera instalación y no hace falta.
  if (navigator.serviceWorker.controller) {
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!reloaded) {
        reloaded = true;
        location.reload();
      }
    });
  }
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* offline support is a bonus, never a hard requirement */
    });
  });
}
