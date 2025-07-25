const Message = require("../models/message.model");
const Notification = require("../models/notification.model");
const { uploadToCloudinary } = require("../utils/upload_utils");
const notificationService = require("../services/notification.service");
const { setSocketIO } = require("./io-instance");

const userSocketMap = new Map(); // userId => socket.id
const messageUserSocketMap = new Map(); // userId => socket.id cho messaging
const notificationUserSocketMap = new Map(); // userId => socket.id cho notifications

module.exports = (io) => {
  // Make IO instance available globally
  setSocketIO(io, userSocketMap);

  // ===== MESSAGING NAMESPACE =====
  const messagesNamespace = io.of("/messages");
  messagesNamespace.on("connection", (socket) => {
    console.log("User connected to messages namespace:", socket.id);

    // Đăng ký userId cho messaging socket
    socket.on("register_messaging", ({ userId }) => {
      socket.userId = userId.toString();

      if (!messageUserSocketMap.has(userId)) {
        messageUserSocketMap.set(userId, new Set());
      }
      messageUserSocketMap.get(userId).add(socket.id);

      console.log(
        `User ${userId} registered for messaging with socket ${socket.id}`
      );
    });

    // Xử lý gửi tin nhắn
    socket.on("send_message", async (data) => {
      try {
        const { from, to, content, media = [] } = data;

        let mediaPayload = [];
        if (media.length > 0) {
          const uploaded = await uploadToCloudinary(media);
          mediaPayload = uploaded.map((file) => ({
            url: file.secure_url,
            type: file.resource_type === "video" ? "video" : "image",
          }));
        }

        const message = await Message.create({
          from,
          to,
          content,
          media: mediaPayload,
        });

        // Gửi tin nhắn cho người nhận qua messaging namespace
        const toSocketIds = messageUserSocketMap.get(to.toString());
        if (toSocketIds) {
          for (const socketId of toSocketIds) {
            messagesNamespace.to(socketId).emit("receive_message", message);
          }
        }

        // Tạo thông báo cho người nhận tin nhắn qua notification namespace
        try {
          const notiWithUser = await message.populate(
            "from",
            "fullName avatar_url"
          );
          const notificationsNamespace = io.of("/notifications");
          await notificationService.createNotificationWithNamespace(
            notificationsNamespace,
            to,
            "message",
            `${notiWithUser.from?.fullName} đã gửi cho bạn một tin nhắn mới`,
            notificationUserSocketMap,
            { messageId: message._id, fromUser: from }
          );
        } catch (notifyErr) {
          console.error("Failed to create message notification:", notifyErr);
        }

        // Xác nhận gửi thành công cho người gửi
        socket.emit("message_sent", message);
      } catch (err) {
        console.error("Send message error:", err);
        socket.emit("error_message", "Gửi tin nhắn thất bại.");
      }
    });

    // Xử lý disconnect cho messaging
    socket.on("disconnect", () => {
      const userId = socket.userId;
      if (userId && messageUserSocketMap.has(userId)) {
        const sockets = messageUserSocketMap.get(userId);
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          messageUserSocketMap.delete(userId);
        }
      }
      console.log("User disconnected from messages namespace:", socket.id);
    });
  });

  // ===== NOTIFICATIONS NAMESPACE =====
  const notificationsNamespace = io.of("/notifications");
  notificationsNamespace.on("connection", (socket) => {
    console.log("User connected to notifications namespace:", socket.id);

    // Đăng ký userId cho notification socket
    socket.on("register_notifications", ({ userId }) => {
      socket.userId = userId.toString();

      if (!notificationUserSocketMap.has(userId)) {
        notificationUserSocketMap.set(userId, new Set());
      }
      notificationUserSocketMap.get(userId).add(socket.id);

      console.log(
        `User ${userId} registered for notifications with socket ${socket.id}`
      );

      // Gửi số lượng thông báo chưa đọc khi kết nối
      notificationService
        .getUnreadCount(userId)
        .then((count) => {
          socket.emit("unread_count_update", count);
        })
        .catch((err) => {
          console.error("Error getting unread count:", err);
        });

      // Gửi danh sách thông báo gần đây khi kết nối
      notificationService
        .getNotifications(userId, 20, 0) // Lấy 20 thông báo gần nhất
        .then((notifications) => {
          socket.emit("notifications_list", notifications);
        })
        .catch((err) => {
          console.error("Error getting notifications list:", err);
        });
    });

    // Xử lý gửi thông báo thủ công
    socket.on("send_notification", async (data) => {
      try {
        const { userId, type, content, relatedId } = data;

        const notification =
          await notificationService.createNotificationWithNamespace(
            notificationsNamespace,
            userId,
            type,
            content,
            notificationUserSocketMap,
            { relatedId }
          );

        socket.emit("notification_sent", { success: true, notification });
      } catch (err) {
        console.error("Notification error:", err);
        socket.emit("error_notification", "Gửi thông báo thất bại.");
      }
    });

    // Đánh dấu thông báo đã đọc
    socket.on("mark_notification_read", async (data) => {
      try {
        const { notificationId } = data;

        const notification = await notificationService.markAsRead(
          notificationId
        );

        if (notification) {
          socket.emit("notification_updated", notification);

          // Cập nhật unread count
          const unreadCount = await notificationService.getUnreadCount(
            socket.userId
          );
          socket.emit("unread_count_update", unreadCount);
        } else {
          socket.emit("error_notification", "Không tìm thấy thông báo");
        }
      } catch (err) {
        console.error("Mark notification error:", err);
        socket.emit("error_notification", "Không thể cập nhật thông báo");
      }
    });

    // Đánh dấu tất cả thông báo đã đọc
    socket.on("mark_all_notifications_read", async () => {
      try {
        const userId = socket.userId;

        await notificationService.markAllAsRead(userId);

        socket.emit("all_notifications_updated", { success: true });
        socket.emit("unread_count_update", 0);

        // Thông báo cho tất cả thiết bị đang kết nối của người dùng
        const userSocketIds = notificationUserSocketMap.get(userId);
        if (userSocketIds) {
          for (const socketId of userSocketIds) {
            if (socketId !== socket.id) {
              notificationsNamespace
                .to(socketId)
                .emit("notifications_refresh_needed");
              notificationsNamespace
                .to(socketId)
                .emit("unread_count_update", 0);
            }
          }
        }
      } catch (err) {
        console.error("Mark all notifications error:", err);
        socket.emit(
          "error_notification",
          "Không thể cập nhật tất cả thông báo"
        );
      }
    });

    // Lấy danh sách thông báo
    socket.on("get_notifications", async (data) => {
      try {
        const { limit = 20, skip = 0 } = data;
        const userId = socket.userId;

        const notifications = await notificationService.getNotifications(
          userId,
          limit,
          skip
        );

        socket.emit("notifications_list", notifications);
      } catch (err) {
        console.error("Get notifications error:", err);
        socket.emit("error_notification", "Không thể lấy danh sách thông báo");
      }
    });

    // Xử lý disconnect cho notifications
    socket.on("disconnect", () => {
      const userId = socket.userId;
      if (userId && notificationUserSocketMap.has(userId)) {
        const sockets = notificationUserSocketMap.get(userId);
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          notificationUserSocketMap.delete(userId);
        }
      }
      console.log("User disconnected from notifications namespace:", socket.id);
    });
  });

  // // ===== LEGACY SUPPORT (tạm thời giữ để backward compatibility) =====
  // io.on("connection", (socket) => {
  //   console.log("User connected to main namespace (legacy):", socket.id);

  //   //Đăng kí UserId cho socket (legacy)
  //   socket.on("register", ({ userId }) => {
  //     socket.userId = userId.toString();

  //     // Thêm socket.id vào danh sách socketId của userId
  //     if (!userSocketMap.has(userId)) {
  //       userSocketMap.set(userId, new Set());
  //     }
  //     userSocketMap.get(userId).add(socket.id);
  //   });

  //   // Legacy message handling - redirect to new namespace
  //   socket.on("send-message", async (data) => {
  //     console.warn(
  //       "Legacy send-message event received. Please use /messages namespace"
  //     );
  //     // Có thể redirect hoặc xử lý legacy
  //   });

  //   // Legacy notification handling
  //   socket.on("send-notification", async (data) => {
  //     console.warn(
  //       "Legacy send-notification event received. Please use /notifications namespace"
  //     );
  //   });

  //   socket.on("disconnect", () => {
  //     const userId = socket.userId;
  //     if (userId && userSocketMap.has(userId)) {
  //       const sockets = userSocketMap.get(userId);
  //       sockets.delete(socket.id);
  //       if (sockets.size === 0) {
  //         userSocketMap.delete(userId);
  //       }
  //     }
  //     console.log("User disconnected from main namespace (legacy):", socket.id);
  //   });
  // });
};
