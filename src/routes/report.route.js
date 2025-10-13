const express = require("express");
const router = express.Router();
const { param } = require("express-validator");
const { isLogin } = require("../middlewares/auth");
const reportController = require("../controllers/report.controller");
const { validateListQuery, validateCreateReport } = require("../utils/validate");

// ================== PUBLIC ROUTES (User) ==================

// Tạo báo cáo mới
router.post("/", isLogin, validateCreateReport, reportController.createReport);

// Lấy báo cáo của user hiện tại
router.get(
  "/my-reports",
  isLogin,
  validateListQuery,
  reportController.getUserReports
);

// Xóa báo cáo của user (chỉ khi pending)
router.delete(
  "/:id",
  isLogin,
  param("id").isMongoId().withMessage("Invalid report ID format"),
  reportController.deleteReport
);

module.exports = router;
