import React from 'react';

import ReactDOM from 'react-dom/client';

import {
  BrowserRouter,
} from 'react-router-dom';

import App from './App';

import {
  AuthProvider,
} from './context/AuthContext';

import './styles/global.css';
import './styles/order.css';
import './styles/auth.css';
import './styles/dashboard.css';
import './styles/workspace.css';
import './styles/animations.css';
import './styles/mobile-nav.css';

const root =
  document.getElementById(
    'root',
  );

if (!root) {
  throw new Error(
    'Posho Creative could not find the application root.',
  );
}

ReactDOM.createRoot(
  root,
).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);