const mongoose = require("mongoose");

const fcmSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  deviceId: { type: String, required: true },
  token: { type: String, required: true },
  platform: { type: String, required: true },
});

const FCMToken = mongoose.model("FCMToken", fcmSchema);

module.exports = FCMToken;
