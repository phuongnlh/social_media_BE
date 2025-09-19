const Message = require("../models/message.model");
const Channel = require("../models/Chat/channel.model"); // Thêm import model Channel
const Notification = require("../models/notification.model");
const { uploadToCloudinary } = require("../utils/upload_utils");
const notificationService = require("../services/notification.service");
const { setSocketIO } = require("./io-instance");
const redisClient = require("../config/database.redis");
const dayjs = require("dayjs");

const userSocketMap = new Map(); // userId => socket.id
const messageUserSocketMap = new Map(); // userId => socket.id cho messaging
const notificationUserSocketMap = new Map(); // userId => socket.id cho notifications
const userRefreshTokensSet = `user-online`;
module.exports = (io) => {
  // Make IO instance available globally
  setSocketIO(io, userSocketMap, notificationUserSocketMap);

  // ===== MESSAGING NAMESPACE =====
  const messagesNamespace = io.of("/messages");
  messagesNamespace.on("connection", (socket) => {
    // Đăng ký userId cho messaging socket
    socket.on("register_messaging", async ({ userId }) => {
      socket.userId = userId.toString();

      // Lưu socketId -> userId
      await redisClient.sAdd(`user:online:${userId}`, socket.id);

      // Đánh dấu user đang online
      await redisClient.sAdd("online_users", userId);

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

        const newMessage = await Message.findById(message._id).populate(
          "from",
          "fullName avatar_url"
        );

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
          ...newMessage.toObject(),
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
    socket.on("disconnect", async () => {
      const userId = socket.userId;
      if (!userId) return;

      // Xóa socket id khỏi Redis
      await redisClient.sRem(`user:online:${userId}`, socket.id);

      if (messageUserSocketMap.has(userId)) {
        const sockets = messageUserSocketMap.get(userId);
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          messageUserSocketMap.delete(userId);
        }
      }

      const stillOnline = await redisClient.sCard(`user:online:${userId}`);
      if (stillOnline === 0) {
        // Xóa khỏi danh sách online
        await redisClient.sRem("online_users", userId);

        // Ghi last active (ISO string hoặc timestamp)
        await redisClient.hSet(
          "user:lastActive",
          userId,
          dayjs().toISOString()
        );

        console.log(`❌ User ${userId} offline, last active saved`);
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
          channelCallId,
          callType,
          callerInfo,
          participants,
          chatType,
          chatInfo,
        } = data;
        const callerId = socket.userId;

        if (chatType === "group" && chatInfo?._id) {
          const chatId = chatInfo._id;
          const callInfoKey = `active-call:info:${chatId}`;

          await redisClient.hSet(callInfoKey, {
            chatId,
            channelCallId,
            callType,
            startTime: Date.now().toString(),
          });

          const TTL_SECONDS = 6 * 60 * 60; // 6 giờ
          redisClient.expire(callInfoKey, TTL_SECONDS);
        }

        for (const participantId of participants) {
          if (participantId.toString() !== callerId) {
            const participantSocketIds = notificationUserSocketMap.get(
              participantId.toString()
            );
            if (participantSocketIds) {
              for (const participantSocketId of participantSocketIds) {
                notificationsNamespace
                  .to(participantSocketId)
                  .emit("incoming_call", {
                    channelCallId,
                    callType,
                    callerInfo,
                    chatType,
                    chatInfo,
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

    // Join call
    socket.on("join_call", async (data) => {
      try {
        const { channelCallId, userInfo } = data;
        const userId = socket.userId;

        notificationsNamespace.emit("user_joined_call", {
          channelCallId,
          userInfo,
          userId,
        });
      } catch (err) {
        console.error("Join call error:", err);
      }
    });

    // Call rejected
    socket.on("call_rejected", async (data) => {
      try {
        const { channelCallId, rejectedBy, callerInfo, isGroupCall, chatInfo } =
          data;

        if (isGroupCall) {
          notificationsNamespace.emit("call_rejected_by_user", {
            channelCallId,
            rejectedBy,
            isGroupCall: true,
            chatInfo,
          });

          const callerSocketIds = notificationUserSocketMap.get(
            callerInfo.id.toString()
          );
          if (callerSocketIds) {
            for (const callerSocketId of callerSocketIds) {
              notificationsNamespace
                .to(callerSocketId)
                .emit("call_rejected_by_user", {
                  channelCallId,
                  rejectedBy,
                  isGroupCall: true,
                });
            }
          }
        } else {
          const callerSocketIds = notificationUserSocketMap.get(
            callerInfo.id.toString()
          );
          if (callerSocketIds) {
            for (const callerSocketId of callerSocketIds) {
              notificationsNamespace.to(callerSocketId).emit("call_ended", {
                channelCallId,
                endedBy: rejectedBy,
                reason: "rejected",
                isGroupCall: false,
              });
            }
          }
        }
      } catch (err) {
        console.error("Call rejected error:", err);
      }
    });

    // Leave call
    socket.on("leave_call", async (data) => {
      try {
        const { channelCallId, userInfo, chatId } = data;
        const userId = socket.userId;

        notificationsNamespace.emit("user_left_call", {
          channelCallId,
          userInfo,
          userId,
        });

        if (chatId) {
          const callInfoKey = `active-call:info:${chatId}`;
          const participantsKey = `active-call:participants:${chatId}`;

          await redisClient.sRem(participantsKey, userId);

          const remainingParticipants = await redisClient.sCard(
            participantsKey
          );

          if (remainingParticipants === 0) {
            await redisClient.del(callInfoKey, participantsKey);

            const channel = await Channel.findOne({ _id: chatId });
            if (channel?.members) {
              for (const member of channel.members) {
                const memberSocketIds = notificationUserSocketMap.get(
                  member.userId.toString()
                );
                if (memberSocketIds) {
                  for (const socketId of memberSocketIds) {
                    notificationsNamespace
                      .to(socketId)
                      .emit("group_call_ended", {
                        channelCallId,
                        chatId,
                      });
                  }
                }
              }
            }
          } else {
            const callInfo = await redisClient.hGetAll(callInfoKey);
            const channel = await Channel.findOne({ _id: chatId });
            if (channel?.members) {
              for (const member of channel.members) {
                const memberSocketIds = notificationUserSocketMap.get(
                  member.userId.toString()
                );
                if (memberSocketIds) {
                  for (const socketId of memberSocketIds) {
                    notificationsNamespace
                      .to(socketId)
                      .emit("active_group_call", {
                        channelCallId,
                        callType: callInfo.callType,
                        chatId,
                        participantsCount: remainingParticipants,
                      });
                  }
                }
              }
            }
          }
        }
      } catch (err) {
        console.error("Leave call error:", err);
      }
    });

    // End call
    socket.on("end_call", async (data) => {
      try {
        const { channelCallId, participants, isGroupCall, chatId } = data;
        const endedByUserId = socket.userId;

        if (isGroupCall && chatId) {
          const callInfoKey = `active-call:info:${chatId}`;
          const participantsKey = `active-call:participants:${chatId}`;
          await redisClient.del(callInfoKey, participantsKey);
        }

        for (const participantId of participants) {
          if (participantId.toString() !== endedByUserId) {
            const participantSocketIds = notificationUserSocketMap.get(
              participantId.toString()
            );
            if (participantSocketIds) {
              for (const participantSocketId of participantSocketIds) {
                notificationsNamespace
                  .to(participantSocketId)
                  .emit("call_ended", {
                    channelCallId,
                    endedBy: endedByUserId,
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
