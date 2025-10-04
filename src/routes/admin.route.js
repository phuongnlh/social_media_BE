const express = require("express");
const {
  getAllUsers,
  getUserById,
  updateUserStatus,
  getPlatformStatistics,
  getTopPosters,
} = require("../controllers/admin.controller");
const {
  getAnalytics,
  getPostStats,
  getUserGrowth,
  getDailyInteractions,
} = require("../controllers/ADMIN/dashboard.controller");
const {
  refreshAccessAdminToken,
  loginAdmin,
  logoutAdmin,
} = require("../controllers/ADMIN/authAdmin.controller");
const { isAdmin, isLogin } = require("../middlewares/auth");

const router = express.Router();

// Admin authentication
router.post("/login", loginAdmin);
router.post("/logout", isAdmin, logoutAdmin);
router.post("/refresh", refreshAccessAdminToken);
router.get("/me", isLogin, isAdmin, async (req, res) => {
  res.json(req.user);
});

// User management routes
router.get("/users", getAllUsers);
router.get("/users/:userId", getUserById);
router.patch("/users/:userId/status", updateUserStatus);

// Platform statistics
router.get("/statistics", getPlatformStatistics);
router.get("/top-posters", getTopPosters);

router.get("/dashboard/post-stats", getPostStats);
router.get("/dashboard/user-growth", getUserGrowth);
router.get("/dashboard/daily-interactions", getDailyInteractions);
router.get("/dashboard", getAnalytics);

module.exports = router;
