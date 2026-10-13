import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};

const firebaseConfig = {
  apiKey:            env.VITE_FIREBASE_API_KEY || '',
  authDomain:        env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId:         env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket:     env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId:             env.VITE_FIREBASE_APP_ID || '',
};

const hasValidFirebaseConfig = Object.values(firebaseConfig).every(value => typeof value === 'string' && value.trim().length > 0);
const app = hasValidFirebaseConfig ? initializeApp(firebaseConfig) : null;

export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
export default app;
