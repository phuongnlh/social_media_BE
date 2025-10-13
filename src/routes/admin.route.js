const express = require("express");
const {
  getAllUsers,
  getUserById,
  updateUserStatus,
  getPlatformStatistics,
  getTopPosters,
} = require("../controllers/ADMIN/admin.controller");
const {
  getAnalytics,
  getPostStats,
  getUserGrowth,
  getDailyInteractions,
} = require("../controllers/ADMIN/dashboard.controller");
const { refreshAccessAdminToken, loginAdmin, logoutAdmin } = require("../controllers/ADMIN/authAdmin.controller");
const { isAdmin, isLogin } = require("../middlewares/auth");
const reportController = require("../controllers/ADMIN/report.controller");
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

//*==============================================================
//*=================== ADMIN ROUTES (REPORTS) ===================
//*==============================================================
router.get("/reports", isLogin, isAdmin, reportController.getReports);
router.get("/reports/stats", isLogin, isAdmin, reportController.getReportStats);
router.get("/reports/:id", isLogin, isAdmin, reportController.getReportById); // Lấy chi tiết báo cáo (Admin)
router.patch("/reports/:id/status", isLogin, isAdmin, reportController.updateReportStatus); // Cập nhật trạng thái báo cáo (Admin)
router.patch("/reports/:id/assign", isLogin, isAdmin, reportController.assignReport); // Gán báo cáo cho admin (Admin)
router.post("/reports/:id/notes", isLogin, isAdmin, reportController.addAdminNote); // Thêm ghi chú admin (Admin)
router.patch("/reports/:id/resolve", isLogin, isAdmin, reportController.resolveReport); // Giải quyết báo cáo (Admin)
router.patch("/reports/bulk-update", isLogin, isAdmin, reportController.bulkUpdateReports); // Bulk update báo cáo (Admin)

module.exports = router;
