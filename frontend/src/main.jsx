import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import "./index.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "#1a1a2e",
            color: "#eaeaea",
            border: "1px solid #2a2a3e",
          },
        }}
      />
      <App />
    </BrowserRouter>
  </StrictMode>
);
