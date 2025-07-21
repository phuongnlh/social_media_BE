const Notification = require("../models/notification.model");

// Hàm tạo và gửi thông báo đến người dùng
// io: Socket.io instance, userId: ID người nhận, type: Loại thông báo, content: Nội dung, userSocketMap: Bản đồ kết nối socket
const createNotification = async (io, userId, type, content, userSocketMap) => {
  try {
    // Tạo thông báo trong cơ sở dữ liệu
    const notification = await Notification.create({
      user_id: userId,
      type,
      content,
      is_read: false
    });
    
    // Gửi thông báo đến tất cả thiết bị đang kết nối của người dùng
    const userSocketIds = userSocketMap.get(userId.toString());
    if (userSocketIds) {
      for (const socketId of userSocketIds) {
        io.to(socketId).emit("new-notification", notification);
      }
    }
    
    return notification;
  } catch (error) {
    console.error("Error creating notification:", error);
    throw error;
  }
};

// Lấy danh sách thông báo chưa đọc của người dùng
// userId: ID của người dùng
const getUnreadNotifications = async (userId) => {
  try {
    return await Notification.find({ 
      user_id: userId, 
      is_read: false 
    }).sort({ createdAt: -1 });
  } catch (error) {
    console.error("Error getting unread notifications:", error);
    throw error;
  }
};

// Đánh dấu thông báo đã được đọc
// notificationId: ID của thông báo cần đánh dấu
const markAsRead = async (notificationId) => {
  try {
    return await Notification.findByIdAndUpdate(
      notificationId,
      { is_read: true },
      { new: true }
    );
  } catch (error) {
    console.error("Error marking notification as read:", error);
    throw error;
  }
};

// Đánh dấu tất cả thông báo của người dùng là đã đọc
// userId: ID của người dùng
const markAllAsRead = async (userId) => {
  try {
    return await Notification.updateMany(
      { user_id: userId, is_read: false },
      { is_read: true }
    );
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    throw error;
  }
};

module.exports = {
  createNotification,
  getUnreadNotifications,
  markAsRead,
  markAllAsRead
};
