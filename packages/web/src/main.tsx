import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ApolloProvider } from '@apollo/client';
import { apolloClient } from './lib/apollo';
import App from './App';
import './index.css';

// Apply an explicit theme before first paint. `contrast` is a flat, no-texture,
// high-contrast render used by OpenCV layout audits — and the groundwork for a
// real high-contrast accessibility theme. Source priority: ?theme= URL param,
// then the persisted choice (graphdone:theme). Default theme = no attribute.
try {
  const urlTheme = new URLSearchParams(window.location.search).get('theme');
  if (urlTheme) localStorage.setItem('graphdone:theme', urlTheme);
  const theme = urlTheme || localStorage.getItem('graphdone:theme');
  if (theme) document.documentElement.setAttribute('data-theme', theme);
} catch { /* non-browser / storage blocked */ }

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <ApolloProvider client={apolloClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ApolloProvider>
  </React.StrictMode>
);