const redisClient = require("../../config/database.redis");
const User = require("../../models/user.model");
const { verifyToken, signToken } = require("../../utils/jwt_utils");
const { validatePwd } = require("../../utils/pwd_utils");
const jwt = require("jsonwebtoken");
const publicKey = require("fs").readFileSync("./src/config/public_key.pem", "utf-8");
const loginAdmin = async (req, res) => {
  try {
    const { email, password } = req.body;
    // Tìm người dùng theo email
    const user = await User.findOne({ email: email });
    if (!user) {
      return res.status(403).json({ message: "Email or password is incorrect!" });
    }

    if (user.role !== "admin" && user.role !== "super_admin") {
      return res.status(403).json({ message: "You are not an admin!" });
    }

    // Kiểm tra mật khẩu
    if (!validatePwd(password, user.hash, user.salt)) {
      return res.status(403).json({ message: "Email or password is incorrect!" });
    }

    // Create access token and refresh token
    const accessToken = signToken({ id: user._id }, "15m");
    const refreshToken = signToken({ id: user._id }, "7d");

    // Lưu refresh token vào Redis theo userId (để quản lý đa phiên)
    await redisClient.set(`refresh:${user._id}:${refreshToken}`, "valid", {
      EX: 60 * 60 * 24 * 7, // Hết hạn sau 7 ngày
    });
    // Lưu refresh token vào cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: false,
      domain: process.env.ADMIN_URL,
      sameSite: "Lax",
      maxAge: 12 * 60 * 60 * 1000,
    });

    res.status(200).json({ accessToken }); // Trả về access token cho client
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Đăng xuất người dùng (một phiên)
const logoutAdmin = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const refreshToken = req.cookies.refreshToken;

    if (!token || !refreshToken) {
      return res.status(400).json({ message: "Thiếu token" });
    }

    // Đưa access token vào blacklist để vô hiệu hóa
    const decoded = verifyToken(token);
    const exp = decoded?.exp;
    const ttl = exp - Math.floor(Date.now() / 1000); // Thời gian còn lại của token

    if (ttl > 0) {
      await redisClient.set(`blacklist:${token}`, "true", { EX: ttl });
    }

    // Xóa refresh token trong Redis
    const refreshPayload = verifyToken(refreshToken);
    const refreshKey = `refresh:${refreshPayload.id}:${refreshToken}`;

    await redisClient.del(refreshKey); // Xóa key của token cụ thể

    res.clearCookie("refreshAdminToken"); // Xóa cookie refresh token

    res.json({ message: "Đăng xuất thành công" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const refreshAccessAdminToken = async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) return res.status(403).json({ message: "No refresh token" });

  try {
    const payload = jwt.verify(refreshToken, publicKey, {
      algorithms: ["RS256"],
    });
    const key = `refresh:${payload.id}:${refreshToken}`;
    const exists = await redisClient.exists(key);
    if (!exists) {
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
      EX: 60 * 60 * 12, // 12 giờ
    });
    // ✅ Gửi refresh token mới vào cookie
    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: false,
      domain: process.env.ADMIN_URL,
      sameSite: "Lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    // ✅ Token hợp lệ → Xóa cái cũ
    await redisClient.del(key);

    res.status(200).json({ accessToken: newAccessToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};

module.exports = { loginAdmin, logoutAdmin, refreshAccessAdminToken };
