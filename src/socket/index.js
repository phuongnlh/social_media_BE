const Message = require("../models/message.model");
const Notification = require("../models/notification.model");
const { uploadToCloudinary } = require("../utils/upload_utils");
const notificationService = require("../services/notification.service");
const { setSocketIO } = require("./io-instance");

const userSocketMap = new Map(); // userId => socket.id

module.exports = (io) => {
  // Make IO instance available globally
  setSocketIO(io, userSocketMap);
  io.on("connection", (socket) => {
    console.log("User connected", socket.id);

    //Đăng kí UserId cho socket
    socket.on("register", ({ userId }) => {
      socket.userId = userId.toString();

      // Thêm socket.id vào danh sách socketId của userId
      if (!userSocketMap.has(userId)) {
        userSocketMap.set(userId, new Set());
      }
      userSocketMap.get(userId).add(socket.id);
    });

    socket.on("send-message", async (data) => {
      try {
        const { from, to, content, media = [] } = data;

        let mediaUrls = [];
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
        const toSocketIds = userSocketMap.get(to.toString());
        if (toSocketIds) {
          for (const socketId of toSocketIds) {
            io.to(socketId).emit("receive_message", message);
          }
        }

        // Tạo thông báo cho người nhận tin nhắn
        try {
          await notificationService.createNotification(
            io,
            to,
            "message",
            `Bạn có tin nhắn mới từ ${from}`,
            userSocketMap
          );
        } catch (notifyErr) {
          console.error("Failed to create message notification:", notifyErr);
          // Tiếp tục thực thi ngay cả khi gửi thông báo thất bại
        }

        // Optional: emit back to sender
        socket.emit("message-sent", message);
      } catch (err) {
        console.error(err);
        socket.emit("error-message", "Gửi tin nhắn thất bại.");
      }
    });

    socket.on("disconnect", () => {
      const userId = socket.userId;
      if (userId && userSocketMap.has(userId)) {
        const sockets = userSocketMap.get(userId);
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSocketMap.delete(userId);
        }
      }
    });

    // Xử lý gửi thông báo
    socket.on("send-notification", async (data) => {
      try {
        const { userId, type, content } = data;

        const notification = await notificationService.createNotification(
          io,
          userId,
          type,
          content,
          userSocketMap
        );

        // Xác nhận thông báo đã được gửi
        socket.emit("notification-sent", { success: true, notification });
      } catch (err) {
        console.error("Notification error:", err);
        socket.emit("error-notification", "Gửi thông báo thất bại.");
      }
    });

    // Đánh dấu thông báo đã đọc
    socket.on("mark-notification-read", async (data) => {
      try {
        const { notificationId } = data;

        const notification = await notificationService.markAsRead(
          notificationId
        );

        if (notification) {
          socket.emit("notification-updated", notification);
        } else {
          socket.emit("error-notification", "Không tìm thấy thông báo");
        }
      } catch (err) {
        console.error("Mark notification error:", err);
        socket.emit("error-notification", "Không thể cập nhật thông báo");
      }
    });

    // Đánh dấu tất cả thông báo đã đọc
    socket.on("mark-all-notifications-read", async (data) => {
      try {
        const { userId } = data;

        await notificationService.markAllAsRead(userId);

        socket.emit("all-notifications-updated", { success: true });

        // Thông báo cho tất cả thiết bị đang kết nối của người dùng
        const userSocketIds = userSocketMap.get(userId.toString());
        if (userSocketIds) {
          for (const socketId of userSocketIds) {
            if (socketId !== socket.id) {
              // Không gửi cho socket hiện tại
              io.to(socketId).emit("notifications-refresh-needed");
            }
          }
        }
      } catch (err) {
        console.error("Mark all notifications error:", err);
        socket.emit(
          "error-notification",
          "Không thể cập nhật tất cả thông báo"
        );
      }
    });

    // Lấy danh sách thông báo chưa đọc của người dùng
    socket.on("get-notifications", async (data) => {
      try {
        const { userId } = data;

        const notifications = await notificationService.getUnreadNotifications(
          userId
        );

        socket.emit("notifications-list", notifications);
      } catch (err) {
        console.error("Get notifications error:", err);
        socket.emit("error-notification", "Không thể lấy danh sách thông báo");
      }
    });
  });
};
