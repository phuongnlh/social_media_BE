const Message = require("../models/message.model");
const Channel = require("../models/Chat/channel.model"); // Thêm import model Channel
const Notification = require("../models/notification.model");
const { uploadToCloudinary } = require("../utils/upload_utils");
const notificationService = require("../services/notification.service");
const { setSocketIO } = require("./io-instance");

const userSocketMap = new Map(); // userId => socket.id
const messageUserSocketMap = new Map(); // userId => socket.id cho messaging
const notificationUserSocketMap = new Map(); // userId => socket.id cho notifications

module.exports = (io) => {
  // Make IO instance available globally
  setSocketIO(io, userSocketMap, notificationUserSocketMap);

  // ===== MESSAGING NAMESPACE =====
  const messagesNamespace = io.of("/messages");
  messagesNamespace.on("connection", (socket) => {
    // Đăng ký userId cho messaging socket
    socket.on("register_messaging", ({ userId }) => {
      socket.userId = userId.toString();

      if (!messageUserSocketMap.has(userId)) {
        messageUserSocketMap.set(userId, new Set());
      }
      messageUserSocketMap.get(userId).add(socket.id);
    });

    // Xử lý gửi tin nhắn
    socket.on("send_message", async (data) => {
      try {
        const { from, channelId, content, media = [] } = data;

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
          channelId,
          content,
          media: mediaPayload,
          readBy: [
            {
              userId: from, // Người gửi đã "đọc" message của chính họ
              readAt: new Date(),
            },
          ],
        });

        // Tìm channel để lấy danh sách thành viên
        const channel = await Channel.findOne({ channelId });
        if (!channel) {
          throw new Error("Channel không tồn tại");
        }

        // Update channel's lastMessage và updatedAt
        await Channel.findOneAndUpdate(
          { channelId },
          {
            lastMessage: content || "Attachment sent",
            updatedAt: new Date(),
          }
        );

        // Gửi tin nhắn cho tất cả thành viên trong channel (trừ người gửi)
        const recipientMembers = channel.members.filter(
          (member) => member.userId.toString() !== from.toString()
        );

        // Thêm thông tin channel vào message để client biết message thuộc kênh nào
        const messageWithChannel = {
          ...message.toObject(),
          channelType: channel.type,
          channelName: channel.name,
        };

        // Gửi tin nhắn đến tất cả thành viên
        for (const member of recipientMembers) {
          const memberId = member.userId.toString();
          const memberSocketIds = messageUserSocketMap.get(memberId);

          if (memberSocketIds) {
            for (const socketId of memberSocketIds) {
              messagesNamespace
                .to(socketId)
                .emit("receive_message", messageWithChannel);
            }
          }

          // Tạo thông báo cho thành viên (chỉ khi họ không bị mute)
          if (!member.isMuted) {
            try {
              const notiWithUser = await message.populate(
                "from",
                "fullName avatar_url"
              );
              const notificationsNamespace = io.of("/notifications");

              // Tạo nội dung thông báo khác nhau cho kênh riêng tư và nhóm
              let notificationContent = "";
              if (channel.type === "private") {
                notificationContent = `${notiWithUser.from?.fullName} đã gửi cho bạn một tin nhắn mới`;
              } else {
                notificationContent = `${
                  notiWithUser.from?.fullName
                } đã gửi tin nhắn trong nhóm ${channel.name || "Group chat"}`;
              }

              await notificationService.createNotificationWithNamespace(
                notificationsNamespace,
                memberId,
                "message",
                notificationContent,
                notificationUserSocketMap,
                {
                  messageId: message._id,
                  fromUser: from,
                  channelId: channelId,
                }
              );
            } catch (notifyErr) {
              console.error(
                "Failed to create message notification:",
                notifyErr
              );
            }
          }
        }

        // Cập nhật message với readBy để người gửi được đánh dấu là đã đọc
        await Message.findByIdAndUpdate(message._id, {
          $push: { readBy: { userId: from, readAt: new Date() } },
        });

        // Xác nhận gửi thành công cho người gửi
        const populatedMessage = await Message.findById(message._id).populate(
          "from",
          "fullName avatar_url"
        );
        socket.emit("message_sent", populatedMessage);
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
    });
  });

  // ===== NOTIFICATIONS NAMESPACE =====
  const notificationsNamespace = io.of("/notifications");
  notificationsNamespace.on("connection", (socket) => {
    // Đăng ký userId cho notification socket
    socket.on("register_notifications", ({ userId }) => {
      socket.userId = userId.toString();

      if (!notificationUserSocketMap.has(userId)) {
        notificationUserSocketMap.set(userId, new Set());
      }
      notificationUserSocketMap.get(userId).add(socket.id);

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

    // ===== CALL EVENTS =====

    // Gửi thông báo call đến participants
    socket.on("send_call_notification", async (data) => {
      try {
        const {
          channelId,
          callType,
          callerInfo,
          participants,
          chatType,
          chatInfo,
        } = data;
        const callerId = socket.userId;

        // Gửi call notification đến từng participant
        for (const participantId of participants) {
          if (participantId.toString() !== callerId) {
            // Tạo notification message dựa trên loại chat
            const isGroupCall = chatType === "group";
            const notificationMessage = isGroupCall
              ? `${callerInfo.name} đang gọi ${
                  callType === "video" ? "video" : "thoại"
                } nhóm ${chatInfo?.name || "Nhóm"}`
              : `${callerInfo.name} đang gọi ${
                  callType === "video" ? "video" : "thoại"
                }`;

            // Tạo notification trong database
            const notification =
              await notificationService.createNotificationWithNamespace(
                notificationsNamespace,
                participantId,
                "incoming_call",
                notificationMessage,
                notificationUserSocketMap,
                {
                  callData: {
                    channelId,
                    callType,
                    callerInfo,
                    chatType,
                    chatInfo,
                    timestamp: Date.now(),
                  },
                }
              );

            // Gửi real-time call notification
            const participantSocketIds = notificationUserSocketMap.get(
              participantId.toString()
            );
            if (participantSocketIds) {
              for (const participantSocketId of participantSocketIds) {
                notificationsNamespace
                  .to(participantSocketId)
                  .emit("incoming_call", {
                    channelId,
                    callType,
                    callerInfo,
                    chatType,
                    chatInfo,
                    notificationId: notification._id,
                    timestamp: Date.now(),
                  });
              }
            }
          }
        }

        socket.emit("call_notification_sent", { success: true });
      } catch (err) {
        console.error("Send call notification error:", err);
        socket.emit("call_notification_error", "Không thể gửi thông báo call");
      }
    });

    // Join call - thông báo đã tham gia call
    socket.on("join_call", async (data) => {
      try {
        const { channelId, userInfo } = data;
        const userId = socket.userId;

        // Thông báo cho các users khác trong call
        notificationsNamespace.emit("user_joined_call", {
          channelId,
          userInfo,
          userId,
        });
      } catch (err) {
        console.error("Join call error:", err);
      }
    });

    // Call rejected - thông báo cuộc gọi bị từ chối
    socket.on("call_rejected", async (data) => {
      try {
        const { channelId, rejectedBy, callerInfo } = data;

        // Thông báo cho người gọi rằng cuộc gọi bị từ chối
        const callerSocketIds = notificationUserSocketMap.get(
          callerInfo.id.toString()
        );
        if (callerSocketIds) {
          for (const callerSocketId of callerSocketIds) {
            notificationsNamespace.to(callerSocketId).emit("call_ended", {
              channelId,
              endedBy: rejectedBy,
              reason: "rejected",
            });
          }
        }
      } catch (err) {
        console.error("Call rejected error:", err);
      }
    });

    // Leave call - thông báo đã rời call
    socket.on("leave_call", async (data) => {
      try {
        const { channelId, userInfo } = data;
        const userId = socket.userId;

        // Thông báo cho các users khác trong call
        notificationsNamespace.emit("user_left_call", {
          channelId,
          userInfo,
          userId,
        });
      } catch (err) {
        console.error("Leave call error:", err);
      }
    });

    // End call - kết thúc call cho tất cả
    socket.on("end_call", async (data) => {
      try {
        const { channelId, participants } = data;
        const userId = socket.userId;

        // Thông báo kết thúc call cho tất cả participants
        for (const participantId of participants) {
          if (participantId.toString() !== userId) {
            const participantSocketIds = notificationUserSocketMap.get(
              participantId.toString()
            );
            if (participantSocketIds) {
              for (const participantSocketId of participantSocketIds) {
                notificationsNamespace
                  .to(participantSocketId)
                  .emit("call_ended", {
                    channelId,
                    endedBy: userId,
                  });
              }
            }
          }
        }
      } catch (err) {
        console.error("End call error:", err);
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
    });
  });
};
