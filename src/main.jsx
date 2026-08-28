import React from "react";
import ReactDOM from "react-dom/client";

import {
  BrowserRouter,
} from "react-router-dom";

import App from "./App";

import {
  AuthProvider,
} from "./context/AuthContext";


// ==========================================================
// GLOBAL STYLES
// ==========================================================

import "./styles/global.css";
import "./styles/order.css";
import "./styles/auth.css";
import "./styles/dashboard.css";
import "./styles/animations.css";


// ==========================================================
// PLATFORM STYLES
// ==========================================================

import "./styles/mobile-nav.css";
import "./styles/system-pages.css";
import "./styles/admin.css";
import "./styles/commerce.css";
import "./styles/company-pages.css";


// ==========================================================
// PROFESSIONAL PORTAL SYSTEM
// ==========================================================

import "./styles/platform-v2.css";
import "./styles/admin-mobile-pro.css";

import "./styles/payment-operations.css";
import "./styles/payment-checkout-v2.css";

import "./styles/project-operations.css";

import "./styles/workspace-polish.css";
import "./styles/workspace-projects.css";
import "./styles/workspace-payments.css";
import "./styles/workspace-files.css";
import "./styles/workspace-updates.css";


// ==========================================================
// CLIENT + ADMIN PORTAL DESIGN SYSTEM
// ==========================================================

import "./styles/client-portal-pro.css";
import "./styles/admin-project-mobile-v3.css";


// ==========================================================
// PAYMENT MANAGEMENT SYSTEM
// ==========================================================

import "./styles/payment-management.css";


// ==========================================================
// FINAL OVERRIDE LAYERS
// THESE MUST ALWAYS LOAD LAST
// ==========================================================

import "./styles/portal-readable-type.css";
import "./styles/portal-mobile-safety.css";



// ==========================================================
// APPLICATION START
// ==========================================================


const root =
  document.getElementById(
    "root"
  );


if (!root) {

  throw new Error(
    "Posho Creative application root was not found."
  );

}



ReactDOM.createRoot(
  root
).render(

  <React.StrictMode>

    <BrowserRouter>

      <AuthProvider>

        <App />

      </AuthProvider>

    </BrowserRouter>

  </React.StrictMode>

);
