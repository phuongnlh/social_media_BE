const FCMToken = require("../models/fcm_tokens.model");

const SaveFcmToken = async (req, res) => {
  const { userId, deviceId, token, platform } = req.body;

  if (!userId || !deviceId || !token) return res.status(400).json({ message: "Missing data" });

  await FCMToken.findOneAndUpdate(
    { userId, deviceId, platform },
    { $set: { token, updatedAt: new Date() } },
    { upsert: true }
  );

  res.status(200).json({ message: "Token saved" });
};

module.exports = { SaveFcmToken };
