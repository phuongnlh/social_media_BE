const express = require("express");
const router = express.Router();
const UserController = require("../controllers/user.controller");

const { isLogin } = require("../middlewares/auth");

router.post("/register", UserController.registerUser);
router.post("/login", UserController.loginUser);
router.get("/verify-email", UserController.verifyEmail);
router.post("/logout", isLogin, UserController.logoutUser);
router.post("/logout-all", isLogin, UserController.logoutAllUser);
router.post("/change-password", isLogin, UserController.changePassword);
router.post("/forgot-password", UserController.forgotPassword);
router.post("/reset-password", UserController.resetPassword);

router.get("/", isLogin, (req, res) => {
  res.json(req.user);
});

module.exports = router;
