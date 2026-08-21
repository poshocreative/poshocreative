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
import './styles/system-pages.css';
import './styles/admin.css';
import './styles/commerce.css';
import './styles/company-pages.css';
import './styles/platform-v2.css';
import './styles/admin-mobile-pro.css';
import './styles/payment-operations.css';
import './styles/payment-checkout-v2.css';
import './styles/project-operations.css';
import './styles/workspace-polish.css';
import './styles/workspace-projects.css';
import './styles/workspace-payments.css';
import './styles/workspace-files.css';

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