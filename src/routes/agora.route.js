const express = require("express");
const {
  genToken,
  genUserToken,
  validateToken,
} = require("../controllers/call.controller");
const router = express.Router();

/**
 * Generate Agora RTC Token
 * POST /api/agora/token
 * Body: { channelName, uid, role }
 */

router.post("/token", genToken);

/**
 * Generate token for specific user
 * POST /api/agora/user-token
 * Body: { channelName, userId }
 */
router.post("/user-token", genUserToken);

/**
 * Validate token (for debugging)
 * GET /api/agora/validate
 */
router.get("/validate", validateToken);

module.exports = router;
