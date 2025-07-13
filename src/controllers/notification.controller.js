const Notification = require("../models/notification.model");
const notificationService = require("../services/notification.service");

// Lấy tất cả thông báo của người dùng với phân trang
const getNotifications = async (req, res) => {
  try {
    const userId = req.user._id;

    // Lấy thông báo với phân trang
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const notifications = await Notification.find({ user_id: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Notification.countDocuments({ user_id: userId });

    return res.status(200).json({
      success: true,
      data: {
        notifications,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("Error getting notifications:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể lấy danh sách thông báo",
      error: error.message,
    });
  }
};

// Lấy số lượng thông báo chưa đọc của người dùng
const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id;

    const count = await Notification.countDocuments({
      user_id: userId,
      is_read: false,
    });

    return res.status(200).json({
      success: true,
      data: { count },
    });
  } catch (error) {
    console.error("Error getting unread count:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể lấy số lượng thông báo chưa đọc",
      error: error.message,
    });
  }
};

// Đánh dấu một thông báo đã đọc
const markAsRead = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user._id;

    // Đảm bảo thông báo thuộc về người dùng
    const notification = await Notification.findOne({
      _id: notificationId,
      user_id: userId,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông báo",
      });
    }

    const updated = await notificationService.markAsRead(notificationId);

    return res.status(200).json({
      success: true,
      message: "Đã đánh dấu thông báo là đã đọc",
      data: { notification: updated },
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể đánh dấu thông báo là đã đọc",
      error: error.message,
    });
  }
};

// Đánh dấu tất cả thông báo của người dùng là đã đọc
const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user._id;

    await notificationService.markAllAsRead(userId);

    return res.status(200).json({
      success: true,
      message: "Đã đánh dấu tất cả thông báo là đã đọc",
    });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể đánh dấu tất cả thông báo là đã đọc",
      error: error.message,
    });
  }
};

// Xóa một thông báo
const deleteNotification = async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user._id;

    // Đảm bảo thông báo thuộc về người dùng
    const notification = await Notification.findOne({
      _id: notificationId,
      user_id: userId,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy thông báo",
      });
    }

    await Notification.findByIdAndDelete(notificationId);

    return res.status(200).json({
      success: true,
      message: "Đã xóa thông báo thành công",
    });
  } catch (error) {
    console.error("Error deleting notification:", error);
    return res.status(500).json({
      success: false,
      message: "Không thể xóa thông báo",
      error: error.message,
    });
  }
};

module.exports = {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
