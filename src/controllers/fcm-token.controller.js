const FCMToken = require("../models/fcm_tokens.model");

const SaveFcmToken = async (req, res) => {
  const { user_id, deviceId, token, platform } = req.body;
  if (!user_id || !deviceId || !token) return res.status(400).json({ message: "Missing data" });

  await FCMToken.findOneAndUpdate(
    { user_id, deviceId, platform },
    { $set: { token, updatedAt: new Date() } },
    { upsert: true }
  );

  res.status(200).json({ message: "Token saved" });
};

module.exports = { SaveFcmToken };
