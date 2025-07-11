const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notification.controller");
const { isLogin } = require("../middlewares/auth");

// Tất cả các route thông báo đều yêu cầu xác thực
router.use(isLogin);

// Lấy tất cả thông báo của người dùng hiện tại
router.get("/", notificationController.getNotifications);

// Lấy số lượng thông báo chưa đọc
router.get("/unread-count", notificationController.getUnreadCount);

// Đánh dấu một thông báo đã đọc
router.patch("/:notificationId/read", notificationController.markAsRead);

// Đánh dấu tất cả thông báo đã đọc
router.patch("/read-all", notificationController.markAllAsRead);

// Xóa một thông báo
router.delete("/:notificationId", notificationController.deleteNotification);

module.exports = router;
