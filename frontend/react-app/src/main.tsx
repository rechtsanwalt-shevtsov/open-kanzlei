import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
import './styles/global.css';
import './styles/themes.css';
import './styles/admin.css';
import './styles/work.css';
import './styles/kanban.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
