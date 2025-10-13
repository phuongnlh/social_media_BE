const express = require("express");
const router = express.Router();
const { isLogin } = require("../middlewares/auth");
const reportController = require("../controllers/report.controller");

// ================== PUBLIC ROUTES (User) ==================

// Tạo báo cáo mới
router.post("/", isLogin, reportController.createReport);

// Lấy báo cáo của user hiện tại
router.get("/my-reports", isLogin, reportController.getUserReports);

// Xóa báo cáo của user (chỉ khi pending)
router.delete("/:id", isLogin, reportController.deleteReport);

module.exports = router;
