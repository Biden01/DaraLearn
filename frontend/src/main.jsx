import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";

// /dev — короткая ссылка на Scrum-доску в кабинете.
if (/^\/dev\/?$/.test(window.location.pathname)) window.location.replace("/app#/dev");

// Лендинг и кабинет — отдельные чанки со своими стилями.
const isApp = /^\/app(\/|$)/.test(window.location.pathname);
const Root = isApp ? lazy(() => import("./app/App.jsx")) : lazy(() => import("./landing/Landing.jsx"));

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Suspense fallback={null}><Root /></Suspense>
  </React.StrictMode>
);
