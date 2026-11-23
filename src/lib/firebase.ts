import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const env = import.meta.env;
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
};

/** null when VITE_FIREBASE_* is not configured: the app falls back to the local store. */
export const db = config.apiKey && config.projectId ? getFirestore(initializeApp(config)) : null;
export const BOARD_ID: string = env.VITE_FIREBASE_BOARD_ID || 'main';
