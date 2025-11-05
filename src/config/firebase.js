const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

// Đọc file JSON theo cách CommonJS
const serviceAccountPath = path.join(__dirname, "../../google-services.json");
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

module.exports = admin;
