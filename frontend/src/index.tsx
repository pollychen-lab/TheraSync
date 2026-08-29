import React from "react";
import ReactDOM from "react-dom/client";
import TheraSyncApp from "./TheraSyncApp";
import "./index.css";

const container = document.getElementById("root");
const root = ReactDOM.createRoot(container as HTMLElement);

root.render(
  <React.StrictMode>
    <TheraSyncApp />
  </React.StrictMode>
);
