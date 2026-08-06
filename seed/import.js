/**
 * One-time script to import universities-seed.json into Firestore.
 *
 * Setup:
 *   1. npm install firebase-admin
 *   2. Download a service account key from:
 *      Firebase Console → Project settings → Service accounts → Generate new private key
 *      Save it as seed/serviceAccountKey.json (this file is git-ignored, never commit it)
 *   3. Run: node seed/import.js
 *
 * This is optional — you can also add universities manually from the Admin
 * Panel (admin.html) instead of running this script.
 */
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');
const data = require('./universities-seed.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function run() {
  const batch = db.batch();
  data.forEach((uni, i) => {
    const ref = db.collection('universities').doc();
    batch.set(ref, { ...uni, order: i });
  });
  await batch.commit();
  console.log(`Imported ${data.length} universities into Firestore.`);
}

run().catch(err => {
  console.error('Import failed:', err);
  process.exit(1);
});
