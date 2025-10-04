const User = require("../models/user.model");
const { genPwd, validatePwd } = require("../utils/pwd_utils");
const { signToken, verifyToken } = require("../utils/jwt_utils");
const {
  sendVerificationEmail,
  sendResetPasswordEmail,
} = require("../utils/email_utils");
const redisClient = require("../config/database.redis");
const UserSetting = require("../models/user_settings.model");
const Friendship = require("../models/friendship.model");
const speakeasy = require("speakeasy");
const qrcode = require("qrcode");
const { default: mongoose } = require("mongoose");
// Đăng ký tài khoản người dùng mới
const registerUser = async (req, res) => {
  try {
    const { fullName, email, password, gender, dateOfBirth } = req.body;
    // Kiểm tra email đã tồn tại hay chưa
    const checkUser = await User.findOne({ email });
    if (checkUser) {
      return res.status(400).json({ message: "Email already exists." });
    }
    const username = `${Date.now()}`;
    // Tạo mật khẩu băm và muối
    const { hash, salt } = genPwd(password);
    // Tạo người dùng mới
    const newUser = await new User({
      fullName,
      email,
      hash,
      salt,
      username,
      gender,
      dateOfBirth,
    }).save();
    // Tạo token xác thực email
    const token = signToken({ id: newUser._id }, "15m");

    // Gửi email xác thực tài khoản
    const result = await sendVerificationEmail(email, token);
    if (!result) {
      await User.findByIdAndDelete(newUser._id);
      throw new Error("Failed to send verification email.");
    }

    res.status(201).json({
      message:
        "Registration successful! Please check your email to verify your account.",
    });
  } catch (err) {
    return res.status(500).json({ message: "Internal server error." });
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
    await createPrivacyDefault(user._id);
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
        .status(403)
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
        .status(403)
        .json({ message: "Email hoặc mật khẩu không hợp lệ!" });
    }

    if (user.twoFAEnabled) {
      // Yêu cầu nhập mã OTP
      return res.status(200).json({ require2FA: true, userId: user._id });
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
    const ttl = exp - Math.floor(Date.now() / 1000); // Thời gian còn lại của token

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
    res.clearCookie("refreshToken");

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
    res.clearCookie("refreshToken");

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
      return res
        .status(400)
        .json({ success: false, message: "Missing password fields" });
    }

    // Tìm người dùng theo ID
    const user = await User.findById(userId);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    // Kiểm tra mật khẩu cũ
    const isValid = validatePwd(oldPassword, user.hash, user.salt);
    if (!isValid) {
      return res
        .status(401)
        .json({ success: false, message: "Old password is incorrect" });
    }

    // Tạo hash mới từ mật khẩu mới
    const { hash, salt } = genPwd(newPassword);
    user.hash = hash;
    user.salt = salt;
    await user.save();

    const token = req.headers.authorization?.split(" ")[1];
    const decoded = verifyToken(token);
    const exp = decoded?.exp;
    const ttl = exp - Math.floor(Date.now() / 1000); // Thời gian còn lại của token

    if (ttl > 0) {
      await redisClient.set(`blacklist:${token}`, "true", { EX: ttl });
    }
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
    res.clearCookie("refreshToken");

    res.json({
      success: true,
      message: "Password changed successfully. Please log in again.",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
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

    res.status(200).json({ message: "Đặt lại mật khẩu thành công" });
  } catch (err) {
    // Nếu lỗi là do token không hợp lệ hoặc hết hạn
    // if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    //   return res
    //     .status(401)
    //     .json({ message: "Token không hợp lệ hoặc đã hết hạn" });
    // }
    // Các lỗi khác là lỗi server
    console.error(err); // Ghi lại lỗi để debug
    return res.status(500).json({ message: "Đã xảy ra lỗi từ máy chủ." });
  }
};

const getUser = async (req, res) => {
  const userId = req.user._id; // Đã được xác thực từ middleware
  try {
    const user = await User.findById(userId).select(
      "-hash -salt -isDeleted -twoFASecret"
    );
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getUserById = async (req, res) => {
  const userId = req.params.userId;
  try {
    const user = await User.findById(userId).select(
      "-hash -salt -isDeleted -twoFASecret"
    );
    res.status(200).json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Controller upload avatar
const uploadUserAvatar = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ message: "Không có file nào được tải lên" });
    }

    // Cập nhật thông tin user với avatar URL mới
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatar_url: req.file.path || req.file.secure_url },
      { new: true }
    );

    return res.status(200).json({
      message: "Cập nhật avatar thành công",
      avatar_url: req.file.path || req.file.secure_url,
    });
  } catch (error) {
    console.error("Lỗi tải lên avatar:", error);
    return res.status(500).json({ message: "Lỗi server" });
  }
};
const uploadBackgroundProfile = async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ message: "Không có file nào được tải lên" });
    }

    // Cập nhật thông tin user với background URL mới
    const user = await User.findByIdAndUpdate(
      req.user._id,
      { cover_photo_url: req.file.path || req.file.secure_url },
      { new: true }
    );

    return res.status(200).json({
      message: "Cập nhật background thành công",
      cover_photo_url: req.file.path || req.file.secure_url,
    });
  } catch (error) {
    console.error("Lỗi tải lên background:", error);
    return res.status(500).json({ message: "Lỗi server" });
  }
};
const UpdateDataProfile = async (req, res) => {
  const userId = req.user._id;
  const { username, fullName, email, bio, phone } = req.body;
  if (!/^\d{10,12}$/.test(phone)) {
    return res.status(400).json({ message: "Số điện thoại không hợp lệ" });
  }
  try {
    await User.findByIdAndUpdate(
      userId,
      { username, fullName, email, bio, phone },
      { new: true }
    );

    res.status(200).json({
      message: "Cập nhật thông tin cá nhân thành công",
    });
  } catch (error) {
    console.error("Lỗi cập nhật thông tin cá nhân:", error);
    res.status(500).json({ message: "Lỗi server" });
  }
};
const getUserPrivacy = async (req, res) => {
  const userId = req.user._id;
  try {
    const privacySetting = await UserSetting.find({ user_id: userId });
    res.status(200).json({
      message: "Lấy cài đặt quyền riêng tư thành công",
      data: privacySetting,
    });
  } catch (error) {
    console.error("Lỗi lấy cài đặt quyền riêng tư:", error);
    res.status(500).json({ message: error });
  }
};
const createPrivacyDefault = async (userId) => {
  const defaultSettings = [
    { user_id: userId, key: "profile", privacy_level: "public" },
    { user_id: userId, key: "profile.email", privacy_level: "public" },
    { user_id: userId, key: "profile.post", privacy_level: "public" },
    { user_id: userId, key: "profile.photo", privacy_level: "public" },
    { user_id: userId, key: "profile.video", privacy_level: "public" },
    { user_id: userId, key: "profile.friend", privacy_level: "public" },
    { user_id: userId, key: "profile.group", privacy_level: "public" },
  ];

  try {
    await UserSetting.insertMany(defaultSettings);
  } catch (error) {
    console.error("Lỗi tạo cài đặt quyền riêng tư mặc định:", error);
  }
};
const updateMultiPrivacySetting = async (req, res) => {
  const userId = req.user._id;
  const { settings } = req.body; // [{ key, privacy_level, custom_group }]

  if (!Array.isArray(settings)) {
    return res.status(400).json({ message: "settings phải là một mảng" });
  }

  // Chỉ cho phép các key hợp lệ
  const allowedKeys = [
    "profile",
    "profile.email",
    "profile.post",
    "profile.photo",
    "profile.video",
    "profile.friend",
    "profile.group",
  ];

  try {
    const bulkOps = settings
      .filter(({ key }) => allowedKeys.includes(key))
      .map(({ key, privacy_level }) => ({
        updateOne: {
          filter: { user_id: userId, key },
          update: { privacy_level },
          upsert: true,
        },
      }));

    if (bulkOps.length === 0) {
      return res
        .status(400)
        .json({ message: "Không có key hợp lệ để cập nhật" });
    }

    await UserSetting.bulkWrite(bulkOps);

    res.json({ message: "Cập nhật quyền riêng tư thành công" });
  } catch (error) {
    console.error("Lỗi cập nhật quyền riêng tư:", error);
    res.status(500).json({ message: "Lỗi server" });
  }
};
async function isFriend(userA, userB) {
  if (!userA || !userB) return false;
  const friendship = await Friendship.findOne({
    $or: [
      { user_id_1: userA, user_id_2: userB },
      { user_id_1: userB, user_id_2: userA },
    ],
    status: "accepted",
  });
  return !!friendship;
}
const getProfileWithPrivacy = async (req, res) => {
  const viewerId = req.user?._id;
  const profileUserId = req.params.userId;

  try {
    let query = [{ username: profileUserId }];

    // Nếu là ObjectId hợp lệ thì thêm vào query
    if (mongoose.Types.ObjectId.isValid(profileUserId)) {
      query.unshift({ _id: profileUserId });
    }

    const user = await User.findOne({ $or: query }).select(
      "-hash -salt -isDeleted -twoFASecret"
    );
    if (!user)
      return res.status(404).json({ message: "Không tìm thấy người dùng" });

    const settingsArr = await UserSetting.find({ user_id: profileUserId });
    const privacyMap = {};
    settingsArr.forEach((s) => {
      privacyMap[s.key] = s.privacy_level;
    });

    // Hàm kiểm tra quyền truy cập từng trường/tab
    const canView = async (key) => {
      const level = privacyMap[key] || "public";
      if (level === "public") return true;
      if (level === "private") return false;
      if (level === "friends") {
        if (!viewerId) return false;
        if (viewerId.toString() === profileUserId.toString()) return true;
        return await isFriend(viewerId, profileUserId);
      }
      return false;
    };

    // Nếu profile là private thì ẩn hết các trường nhạy cảm và tab
    if (privacyMap["profile"] === "private") {
      return res.json({
        profile: {
          _id: user._id,
          username: user.username,
          fullName: user.fullName,
          avatar_url: user.avatar_url,
          cover_photo_url: user.cover_photo_url,
          bio: null,
          email: null,
        },
        canViewPosts: false,
        canViewPhotos: false,
        canViewVideos: false,
        canViewFriends: false,
        canViewGroups: false,
        privacy: privacyMap,
      });
    }
    if (privacyMap["profile"] === "friends") {
      // Nếu profile là friends thì chỉ cho phép xem các trường/tab nếu là bạn bè
      const bool = await isFriend(viewerId, profileUserId);
      if (!bool) {
        return res.json({
          profile: {
            _id: user._id,
            username: user.username,
            fullName: user.fullName,
            avatar_url: user.avatar_url,
            cover_photo_url: user.cover_photo_url,
            bio: null,
            email: null,
          },
          canViewPosts: false,
          canViewPhotos: false,
          canViewVideos: false,
          canViewFriends: false,
          canViewGroups: false,
          privacy: privacyMap,
        });
      }
    }

    // Nếu profile là public hoặc friends thì các trường/tab sẽ xét quyền riêng
    const [
      canViewPosts,
      canViewPhotos,
      canViewVideos,
      canViewFriends,
      canViewGroups,
    ] = await Promise.all([
      canView("profile.post"),
      canView("profile.photo"),
      canView("profile.video"),
      canView("profile.friend"),
      canView("profile.group"),
    ]);

    const profileData = {
      _id: user._id,
      username: user.username,
      fullName: user.fullName,
      avatar_url: user.avatar_url,
      cover_photo_url: user.cover_photo_url,
      bio: (await canView("profile")) ? user.bio : null,
      email: (await canView("profile.email")) ? user.email : null,
    };

    res.json({
      profile: profileData,
      canViewPosts,
      canViewPhotos,
      canViewVideos,
      canViewFriends,
      canViewGroups,
      privacy: privacyMap,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const generateTwoFASecret = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    const secret = speakeasy.generateSecret({
      name: "MySocialApp",
      length: 20,
    });
    await User.findByIdAndUpdate(userId, {
      twoFASecret: secret.base32,
    });
    const qr = await qrcode.toDataURL(secret.otpauth_url);
    return res.status(200).json({ qr });
  } catch (error) {
    console.error("Lỗi kích hoạt 2FA:", error);
    return res.status(500).json({ message: "Lỗi server" });
  }
};

const enableTwoFA = async (req, res) => {
  try {
    const userId = req.user._id;
    const { token } = req.body;
    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    if (user.twoFAEnabled)
      return res.status(400).json({ message: "Đã kích hoạt 2FA" });
    const verified = speakeasy.totp.verify({
      secret: user.twoFASecret,
      encoding: "base32",
      token,
      window: 1,
    });
    if (verified) {
      await User.findByIdAndUpdate(userId, { twoFAEnabled: true });
      return res.status(200).json({ message: "Xây dựng 2FA thành công" });
    } else {
      return res.status(400).json({ message: "Token không hợp lệ" });
    }
  } catch (error) {
    console.error("Lỗi kích hoạt 2FA:", error);
    return res.status(500).json({ message: "Lỗi server" });
  }
};

const verifyTwoFA = async (req, res) => {
  try {
    const userId = req.user._id;
    const { token } = req.body;
    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    if (!user.twoFAEnabled)
      return res.status(400).json({ message: "Chua kích hoạt 2FA" });
    const verified = speakeasy.totp.verify({
      secret: user.twoFASecret,
      encoding: "base32",
      token,
      window: 1,
    });
    if (verified) {
      await User.findByIdAndUpdate(userId, { twoFAEnabled: true });
      return res.status(200).json({ message: "Kích hoạt 2FA thành công" });
    } else {
      return res.status(400).json({ message: "Mã xác thực 2FA không hợp lệ" });
    }
  } catch (error) {
    console.error("Lỗi kích hoạt 2FA:", error);
    return res.status(500).json({ message: "Lỗi server" });
  }
};

const verifyTwoFALogin = async (req, res) => {
  try {
    const { userId, code } = req.body;
    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    if (!user.twoFAEnabled)
      return res.status(400).json({ message: "Chua kích hoạt 2FA" });
    const verified = speakeasy.totp.verify({
      secret: user.twoFASecret,
      encoding: "base32",
      token: code,
      window: 1,
    });
    if (verified) {
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
    } else {
      return res.status(400).json({ message: "Mã xác thực 2FA không hợp lệ" });
    }
  } catch (error) {
    console.error("Lỗi kích hoạt 2FA:", error);
    return res.status(500).json({ message: "Lỗi server" });
  }
};

const disableTwoFA = async (req, res) => {
  try {
    const userId = req.user._id;
    const { token } = req.body;
    const user = await User.findById(userId);
    if (!user)
      return res.status(404).json({ message: "Không tìm thấy người dùng" });
    if (!user.twoFAEnabled)
      return res.status(400).json({ message: "Chua kích hoạt 2FA" });
    const verified = speakeasy.totp.verify({
      secret: user.twoFASecret,
      encoding: "base32",
      token,
      window: 1,
    });
    if (verified) {
      await User.findByIdAndUpdate(userId, { twoFAEnabled: false });
      return res.status(200).json({ message: "Tắt 2FA thành công" });
    } else {
      return res.status(400).json({ message: "Mã xác thức 2FA không hợp lệ" });
    }
  } catch (error) {
    console.error("Lỗi tắt 2FA:", error);
    return res.status(500).json({ message: "Lỗi server" });
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
  uploadUserAvatar,
  uploadBackgroundProfile,
  UpdateDataProfile,
  getUserPrivacy,
  createPrivacyDefault,
  updateMultiPrivacySetting,
  getUserById,
  getProfileWithPrivacy,
  generateTwoFASecret,
  enableTwoFA,
  verifyTwoFA,
  disableTwoFA,
  verifyTwoFALogin,
};
