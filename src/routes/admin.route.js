const express = require("express");
const {
  getAllUsers,
  getUserById,
  deleteUserById,
  updateUserStatus,
  getPlatformStatistics,
  getTopPosters,
} = require("../controllers/ADMIN/admin.controller");
const {
  getAnalytics,
  getPostStats,
  getUserGrowth,
  getDailyInteractions,
  getPaymentAnalytics,
  getPaymentSummary,
  getPaymentMethodStats,
} = require("../controllers/ADMIN/dashboard.controller");
const postController = require("../controllers/ADMIN/postManagement");
const emailTemplateController = require("../controllers/ADMIN/emailTemplate.controller");
const { refreshAccessAdminToken, loginAdmin, logoutAdmin } = require("../controllers/ADMIN/authAdmin.controller");
const { isAdmin } = require("../middlewares/auth");
const groupAdminController = require("../controllers/ADMIN/groupAdmin.controller");
const adsAdminController = require("../controllers/ADMIN/adsAdmin.controller");
const minioClient = require("../config/minioClient.storage");
const router = express.Router();

// Admin authentication
router.post("/login", loginAdmin);
router.post("/logout", isAdmin, logoutAdmin);
router.post("/refresh", refreshAccessAdminToken);
router.get("/me", isAdmin, async (req, res) => {
  res.json(req.user);
});

// User management routes
router.get("/users", isAdmin, getAllUsers);
router.get("/users/:userId", getUserById);
router.delete("/users/:userId", deleteUserById);
router.patch("/users/:userId/status", updateUserStatus);

// Platform statistics
router.get("/statistics", getPlatformStatistics);
router.get("/top-posters", getTopPosters);

router.get("/dashboard/post-stats", getPostStats);
router.get("/dashboard/user-growth", getUserGrowth);
router.get("/dashboard/daily-interactions", getDailyInteractions);
router.get("/dashboard", getAnalytics);
router.get('/dashboard/payment-analytics', getPaymentAnalytics);
router.get('/dashboard/payment-summary', getPaymentSummary);
router.get('/dashboard/payment-method-stats', getPaymentMethodStats);

router.post("/upload/update", isAdmin, async (req, res) => {
  const { oldFilePath } = req.body;

  try {
    const url = await minioClient.presignedPutObject("dailyvibe", oldFilePath, 60 * 60);

    const publicUrl = `https://minio.dailyvibe.online/dailyvibe/${oldFilePath}`;
    res.json({ url, publicUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Cannot generate presigned URL" });
  }
});

//*==============================================================
//*================== ADMIN EMAIL TEMPLATES =====================
//*==============================================================
router.get("/email-templates", isAdmin, emailTemplateController.getAllTemplates);
router.get("/email-templates/:type", isAdmin, emailTemplateController.getTemplate);
router.post("/email-templates", isAdmin, emailTemplateController.saveTemplate);

//*==============================================================
//*================== ADMIN POST MANAGEMENT =====================
//*==============================================================
router.get("/posts", postController.getAllPosts);
router.patch("/posts/:postId", isAdmin, postController.updatePostDeleteStatus);
router.get("/posts/stats", isAdmin, postController.getPostStats);
router.get("/posts/reports/resolved", postController.getAllResolvedPostReports);
router.get('/posts/reports/by-status', postController.getAllPostReportsByStatus);
router.patch('/posts/reports/:postId/dismiss-all', postController.dismissAllPendingReportsOfPost);
router.patch("/posts/reports/:postId/mark-investigating", isAdmin, postController.markPostAsInvestigating);
router.get("/posts/statistics", postController.getPostStatistics);

//*==============================================================
//*================== ADMIN Group MANAGEMENT ====================
//*==============================================================
router.get("/groups", groupAdminController.getAllGroupsWithStats);
router.get("/groups/reports", groupAdminController.getAllGroupReportsByStatus);
router.get("/groups/statistics", groupAdminController.getGroupStatistics);
router.get("/groups/reports/resolved", groupAdminController.getAllResolvedGroupReports);
router.patch("/groups/:groupId/reports/dismiss", groupAdminController.dismissAllPendingReportsOfGroup);
router.post("/groups/:groupId/reports/send-warning", groupAdminController.sendWarningToGroup);
router.patch("/groups/:groupId/mark-investigating", groupAdminController.markGroupAsInvestigating);
router.get("/groups/:group_id/posts", groupAdminController.getAllPostsInGroupForAdmin);
router.delete("/groups/:groupId", groupAdminController.deleteGroupForSevereViolation);

//*==============================================================
//*================== ADMIN ADS MANAGEMENT ====================
//*==============================================================
router.get("/ads", adsAdminController.getAllAds);
router.get('/ads/stats', adsAdminController.getAdStats);
router.get('/ads/report-stats', adsAdminController.getAdsReportsStats);
router.get('/ads/:id', adsAdminController.getAdDetails);
router.delete('/ads/:id', adsAdminController.deleteAd);
router.get('/ads/reports/by-status', adsAdminController.getAllAdsReportsByStatus);
router.get('/ads/reports/resolved', adsAdminController.getAllResolvedAdsReports);
router.patch('/ads/reports/:postId/dismiss-all', adsAdminController.dismissAllPendingReportsOfAd);
router.patch('/ads/reports/:postId/mark-investigating', adsAdminController.markAdAsInvestigating);
module.exports = router;
