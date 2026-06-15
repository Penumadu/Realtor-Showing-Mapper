import { FirebaseApp, initializeApp } from "firebase/app";
import { Auth, getAuth, GoogleAuthProvider } from "firebase/auth";
import { Firestore, getFirestore } from "firebase/firestore";

let firebaseApp: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// We export a getter for isConfigured so we can read the updated state after init
export let isConfigured = false;

export const getFirebaseApp = () => {
  if (!firebaseApp) {
    throw new Error("Firebase has not been initialized. Call initFirebase() first.");
  }
  return firebaseApp;
};

export const getAuthInstance = () => {
  if (!authInstance) {
    throw new Error("Firebase Auth has not been initialized. Call initFirebase() first.");
  }
  return authInstance;
};

export const getDbInstance = () => {
  if (!dbInstance) {
    throw new Error("Firebase Firestore has not been initialized. Call initFirebase() first.");
  }
  return dbInstance;
};

export async function initFirebase(): Promise<void> {
  if (firebaseApp) return; // Already initialized

  try {
    const response = await fetch("/api/firebase-config");
    if (!response.ok) throw new Error("Failed to load config from API server");
    
    const config = await response.json();
    if (config.apiKey && config.apiKey !== "your_api_key_here") {
      firebaseApp = initializeApp(config);
      authInstance = getAuth(firebaseApp);
      dbInstance = getFirestore(firebaseApp);
      isConfigured = true;
    } else {
      console.warn("⚠️ Firebase credentials are using placeholders. Authentication and Cloud Saving will be disabled.");
      initializeFallback();
    }
  } catch (err) {
    console.warn("⚠️ Firebase configuration failed to load from server. Falling back to local placeholder.", err);
    initializeFallback();
  }
}

function initializeFallback() {
  firebaseApp = initializeApp({
    apiKey: "placeholder-key",
    authDomain: "placeholder-project.firebaseapp.com",
    projectId: "placeholder-project",
    storageBucket: "placeholder-project.firebasestorage.app",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef",
  });
  authInstance = getAuth(firebaseApp);
  dbInstance = getFirestore(firebaseApp);
  isConfigured = false;
}
