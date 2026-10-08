import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@fontsource/fraunces/600.css';
import '@fontsource/fraunces/600-italic.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/outfit/400.css';
import '@fontsource/outfit/500.css';
import '@fontsource/outfit/600.css';

import { App } from './App';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('Root element #root is missing');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
