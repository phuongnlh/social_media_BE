const passport = require("../config/passport");
const redisClient = require("../config/database.redis");

const authenticate = () => async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];
  if (!token) return res.status(401).json({ message: "No token provided" });

  // ⚠️ Kiểm tra blacklist trước khi kiểm tra token hợp lệ
  const isBlacklisted = await redisClient.get(`blacklist:${token}`);
  if (isBlacklisted) {
    return res.status(401).json({ message: "Token has been revoked (logout)" });
  }

  passport.authenticate("jwt", { session: false }, (err, user) => {
    if (err || !user) {
      return res
        .status(err ? 500 : 401)
        .json({ message: err ? "Internal Server Error" : "Unauthorized" });
    }
    if (user.isBlocked) {
      return res.status(403).json({ message: "Your account has been blocked" });
    }
    if (user.is_deleted) {
      return res.status(403).json({ message: "Your account has been deleted" });
    }
    if (!user.EmailVerified) {
      // ✅ Check nếu chưa verify email
      return res.status(403).json({ message: "Please verify your email." });
    }

    req.user = user;
    next();
  })(req, res, next);
};

const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  if (req.user.role !== "admin" && req.user.role !== "super_admin") {
    return res.status(403).json({ message: "You are not an admin" });
  }

  next();
};

const isLogin = authenticate();

module.exports = { isLogin, isAdmin };
