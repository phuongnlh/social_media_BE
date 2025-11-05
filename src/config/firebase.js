const admin = require("firebase-admin");
import serviceAccount from "../../google-services.json" assert { type: "json" };
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

module.exports = admin;