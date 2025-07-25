const Notification = require("../models/notification.model");

// Hàm tạo và gửi thông báo đến người dùng (legacy)
// io: Socket.io instance, userId: ID người nhận, type: Loại thông báo, content: Nội dung, userSocketMap: Bản đồ kết nối socket
const createNotification = async (io, userId, type, content, userSocketMap) => {
  try {
    // Tạo thông báo trong cơ sở dữ liệu
    const notification = await Notification.create({
      user_id: userId,
      type,
      content,
      is_read: false,
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

// Hàm tạo và gửi thông báo qua namespace (mới)
const createNotificationWithNamespace = async (
  namespace,
  userId,
  type,
  content,
  userSocketMap,
  extraData = {}
) => {
  try {
    // Tạo thông báo trong cơ sở dữ liệu
    const notification = await Notification.create({
      user_id: userId,
      from_user: extraData.fromUser || null,
      type,
      content,
      is_read: false,
      related_id: extraData.relatedId || extraData.messageId || null,
    });

    // Populate thông tin người gửi
    const notificationWithUser = await notification.populate(
      "from_user",
      "fullName avatar_url"
    );

    // Gửi thông báo đến tất cả thiết bị đang kết nối của người dùng qua namespace
    const userSocketIds = userSocketMap.get(userId.toString());
    if (userSocketIds) {
      for (const socketId of userSocketIds) {
        namespace.to(socketId).emit("new_notification", notificationWithUser);
      }
    }

    return notificationWithUser;
  } catch (error) {
    console.error("Error creating notification with namespace:", error);
    throw error;
  }
};

// Lấy danh sách thông báo chưa đọc của người dùng
const getUnreadNotifications = async (userId) => {
  try {
    return await Notification.find({
      user_id: userId,
      is_read: false,
    })
      .populate("from_user", "fullName avatar_url")
      .sort({ createdAt: -1 });
  } catch (error) {
    console.error("Error getting unread notifications:", error);
    throw error;
  }
};

// Lấy danh sách thông báo của người dùng (có phân trang)
const getNotifications = async (userId, limit = 20, skip = 0) => {
  try {
    return await Notification.find({
      user_id: userId,
    })
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip(skip)
      .populate("from_user", "fullName avatar_url");
  } catch (error) {
    console.error("Error getting notifications:", error);
    throw error;
  }
};

// Lấy số lượng thông báo chưa đọc
const getUnreadCount = async (userId) => {
  try {
    return await Notification.countDocuments({
      user_id: userId,
      is_read: false,
    });
  } catch (error) {
    console.error("Error getting unread count:", error);
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
  createNotification, // Legacy support
  createNotificationWithNamespace, // New namespace support
  getUnreadNotifications,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
};
