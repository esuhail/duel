import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { unlockAudioOnFirstGesture } from "./audio/sfx";
import { App } from "./ui/App";

unlockAudioOnFirstGesture();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
