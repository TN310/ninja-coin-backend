const admin = require("firebase-admin");
require("dotenv").config();

admin.initializeApp({
  databaseURL: process.env.FIREBASE_DATABASE_URL,
});

const db = admin.database();

module.exports = db;
