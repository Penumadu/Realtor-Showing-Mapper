import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Check if Firebase configuration is complete and not using placeholder values
const isConfigured = 
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== "your_api_key_here" &&
  firebaseConfig.projectId &&
  firebaseConfig.projectId !== "your_project_id_here";

if (!isConfigured) {
  console.warn(
    "⚠️ Firebase configuration is missing or holds placeholder values. " +
    "Please populate the keys in artifacts/route-mapper/.env to enable Login and Cloud Saving."
  );
}

// Initialize Firebase App
const app = initializeApp(
  isConfigured 
    ? firebaseConfig 
    : {
        // Fallback placeholder configuration to prevent crash during boot/build
        apiKey: "placeholder-key",
        authDomain: "placeholder-project.firebaseapp.com",
        projectId: "placeholder-project",
        storageBucket: "placeholder-project.firebasestorage.app",
        messagingSenderId: "123456789",
        appId: "1:123456789:web:abcdef",
      }
);

// Initialize Firebase Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Initialize Firestore
export const db = getFirestore(app);
export { isConfigured };
