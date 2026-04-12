const admin = require("firebase-admin");
require("dotenv").config();

let credential;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  credential = admin.credential.cert(serviceAccount);
} else {
  credential = admin.credential.applicationDefault();
}

admin.initializeApp({
  credential,
  databaseURL: process.env.FIREBASE_DATABASE_URL,
});

const db = admin.database();
module.exports = db;
