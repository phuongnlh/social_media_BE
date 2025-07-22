const Message = require("../models/message.model");
const User = require("../models/user.model");

// Lấy danh sách người đã nhắn tin với user hiện tại
const getChatList = async (req, res) => {
  try {
    const currentUserId = req.user._id; // Lấy ID của người dùng đang đăng nhập

    const conversations = await Message.aggregate([
      // Bước 1: Tìm tất cả tin nhắn mà người dùng hiện tại có tham gia (gửi hoặc nhận)
      {
        $match: { $or: [{ from: currentUserId }, { to: currentUserId }] },
      },
      // Bước 2: Sắp xếp tin nhắn theo thời gian để lấy được tin cuối cùng
      { $sort: { createdAt: -1 } },
      // Bước 3: Nhóm tin nhắn theo cặp người dùng (cuộc trò chuyện)
      {
        $group: {
          _id: {
            $cond: {
              if: { $eq: ["$from", currentUserId] },
              then: "$to",
              else: "$from",
            },
          },
          lastMessage: { $first: "$$ROOT" }, // Lấy toàn bộ document tin nhắn cuối cùng
          unreadCount: {
            $sum: {
              // Đếm những tin nhắn mà người nhận là mình VÀ chưa đọc
              $cond: [
                {
                  $and: [
                    { $eq: ["$to", currentUserId] },
                    { $eq: ["$is_read", false] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      // Bước 4: Lấy thông tin chi tiết của người trò chuyện cùng (partner)
      {
        $lookup: {
          from: "users", // Tên collection của User model
          localField: "_id",
          foreignField: "_id",
          as: "partnerInfo",
        },
      },
      {
        $unwind: "$partnerInfo",
      },
      // Bước 5: Định dạng lại kết quả đầu ra cho gọn gàng
      {
        $project: {
          _id: "$partnerInfo._id",
          fullName: "$partnerInfo.fullName",
          avatar_url: "$partnerInfo.avatar_url",
          lastMessage: {
            content: "$lastMessage.content",
            media: "$lastMessage.media",
            createdAt: "$lastMessage.createdAt",
          },
          unread: "$unreadCount",
        },
      },
      // (Tùy chọn) Sắp xếp lại các cuộc trò chuyện, đưa cuộc có tin nhắn mới nhất lên đầu
      {
        $sort: { "lastMessage.createdAt": -1 },
      },
    ]);
    res.status(200).json(conversations);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Lấy tin nhắn giữa user hiện tại và một user khác
const getMessagesWithUser = async (req, res) => {
  try {
    const myId = req.user._id;
    const otherId = req.params.userId;

    // Lấy tất cả tin nhắn giữa 2 người (from hoặc to)
    const messages = await Message.find({
      $or: [
        { from: myId, to: otherId },
        { from: otherId, to: myId },
      ],
    }).sort({ createdAt: 1 }); // sắp xếp theo thời gian tăng dần
    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

// Đánh dấu tất cả tin nhắn từ partnerId gửi cho currentUserId là đã đọc
const markAsRead = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const { partnerId } = req.params; // Lấy ID của người đang chat cùng

    // Cập nhật tất cả tin nhắn từ partnerId gửi cho currentUserId thành đã đọc
    const result = await Message.updateMany(
      {
        from: partnerId,
        to: currentUserId,
        is_read: false, // Chỉ cập nhật những tin chưa đọc
      },
      {
        $set: { is_read: true },
      }
    );

    res.status(200).json({
      success: true,
      message: "Messages marked as read",
      modifiedCount: result.modifiedCount,
    });
  } catch (error) {
    console.error("Error marking messages as read:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
};

module.exports = {
  getChatList,
  getMessagesWithUser,
  markAsRead,
};
