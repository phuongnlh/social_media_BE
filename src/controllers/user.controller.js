const User = require("../models/user.model");
const { genPwd, validatePwd } = require("../utils/pwd_utils");
const { signToken, verifyToken } = require("../utils/jwt_utils");
const {
  sendVerificationEmail,
  sendResetPasswordEmail,
} = require("../utils/email_utils");
const redisClient = require("../config/database.redis");

// Đăng ký tài khoản người dùng mới
const registerUser = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;
    // Kiểm tra email đã tồn tại hay chưa
    const checkUser = await User.findOne({ email });
    if (checkUser) {
      return res.status(400).json({ message: "Email đã được sử dụng" });
    }
    const username = `${Date.now()}`;
    // Tạo mật khẩu băm và muối
    const { hash, salt } = genPwd(password);
    // Tạo người dùng mới
    const newUser = await new User({ fullName, email, hash, salt, username }).save();
    // Tạo token xác thực email
    const token = signToken({ id: newUser._id }, "15m");

    // Gửi email xác thực tài khoản
    await sendVerificationEmail(email, token);

    res.status(201).json({
      message:
        "Registration successful! Please check your email to verify your account.",
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Xác thực email người dùng
const verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;
    // Giải mã token để lấy thông tin người dùng
    const payload = verifyToken(token);
    // Tìm người dùng từ ID trong token
    const user = await User.findById(payload.id);
    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    }
    if (user.EmailVerified) {
      return res
        .status(400)
        .json({ message: "Email đã được xác thực trước đó" });
    }
    // Cập nhật trạng thái xác thực email
    user.EmailVerified = true;
    await user.save();
    res.json({ message: "Email đã được xác thực thành công" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Đăng nhập người dùng
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;
    // Tìm người dùng theo email
    const user = await User.findOne({ email: email });
    if (!user) {
      return res
        .status(401)
        .json({ message: "Email hoặc mật khẩu không hợp lệ!" });
    }

    // Kiểm tra email đã được xác thực chưa
    if (!user.EmailVerified) {
      return res
        .status(403)
        .json({ message: "Vui lòng xác thực email của bạn." });
    }

    // Kiểm tra mật khẩu
    if (!validatePwd(password, user.hash, user.salt)) {
      return res
        .status(401)
        .json({ message: "Email hoặc mật khẩu không hợp lệ!" });
    }

    // Tạo access token và refresh token
    const accessToken = signToken({ id: user._id }, "15m");
    const refreshToken = signToken({ id: user._id }, "7d");

    // Lưu refresh token vào Redis theo userId (để quản lý đa phiên)
    await redisClient.set(`refresh:${user._id}:${refreshToken}`, "valid", {
      EX: 60 * 60 * 24 * 7, // Hết hạn sau 7 ngày
    });
    // Thêm refresh token vào danh sách phiên của người dùng
    const userRefreshTokensSet = `user-sessions:${user._id}`;
    await redisClient.sAdd(userRefreshTokensSet, refreshToken);
    // Lưu refresh token vào cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    // Trả về access token cho client
    res.status(200).json({ accessToken });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Đăng xuất người dùng (một phiên)
const logoutUser = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const refreshToken = req.cookies.refreshToken;

    if (!token || !refreshToken) {
      return res.status(400).json({ message: "Thiếu token" });
    }

    // Đưa access token vào blacklist để vô hiệu hóa
    const decoded = verifyToken(token);
    const exp = decoded?.exp;
    const now = Math.floor(Date.now() / 1000);
    const ttl = exp - now; // Thời gian còn lại của token

    if (ttl > 0) {
      await redisClient.set(`blacklist:${token}`, "true", { EX: ttl });
    }

    // Xóa refresh token trong Redis
    const refreshPayload = verifyToken(refreshToken);
    const refreshKey = `refresh:${refreshPayload.id}:${refreshToken}`;
    const userRefreshTokensSet = `user-sessions:${refreshPayload.id}`;

    // Dùng multi để đảm bảo cả hai lệnh cùng được thực thi
    const multi = redisClient.multi();
    multi.del(refreshKey); // Xóa key của token cụ thể
    multi.sRem(userRefreshTokensSet, refreshToken); // Xóa token khỏi Set các phiên
    await multi.exec();

    // Xóa cookie refresh token
    res.clearCookie("refreshToken", { path: "/" });

    res.json({ message: "Đăng xuất thành công" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Đăng xuất tất cả các phiên của người dùng
const logoutAllUser = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const refreshToken = req.cookies.refreshToken;

    if (!token || !refreshToken) {
      return res.status(400).json({ message: "Thiếu token" });
    }

    // Đưa accessToken hiện tại vào blacklist
    const decoded = verifyToken(token);
    const exp = decoded?.exp;
    const now = Math.floor(Date.now() / 1000);
    const ttl = exp - now;

    if (ttl > 0) {
      await redisClient.set(`blacklist:${token}`, "true", { EX: ttl });
    }

    // Xóa tất cả refreshToken của user trong Redis
    const refreshPayload = verifyToken(refreshToken);
    const userId = refreshPayload.id;
    // Lấy tất cả các token refresh của người dùng
    const userRefreshTokensSet = `user-sessions:${userId}`;
    const allTokens = await redisClient.sMembers(userRefreshTokensSet);
    if (allTokens.length > 0) {
      // Dùng multi để thực hiện nhiều lệnh cùng lúc
      const multi = redisClient.multi();
      // Xóa từng token một
      allTokens.forEach((token) => {
        multi.del(`refresh:${userId}:${token}`);
      });
      multi.del(userRefreshTokensSet); // Xóa toàn bộ set chứa các token
      await multi.exec();
    }

    // Xóa cookie
    res.clearCookie("refreshToken", { path: "/api/v1/" });

    res.json({ message: "Đã đăng xuất tất cả các phiên thành công" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Thay đổi mật khẩu
const changePassword = async (req, res) => {
  try {
    const userId = req.user._id; // Đã được xác thực từ middleware
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: "Thiếu trường mật khẩu" });
    }

    // Tìm người dùng theo ID
    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ message: "Không tìm thấy người dùng" });

    // Kiểm tra mật khẩu cũ
    const isValid = validatePwd(oldPassword, user.hash, user.salt);
    if (!isValid) {
      return res.status(401).json({ message: "Mật khẩu cũ không chính xác" });
    }

    // Tạo hash mới từ mật khẩu mới
    const { hash, salt } = genPwd(newPassword);
    user.hash = hash;
    user.salt = salt;
    await user.save();

    // Đăng xuất tất cả phiên hiện tại (vô hiệu hóa tất cả token)
    const userRefreshTokensSet = `user-sessions:${user._id}`;
    const allTokens = await redisClient.sMembers(userRefreshTokensSet);
    if (allTokens.length > 0) {
      const multi = redisClient.multi();
      allTokens.forEach((token) => {
        multi.del(`refresh:${user._id}:${token}`);
      });
      multi.del(userRefreshTokensSet);
      await multi.exec();
    }

    // Xóa cookie của phiên hiện tại
    res.clearCookie("refreshToken", { path: "/api/v1/" });

    res.json({ message: "Mật khẩu đã được thay đổi thành công" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Yêu cầu khôi phục mật khẩu
const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    // Tìm người dùng theo email
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Không tìm thấy email" });

    // Tạo token khôi phục mật khẩu
    const resetToken = signToken({ id: user._id }, "15m");

    // Tạo liên kết khôi phục mật khẩu
    const resetLink = `${process.env.BASE_URL}:${process.env.PORT}/api/v1/user/reset-password?token=${resetToken}`;
    // Gửi email khôi phục mật khẩu
    await sendResetPasswordEmail(user.email, resetLink);

    res.json({ message: "Liên kết đặt lại mật khẩu đã được gửi đến email" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Đặt lại mật khẩu với token
const resetPassword = async (req, res) => {
  const { token } = req.query;
  const { newPassword } = req.body;

  try {
    // Xác thực token
    const decoded = verifyToken(token);
    // Tìm người dùng từ ID trong token
    const user = await User.findById(decoded.id);

    if (!user)
      return res.status(400).json({ message: "Không tìm thấy người dùng" });

    // Tạo hash mới cho mật khẩu mới
    const { hash, salt } = genPwd(newPassword);
    user.hash = hash;
    user.salt = salt;
    await user.save();

    res.json({ message: "Đặt lại mật khẩu thành công" });
  } catch (err) {
    // Nếu lỗi là do token không hợp lệ hoặc hết hạn
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
      return res
        .status(401)
        .json({ message: "Token không hợp lệ hoặc đã hết hạn" });
    }
    // Các lỗi khác là lỗi server
    console.error(err); // Ghi lại lỗi để debug
    return res.status(500).json({ message: "Đã xảy ra lỗi từ máy chủ." });
  }
};

const getUser = async (req, res) => {
  const userId = req.user._id; // Đã được xác thực từ middleware
  try {
    const user = await User.findById(userId).select("-hash -salt -isDeleted");
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getUserById = async (req, res) => {
  const userId = req.params.userId;
  console.log("Get user by id: ", userId);
  try {
    const user = await User.findById(userId).select("-hash -salt -isDeleted");
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
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
  getUser,
  getUserById
};
