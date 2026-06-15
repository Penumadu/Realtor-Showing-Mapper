import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initFirebase } from "./lib/firebase";

// Initialize Firebase dynamically from server config before rendering the React App
initFirebase().finally(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});
