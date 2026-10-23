import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";

// Лендинг и кабинет — отдельные чанки со своими стилями.
const isApp = /^\/app(\/|$)/.test(window.location.pathname);
const Root = isApp ? lazy(() => import("./app/App.jsx")) : lazy(() => import("./landing/Landing.jsx"));

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Suspense fallback={null}><Root /></Suspense>
  </React.StrictMode>
);
