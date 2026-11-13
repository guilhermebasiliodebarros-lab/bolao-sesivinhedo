import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, initializeFirestore } from 'firebase/firestore'
import { isRehearsal, REHEARSAL_PROJECT } from '../config/rehearsal.js'

const firebaseConfig = isRehearsal ? {
  apiKey: 'demo-interclasse-key', authDomain: `${REHEARSAL_PROJECT}.firebaseapp.com`, projectId: REHEARSAL_PROJECT,
  storageBucket: `${REHEARSAL_PROJECT}.appspot.com`, messagingSenderId: '1234567890', appId: '1:1234567890:web:ensaio',
} : {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const firebaseEnvNames = {
  apiKey: 'VITE_FIREBASE_API_KEY',
  authDomain: 'VITE_FIREBASE_AUTH_DOMAIN',
  projectId: 'VITE_FIREBASE_PROJECT_ID',
  storageBucket: 'VITE_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'VITE_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'VITE_FIREBASE_APP_ID',
}

const requiredKeys = Object.keys(firebaseEnvNames)

export const missingFirebaseConfig = requiredKeys.filter((key) => !firebaseConfig[key])
export const isFirebaseConfigured = missingFirebaseConfig.length === 0

export const app = isFirebaseConfigured ? initializeApp(firebaseConfig) : null
export const auth = app ? getAuth(app) : null
// School networks may buffer streaming responses. Long polling keeps remote displays current.
export const db = app ? initializeFirestore(app, {
  experimentalForceLongPolling: true,
  experimentalLongPollingOptions: { timeoutSeconds: 10 },
}) : null

if (isRehearsal) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9909', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8180)
}
