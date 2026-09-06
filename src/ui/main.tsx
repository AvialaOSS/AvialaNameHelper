import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";

/* Token effect layers for the components this plugin actually uses. Importing
   only what is needed keeps the single inlined ui.html small. */
import "@aviala-design/tokens/ald-theme.css";
import "@aviala-design/tokens/icon-effects.css";
import "@aviala-design/tokens/typeface-effects.css";
import "@aviala-design/tokens/focus-effects.css";
import "@aviala-design/tokens/layout-effects.css";
import "@aviala-design/tokens/button-effects.css";
import "@aviala-design/tokens/input-effects.css";
import "@aviala-design/tokens/basic-input-effects.css";
import "@aviala-design/tokens/popover-effects.css";
import "@aviala-design/tokens/tooltip-effects.css";
import "@aviala-design/tokens/list-effects.css";
import "@aviala-design/tokens/feedback-effects.css";
import "@aviala-design/tokens/alert-effects.css";
import "@aviala-design/tokens/badge-effects.css";
import "@aviala-design/tokens/tab-effects.css";
import "@aviala-design/tokens/loading-effects.css";
import "@aviala-design/tokens/information-display-extras.css";
import "@aviala-design/tokens/information-collect-extras.css";
import "@aviala-design/tokens/structure-navigation-extras.css";

import { initKeyboardFocus } from "@aviala-design/spiral";

import App from "./App";

initKeyboardFocus();

const container = document.getElementById("root");
if (!container) throw new Error("Root container #root not found");

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);
