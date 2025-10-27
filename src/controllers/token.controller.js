require("dotenv").config();
const jwt = require("jsonwebtoken");
const redisClient = require("../config/database.redis");
const { signToken } = require("../utils/jwt_utils");
const publicKey = require("fs").readFileSync("./src/config/public_key.pem", "utf-8");

const refreshAccessToken = async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) return res.status(403).json({ message: "No refresh token" });

  try {
    const payload = jwt.verify(refreshToken, publicKey, {
      algorithms: ["RS256"],
    });
    const key = `refresh:${payload.id}:${refreshToken}`;
    const exists = await redisClient.exists(key);
    if (!exists) {
      // 🚨 Replay attack hoặc token đã bị xóa
      // → Xóa toàn bộ session của user
      const pattern = `refresh:${payload.id}:*`;
      const keys = await redisClient.keys(pattern);
      if (keys.length > 0) {
        await Promise.all(keys.map((key) => redisClient.del(key)));
      }

      return res.status(403).json({ message: "Possible replay attack. All sessions terminated." });
    }

    const newAccessToken = signToken({ id: payload.id }, "15m");
    const newRefreshToken = signToken({ id: payload.id }, "7d");

    // ✅ Lưu refresh token mới vào Redis
    const newRefreshKey = `refresh:${payload.id}:${newRefreshToken}`;
    await redisClient.set(newRefreshKey, "valid", {
      EX: 60 * 60 * 24 * 7, // 7 ngày
    });
    // Thêm refresh token vào danh sách phiên của người dùng
    const userRefreshTokensSet = `user-sessions:${payload.id}`;
    await redisClient.sAdd(userRefreshTokensSet, newRefreshToken);
    // ✅ Gửi refresh token mới vào cookie
    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: false,
      domain: process.env.FRONTEND_URI,
      sameSite: "Lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    // ✅ Token hợp lệ → Xóa cái cũ
    await redisClient.del(key);

    res.status(200).json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (err) {
    res.status(403).json({ message: "Invalid refresh token", err });
  }
};

module.exports = { refreshAccessToken };
