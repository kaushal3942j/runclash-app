import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import 'leaflet/dist/leaflet.css'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// PWA Service Worker Registration - Production Only
if ('serviceWorker' in navigator) {
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (import.meta.env.PROD && !isLocalhost) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('RunClash: PWA Service Worker registered.', reg.scope))
        .catch(err => console.error('RunClash: PWA Service Worker registration failed.', err));
    });
  } else {
    // Unregister active service worker on localhost/development to prevent stale bundle caching
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (const registration of registrations) {
        registration.unregister();
        console.log('RunClash: Unregistered dev service worker on localhost.');
      }
    });
  }
}
