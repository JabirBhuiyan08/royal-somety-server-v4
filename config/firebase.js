// server/config/firebase.js
import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';

let app;

try {
  if (!admin.apps.length) {
    // Option 1: Use service account JSON file
    if (existsSync('./config/serviceAccountKey.json')) {
      const serviceAccount = JSON.parse(readFileSync('./config/serviceAccountKey.json', 'utf-8'));
      app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
    // Option 2: Use environment variable (JSON string)
    else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }
    // Option 3: Use individual env vars
    else {
      app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }),
      });
    }
    console.log('✅ Firebase Admin সংযুক্ত');
  }
} catch (err) {
  console.error('❌ Firebase Admin সংযোগ ব্যর্থ:', err.message);
}

export { admin };
export default app;
