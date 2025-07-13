const Friendship = require("../models/friendship.model");
const User = require("../models/user.model");
const notificationService = require("../services/notification.service");
const { getSocketIO } = require("../socket/io-instance");

// Gửi lời mời kết bạn đến một người dùng khác
const sendFriendRequest = async (req, res) => {
  const userId1 = req.user._id;
  const { userId2 } = req.body;

  if (userId1.toString() === userId2)
    return res
      .status(400)
      .json({ message: "Không thể tự kết bạn với chính mình." });

  try {
    // Kiểm tra xem đã có mối quan hệ bạn bè hoặc đã có lời mời trước đó
    const existing = await Friendship.findOne({
      $or: [
        { user_id_1: userId1, user_id_2: userId2 },
        { user_id_1: userId2, user_id_2: userId1 },
      ],
    });

    if (existing)
      return res
        .status(409)
        .json({ message: "Đã tồn tại lời mời kết bạn hoặc đã là bạn bè." });

    // Tạo mối quan hệ bạn bè mới với trạng thái mặc định là "pending"
    const friendship = await Friendship.create({
      user_id_1: userId1,
      user_id_2: userId2,
    });

    // Lấy tên người dùng gửi lời mời để hiển thị trong thông báo
    const sender = await User.findById(userId1);

    // Gửi thông báo đến người nhận lời mời
    try {
      const io = getSocketIO();
      const userSocketMap = io._nsps.get("/").adapter.rooms;

      await notificationService.createNotification(
        io,
        userId2,
        "friend_request",
        `${sender.username} đã gửi cho bạn lời mời kết bạn`,
        userSocketMap
      );
    } catch (notifyErr) {
      console.error("Không thể gửi thông báo lời mời kết bạn:", notifyErr);
      // Tiếp tục thực thi ngay cả khi gửi thông báo thất bại
    }

    res.status(201).json({ message: "Đã gửi lời mời kết bạn", friendship });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Phản hồi lời mời kết bạn (chấp nhận, từ chối hoặc chặn)
const respondFriendRequest = async (req, res) => {
  const friendshipId = req.params.friendshipId;
  const { action } = req.body; // accept, decline, block
  const userId = req.user._id;

  try {
    // Tìm kiếm lời mời kết bạn và kiểm tra quyền
    const friendship = await Friendship.findById(friendshipId);
    if (!friendship || friendship.user_id_2.toString() !== userId.toString())
      return res
        .status(404)
        .json({ message: "Không tìm thấy lời mời kết bạn" });

    if (action === "accept") {
      // Chấp nhận lời mời kết bạn
      friendship.status = "accepted";
      friendship.accepted_at = new Date();

      // Gửi thông báo đến người gửi lời mời rằng lời mời đã được chấp nhận
      try {
        const receiver = await User.findById(userId);
        const io = getSocketIO();
        const userSocketMap = io._nsps.get("/").adapter.rooms;

        await notificationService.createNotification(
          io,
          friendship.user_id_1,
          "friend_accepted",
          `${receiver.username} đã chấp nhận lời mời kết bạn của bạn`,
          userSocketMap
        );
      } catch (notifyErr) {
        console.error("Không thể gửi thông báo chấp nhận kết bạn:", notifyErr);
        // Tiếp tục thực thi ngay cả khi gửi thông báo thất bại
      }
    } else if (action === "decline") {
      // Từ chối lời mời kết bạn
      friendship.status = "declined";
    } else if (action === "block") {
      // Chặn người gửi lời mời
      friendship.status = "blocked";
    } else {
      return res.status(400).json({ message: "Hành động không hợp lệ" });
    }

    // Lưu thay đổi trạng thái
    await friendship.save();
    res.json({
      message: `Đã ${
        action === "accept"
          ? "chấp nhận"
          : action === "decline"
          ? "từ chối"
          : "chặn"
      } lời mời kết bạn`,
      friendship,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Lấy danh sách bạn bè
const getFriendsList = async (req, res) => {
  const userId = req.user._id;

  try {
    // Tìm tất cả các mối quan hệ bạn bè đã được chấp nhận mà người dùng hiện tại tham gia
    const friends = await Friendship.find({
      status: "accepted",
      $or: [{ user_id_1: userId }, { user_id_2: userId }],
    })
      .populate("user_id_1", "username avatar_url")
      .populate("user_id_2", "username avatar_url");

    // Trả về thông tin của người bạn (không phải thông tin của người dùng hiện tại)
    const result = friends.map((f) => {
      const isSender = f.user_id_1._id.toString() === userId.toString();
      return isSender ? f.user_id_2 : f.user_id_1;
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Lấy danh sách lời mời kết bạn đã nhận
const getIncomingFriendRequests = async (req, res) => {
  const userId = req.user._id;

  try {
    // Tìm tất cả các lời mời kết bạn đang chờ xử lý mà người dùng hiện tại nhận được
    const requests = await Friendship.find({
      user_id_2: userId,
      status: "pending",
    }).populate("user_id_1", "username avatar_url");

    // Trả về thông tin của người gửi lời mời
    res.json(requests.map((r) => r.user_id_1));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  sendFriendRequest,
  respondFriendRequest,
  getFriendsList,
  getIncomingFriendRequests,
};
