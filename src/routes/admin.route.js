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
const reportController = require("../controllers/report.controller");
const { param } = require("express-validator");
const {
  validateListQuery,
  validateUpdateStatus,
  validateAssignReport,
  validateAddNote,
  validateResolveReport,
  validateBulkUpdate,
} = require("../utils/validate");
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

// ================== ADMIN ROUTES ==================
router.get(
  "/reports",
  isLogin,
  isAdmin,
  validateListQuery,
  reportController.getReports
);
router.get(
  "/reports/stats",
  isLogin,
  isAdmin,
  validateListQuery,
  reportController.getReportStats
);
// Lấy chi tiết báo cáo (Admin)
router.get(
  "/reports/:id",
  isLogin,
  isAdmin,
  param("id").isMongoId().withMessage("Invalid report ID format"),
  reportController.getReportById
);

// Cập nhật trạng thái báo cáo (Admin)
router.patch(
  "/reports/:id/status",
  isLogin,
  isAdmin,
  validateUpdateStatus,
  reportController.updateReportStatus
);

// Gán báo cáo cho admin (Admin)
router.patch(
  "/reports/:id/assign",
  isLogin,
  isAdmin,
  validateAssignReport,
  reportController.assignReport
);

// Thêm ghi chú admin (Admin)
router.post(
  "/reports/:id/notes",
  isLogin,
  isAdmin,
  validateAddNote,
  reportController.addAdminNote
);

// Giải quyết báo cáo (Admin)
router.patch(
  "/reports/:id/resolve",
  isLogin,
  isAdmin,
  validateResolveReport,
  reportController.resolveReport
);

// Bulk update báo cáo (Admin)
router.patch(
  "/reports/bulk-update",
  isLogin,
  isAdmin,
  validateBulkUpdate,
  reportController.bulkUpdateReports
);

module.exports = router;
