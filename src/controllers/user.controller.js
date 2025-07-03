const User = require("../models/user.model");
const { genPwd, validatePwd } = require("../utils/pwd_utils");
const { signToken } = require("../utils/jwt_utils");
const { sendVerificationEmail, sendResetPasswordEmail } = require("../utils/email_utils");
const jwt = require("jsonwebtoken");
const redisClient = require("../config/database.redis");
const publicKey = require("fs").readFileSync(
  "./src/config/public_key.pem",
  "utf-8"
);
const registerUser = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const checkUser = await User.findOne({ email });
    if (checkUser) {
      return res.status(400).json({ message: "User already exists" });
    }
    const { hash, salt } = genPwd(password);
    const newUser = await new User({ username, email, hash, salt }).save();
    const token = signToken({ id: newUser._id }, "15m");

    await sendVerificationEmail(email, token);

    res
      .status(201)
      .json({ message: "User created. Please verify your email." });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    const payload = jwt.verify(token, publicKey, {
      algorithms: ["RS256"],
    });
    const user = await User.findById(payload.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (user.EmailVerified) {
      return res.status(400).json({ message: "Email already verified" });
    }
    user.EmailVerified = true;
    await user.save();
    res.json({ message: "Email verified successfully" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email: email });
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password!" });
    }

    if (!user.EmailVerified) {
      return res.status(403).json({ message: "Please verify your email." });
    }

    if (!validatePwd(password, user.hash, user.salt)) {
      return res.status(401).json({ message: "Invalid email or password!" });
    }

    const accessToken = signToken({ id: user._id }, "15m");
    const refreshToken = signToken({ id: user._id }, "7d");

    // Lưu refresh token vào Redis theo userId (để quản lý đa phiên)
    await redisClient.set(`refresh:${user._id}:${refreshToken}`, "valid", {
      EX: 60 * 60 * 24 * 7,
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      path: "/api/v1/refresh",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.status(200).json({ accessToken });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

const logoutUser = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const refreshToken = req.cookies.refreshToken;

    if (!token || !refreshToken) {
      return res.status(400).json({ message: "Missing token(s)" });
    }

    // ✅ Đưa access token vào blacklist
    const decoded = jwt.decode(token);
    const exp = decoded?.exp;
    const now = Math.floor(Date.now() / 1000);
    const ttl = exp - now;

    if (ttl > 0) {
      await redisClient.set(`blacklist:${token}`, "true", { EX: ttl });
    }

    // ✅ Xóa refresh token trong Redis
    const refreshPayload = jwt.decode(refreshToken);
    const refreshKey = `refresh:${refreshPayload.id}:${refreshToken}`;
    await redisClient.del(refreshKey);

    // ✅ Xóa cookie
    res.clearCookie("refreshToken", { path: "/api/v1/refresh" });

    res.json({ message: "Logout successful" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const logoutAllUser = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const refreshToken = req.cookies.refreshToken;

    if (!token || !refreshToken) {
      return res.status(400).json({ message: "Missing token(s)" });
    }

    // ✅ Đưa accessToken hiện tại vào blacklist
    const decoded = jwt.verify(token);
    const exp = decoded?.exp;
    const now = Math.floor(Date.now() / 1000);
    const ttl = exp - now;

    if (ttl > 0) {
      await redisClient.set(`blacklist:${token}`, "true", { EX: ttl });
    }

    // ✅ Xoá tất cả refreshToken của user trong Redis
    const refreshPayload = jwt.decode(refreshToken);
    const userId = refreshPayload.id;

    // Lấy tất cả các key refresh của user
    const keys = await redisClient.keys(`refresh:${userId}:*`);
    if (keys.length > 0) {
      await Promise.all(keys.map((key) => redisClient.del(key)));
    }

    // ✅ Xoá cookie
    res.clearCookie("refreshToken", { path: "/api/v1/refresh" });

    res.json({ message: "Logout all sessions successful" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const userId = req.user._id; // Đã được xác thực từ middleware
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "Missing password fields" });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Kiểm tra mật khẩu cũ
    const isValid = validatePwd(oldPassword, user.hash, user.salt);
    if (!isValid) {
      return res.status(401).json({ message: "Old password is incorrect" });
    }

    // Tạo hash mới từ mật khẩu mới
    const { hash, salt } = genPwd(newPassword);
    user.hash = hash;
    user.salt = salt;
    await user.save();

    res.json({ message: "Password changed successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Email not found" });

    const resetToken = signToken({ id: user._id }, "15m");

    const resetLink = `${process.env.BASE_URL}:${process.env.PORT}/api/v1/user/reset-password?token=${resetToken}`;
    await sendResetPasswordEmail(user.email, resetLink);

    res.json({ message: "Reset password link sent to email" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const resetPassword = async (req, res) => {
  const { token } = req.query;
  const { newPassword } = req.body;

  try {
    const decoded = jwt.verify(token, publicKey, {
      algorithms: ["RS256"],
    });
    const user = await User.findById(decoded.id);

    if (!user) return res.status(400).json({ message: "User not found" });

    const { hash, salt } = genPwd(newPassword);
    user.hash = hash;
    user.salt = salt;
    await user.save();

    res.json({ message: "Password reset successful" });
  } catch (err) {
    res.status(400).json({ message: "Invalid or expired token" });
  }
};

module.exports = {
  registerUser,
  verifyEmail,
  loginUser,
  logoutUser,
  logoutAllUser,
  changePassword,
  forgotPassword,
  resetPassword,
};
