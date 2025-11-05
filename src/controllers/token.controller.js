require("dotenv").config();
const jwt = require("jsonwebtoken");
const redisClient = require("../config/database.redis");
const { signToken } = require("../utils/jwt_utils");
const FCMToken = require("../models/fcm_tokens.model");
const publicKey = require("fs").readFileSync("./src/config/public_key.pem", "utf-8");

const refreshAccessToken = async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) return res.status(403).json({ message: "No refresh token" });

  try {
    // ✅ Xác thực refresh token
    const payload = jwt.verify(refreshToken, publicKey, {
      algorithms: ["RS256"],
    });

    const userId = payload.id;
    const key = `refresh:${userId}:${refreshToken}`;

    // ✅ Kiểm tra token có tồn tại trong Redis không
    const exists = await redisClient.exists(key);

    if (!exists) {
      // Kiểm tra xem user có token mới gần đây không (để phân biệt replay thật)
      const recentTokens = await redisClient.sMembers(`user-sessions:${userId}`);

      if (recentTokens.length > 0) {
        // ⚠️ Có token mới => Có thể là refresh song song → không xoá session
        return res.status(403).json({ message: "Refresh token expired" });
      }

      // 🚨 Replay attack thật → xoá toàn bộ session
      const userTokensKey = `user-sessions:${userId}`;
      const oldTokens = await redisClient.sMembers(userTokensKey);
      if (oldTokens.length > 0) {
        const delKeys = oldTokens.map((t) => `refresh:${userId}:${t}`);
        await redisClient.del(userTokensKey, ...delKeys);
      }
      await FCMToken.deleteMany({ user_id: userId });

      return res.status(403).json({
        message: "Possible replay attack. All sessions terminated.",
      });
    }

    // ✅ Tạo token mới
    const newAccessToken = signToken({ id: userId }, "15m");
    const newRefreshToken = signToken({ id: userId }, "7d");
    const newKey = `refresh:${userId}:${newRefreshToken}`;
    const userSessionsKey = `user-sessions:${userId}`;

    // ✅ Transaction để đảm bảo nguyên tử (atomic)
    await redisClient
      .multi()
      .set(newKey, "valid", { EX: 60 * 60 * 24 * 7 })
      .sAdd(userSessionsKey, newRefreshToken)
      .expire(userSessionsKey, 60 * 60 * 24 * 7)
      .expire(key, 10)
      .exec();

    // ✅ Cập nhật cookie an toàn
    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.status(200).json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (err) {
    console.error("Refresh token error:", err.message);
    res.status(403).json({ message: "Invalid refresh token", err: err.message });
  }
};

module.exports = { refreshAccessToken };
