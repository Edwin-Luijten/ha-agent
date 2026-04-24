import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

// Rewrite absolute-path fetches against document.baseURI so the app works
// under HA's ingress prefix (e.g. /api/hassio_ingress/<token>/) without
// touching every call site.
const origFetch = window.fetch;
window.fetch = (input, init) => {
  if (typeof input === "string" && input.startsWith("/") && !input.startsWith("//")) {
    input = new URL(input.slice(1), document.baseURI).toString();
  }
  return origFetch(input, init);
};

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
