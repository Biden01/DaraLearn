import React from "react";
import ReactDOM from "react-dom/client";
import Landing from "./Landing.jsx";
import Demo from "./demo/Demo.jsx";
import "./styles.css";

const App = window.location.pathname.replace(/\/+$/, "") === "/demo" ? Demo : Landing;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
