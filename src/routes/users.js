const express = require("express");
const router = express.Router();
const UserController = require("../controllers/user.controller");
const { uploadAvatar} = require("../utils/upload_utils");

const { isLogin } = require("../middlewares/auth");

router.post("/register", UserController.registerUser);
router.post("/login", UserController.loginUser);
router.get("/verify-email", UserController.verifyEmail);
router.post("/logout", isLogin, UserController.logoutUser);
router.post("/logout-all", isLogin, UserController.logoutAllUser);
router.post("/change-password", isLogin, UserController.changePassword);
router.post("/forgot-password", UserController.forgotPassword);
router.post("/reset-password", UserController.resetPassword);

router.get("/baseUser", isLogin, UserController.getUser);

router.post("/avatar", isLogin, uploadAvatar.single("file"), UserController.uploadUserAvatar);
router.post("/background", isLogin, uploadAvatar.single("file"), UserController.uploadBackgroundProfile);
router.put("/profile", isLogin, UserController.UpdateDataProfile);
router.put("/privacy", isLogin, UserController.PrivacySetting);
router.get("/privacy", isLogin, UserController.getUserPrivacy);
router.put("/privacy-multi", isLogin, UserController.updateMultiPrivacySetting);

router.get("/", isLogin, (req, res) => {
  res.json(req.user);
});

module.exports = router;
