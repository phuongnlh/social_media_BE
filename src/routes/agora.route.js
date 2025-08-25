const express = require("express");
const { RtcTokenBuilder, RtcRole } = require("agora-access-token");
const router = express.Router();

// Agora configuration
const APP_ID = process.env.AGORA_APP_ID;
const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE;

// Token expiration time (24 hours)
const EXPIRATION_TIME = 24 * 3600; // 24 hours in seconds

/**
 * Generate Agora RTC Token
 * POST /api/agora/token
 * Body: { channelName, uid, role }
 */
router.post("/token", async (req, res) => {
  try {
    const { channelName, uid = 0, role = "publisher" } = req.body;

    // Validate required fields
    if (!channelName) {
      return res.status(400).json({
        success: false,
        message: "Channel name is required",
      });
    }

    // Validate Agora configuration
    if (!APP_ID || !APP_CERTIFICATE) {
      return res.status(500).json({
        success: false,
        message:
          "Agora configuration is missing. Please check environment variables.",
      });
    }

    // Set role (publisher can publish and subscribe, audience can only subscribe)
    const rtcRole =
      role === "audience" ? RtcRole.SUBSCRIBER : RtcRole.PUBLISHER;

    // Calculate token expiration
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + EXPIRATION_TIME;

    // Generate token
    const token = RtcTokenBuilder.buildTokenWithUid(
      APP_ID,
      APP_CERTIFICATE,
      channelName,
      uid,
      rtcRole,
      privilegeExpiredTs
    );

    console.log(
      `🎯 Generated Agora token for channel: ${channelName}, uid: ${uid}`
    );

    res.json({
      success: true,
      data: {
        token,
        appId: APP_ID,
        channelName,
        uid,
        expiredTs: privilegeExpiredTs,
      },
    });
  } catch (error) {
    console.error("❌ Error generating Agora token:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate token",
      error: error.message,
    });
  }
});

/**
 * Generate token for specific user
 * POST /api/agora/user-token
 * Body: { channelName, userId }
 */
router.post("/user-token", async (req, res) => {
  try {
    const { channelName, userId } = req.body;

    if (!channelName || !userId) {
      return res.status(400).json({
        success: false,
        message: "Channel name and user ID are required",
      });
    }

    // Use userId as uid for Agora
    const uid = parseInt(userId) || 0;

    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + EXPIRATION_TIME;

    const token = RtcTokenBuilder.buildTokenWithUid(
      APP_ID,
      APP_CERTIFICATE,
      channelName,
      uid,
      RtcRole.PUBLISHER,
      privilegeExpiredTs
    );

    res.json({
      success: true,
      data: {
        token,
        appId: APP_ID,
        channelName,
        uid,
        userId,
        expiredTs: privilegeExpiredTs,
      },
    });
  } catch (error) {
    console.error("❌ Error generating user token:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate user token",
      error: error.message,
    });
  }
});

/**
 * Validate token (for debugging)
 * GET /api/agora/validate
 */
router.get("/validate", (req, res) => {
  const hasConfig = !!(APP_ID && APP_CERTIFICATE);

  res.json({
    success: true,
    data: {
      hasAppId: !!APP_ID,
      hasAppCertificate: !!APP_CERTIFICATE,
      isConfigured: hasConfig,
      appId: APP_ID ? `${APP_ID.substring(0, 8)}...` : null,
    },
  });
});

module.exports = router;
