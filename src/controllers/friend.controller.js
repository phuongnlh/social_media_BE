const Friendship = require("../models/friendship.model");
const User = require("../models/user.model");
const notificationService = require("../services/notification.service");
const {
  getSocketIO,
  getNotificationUserSocketMap,
} = require("../socket/io-instance");
const postModel = require("../models/post.model");
const { default: mongoose } = require("mongoose");

// Gửi lời mời kết bạn đến một người dùng khác
const sendFriendRequest = async (req, res) => {
  const userId1 = req.user._id;
  const { user_id } = req.body;

  if (userId1.toString() === user_id)
    return res
      .status(400)
      .json({ message: "Không thể tự kết bạn với chính mình." });

  try {
    // Kiểm tra xem đã có mối quan hệ bạn bè hoặc đã có lời mời trước đó
    const existing = await Friendship.findOne({
      $or: [
        { user_id_1: userId1, user_id_2: user_id },
        { user_id_1: user_id, user_id_2: userId1 },
      ],
    });

    if (existing)
      return res
        .status(409)
        .json({ message: "Đã tồn tại lời mời kết bạn hoặc đã là bạn bè." });

    // Tạo mối quan hệ bạn bè mới với trạng thái mặc định là "pending"
    const friendship = await Friendship.create({
      user_id_1: userId1,
      user_id_2: user_id,
    });

    // Lấy tên người dùng gửi lời mời để hiển thị trong thông báo
    const sender = await User.findById(userId1);

    // Gửi thông báo đến người nhận lời mời
    try {
      const io = getSocketIO();
      const notificationsNamespace = io.of("/notifications");
      const notificationUserSocketMap = getNotificationUserSocketMap();

      await notificationService.createNotificationWithNamespace(
        notificationsNamespace,
        user_id,
        "friend_request",
        `${sender.fullName} đã gửi cho bạn một lời mời kết bạn`,
        notificationUserSocketMap,
        { fromUser: sender._id, relatedId: friendship._id }
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

// Hủy kết bạn với một người dùng khác
const cancelFriendRequest = async (req, res) => {
  const userId = req.user._id;
  const { user_id } = req.body;

  try {
    // Tìm kiếm mối quan hệ bạn bè và xóa
    const friendship = await Friendship.findOneAndDelete({
      $or: [
        { user_id_1: userId, user_id_2: user_id },
        { user_id_1: user_id, user_id_2: userId },
      ],
    });

    if (!friendship)
      return res
        .status(404)
        .json({ message: "Không tìm thấy mối quan hệ bạn bè" });

    res.status(200).json({ message: "Đã hủy kết bạn", friendship });
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
    const friendship = await Friendship.findOne({
      user_id_1: friendshipId,
      user_id_2: userId,
    });
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
        const notificationsNamespace = io.of("/notifications");
        const notificationUserSocketMap = getNotificationUserSocketMap();

        await notificationService.createNotificationWithNamespace(
          notificationsNamespace,
          friendship.user_id_1,
          "friend_accepted",
          `${receiver.fullName} đã chấp nhận lời mời kết bạn của bạn`,
          notificationUserSocketMap,
          { fromUser: receiver._id, relatedId: friendship._id }
        );
      } catch (notifyErr) {
        console.error("Không thể gửi thông báo chấp nhận kết bạn:", notifyErr);
        // Tiếp tục thực thi ngay cả khi gửi thông báo thất bại
      }
    } else if (action == "decline") {
      // Từ chối lời mời kết bạn
      await Friendship.findOneAndDelete({ user_id_1: friendshipId });
      res.status(200).json({
        message: "Đã từ chối lời mời kết bạn",
      });
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
  const userId = req.params.userId;
  try {
    // Tìm tất cả các mối quan hệ bạn bè đã được chấp nhận mà người dùng hiện tại tham gia
    const friends = await Friendship.find({
      status: "accepted",
      $or: [{ user_id_1: userId }, { user_id_2: userId }],
    })
      .populate("user_id_1", "fullName avatar_url")
      .populate("user_id_2", "fullName avatar_url");

    // Trả về thông tin của người bạn (không phải thông tin của người dùng hiện tại)
    const result = friends.map((f) => {
      const isSender = f.user_id_1._id.toString() === userId.toString();
      return isSender ? f.user_id_2 : f.user_id_1;
    });
    res.status(200).json(result);
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
    }).populate("user_id_1", "fullName avatar_url createdAt");

    // Trả về thông tin của người gửi lời mời
    res.json(requests.map((r) => r.user_id_1));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

//Lấy danh sách chưa kết bạn
const getUnfriendedUsers = async (req, res) => {
  const userId = req.user._id;

  try {
    // 🔹 Lấy danh sách bạn bè hiện tại
    const myFriends = await Friendship.find({
      status: "accepted",
      $or: [{ user_id_1: userId }, { user_id_2: userId }],
    });

    const myFriendIds = myFriends.map((f) =>
      f.user_id_1.toString() === userId.toString()
        ? f.user_id_2.toString()
        : f.user_id_1.toString()
    );

    // 🔹 Nếu chưa có bạn bè → lấy random 10 người (trừ bản thân)
    if (myFriendIds.length === 0) {
      const randomUsers = await User.aggregate([
        {
          $match: {
            _id: { $ne: new mongoose.Types.ObjectId(userId) },
            role: "user",
          },
        },
        { $sample: { size: 10 } },
        { $project: { username: 1, fullName: 1, avatar_url: 1 } },
      ]);
      return res.json(randomUsers);
    }

    // 🔹 Tìm bạn của bạn bè
    const friendsOfFriends = await Friendship.find({
      status: "accepted",
      $or: [
        { user_id_1: { $in: myFriendIds } },
        { user_id_2: { $in: myFriendIds } },
      ],
    });

    const countMap = {};
    friendsOfFriends.forEach((f) => {
      const id1 = f.user_id_1.toString();
      const id2 = f.user_id_2.toString();

      const other =
        myFriendIds.includes(id1) && id2 !== userId.toString()
          ? id2
          : myFriendIds.includes(id2) && id1 !== userId.toString()
          ? id1
          : null;

      if (
        other &&
        !myFriendIds.includes(other) &&
        other !== userId.toString()
      ) {
        countMap[other] = (countMap[other] || 0) + 1;
      }
    });

    // 🔹 Lấy danh sách userId sắp xếp theo mutual friend
    const sortedUserIds = Object.keys(countMap).sort(
      (a, b) => countMap[b] - countMap[a]
    );

    let recommendedUsers = [];
    if (sortedUserIds.length > 0) {
      const objectIds = sortedUserIds.map(
        (id) => new mongoose.Types.ObjectId(id)
      );
      const users = await User.find({
        _id: { $in: objectIds },
        role: "user",
      })
        .select("username fullName avatar_url")
        .lean();

      recommendedUsers = users.map((u) => ({
        ...u,
        mutualFriends: countMap[u._id.toString()] || 0,
      }));
    }

    // 🔹 Nếu chưa đủ 10 người → thêm random (trừ bản thân + bạn bè + đã gợi ý)
    if (recommendedUsers.length < 10) {
      const excludeIds = [
        new mongoose.Types.ObjectId(userId),
        ...myFriendIds.map((id) => new mongoose.Types.ObjectId(id)),
        ...recommendedUsers.map((u) => new mongoose.Types.ObjectId(u._id)),
      ];

      const additionalUsers = await User.aggregate([
        {
          $match: {
            _id: { $nin: excludeIds },
            role: "user",
          },
        },
        { $sample: { size: 10 - recommendedUsers.length } },
        { $project: { username: 1, fullName: 1, avatar_url: 1 } },
      ]);

      recommendedUsers = [...recommendedUsers, ...additionalUsers];
    }

    // 🔹 Giới hạn tối đa 10 kết quả
    const top10 = recommendedUsers.slice(0, 10);

    res.json(top10);
  } catch (err) {
    console.error("❌ Recommend error:", err);
    res.status(500).json({ error: err.message });
  }
};

// Thu hồi lời mời kết bạn
const withdrawFriendRequest = async (req, res) => {
  const userId = req.user._id;
  const { friendId } = req.body;

  try {
    // Tìm và xóa lời mời kết bạn
    const friendship = await Friendship.findOneAndDelete({
      user_id_1: userId,
      user_id_2: friendId,
      status: "pending",
    });

    if (!friendship) {
      return res.status(404).json({ message: "Lời mời không tồn tại" });
    }

    res.status(200).json({ message: "Đã thu hồi lời mời kết bạn", friendship });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Tìm kiếm bạn bè
const searchFriends = async (req, res) => {
  const { query } = req.query;
  try {
    const friends = await User.find({
      $or: [{ fullName: { $regex: query, $options: "i" } }],
    }).select("_id fullName avatar_url username bio");

    // Với mỗi friend, gắn thêm số post + số bạn
    const friendsWithStats = await Promise.all(
      friends.map(async (friend) => {
        const postsCount = await postModel.countDocuments({
          user_id: friend._id,
          is_deleted: false,
        });

        const friendsCount = await Friendship.countDocuments({
          $or: [{ user_id_1: friend._id }, { user_id_2: friend._id }],
          status: "accepted",
        });

        return {
          ...friend.toObject(),
          postsCount,
          friendsCount,
        };
      })
    );

    res.json(friendsWithStats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const searchMyFriends = async (req, res) => {
  const userId = req.user._id;
  const { query } = req.query;

  try {
    // Lấy danh sách các mối quan hệ đã chấp nhận
    const myFriends = await Friendship.find({
      status: "accepted",
      $or: [{ user_id_1: userId }, { user_id_2: userId }],
    });

    // Lấy ra ID của những người bạn (người còn lại trong mỗi cặp)
    const friendIds = myFriends.map((f) =>
      f.user_id_1.toString() === userId.toString() ? f.user_id_2 : f.user_id_1
    );

    // Tìm bạn bè theo tên (nếu có query), và chỉ trong danh sách bạn bè
    const friends = await User.find({
      _id: { $in: friendIds },
      ...(query ? { fullName: { $regex: query, $options: "i" } } : {}),
    }).select("_id fullName avatar_url username bio");

    // Gắn thêm thống kê: số bài viết + số bạn bè
    const friendsWithStats = await Promise.all(
      friends.map(async (friend) => {
        const postsCount = await postModel.countDocuments({
          user_id: friend._id,
          is_deleted: false,
        });

        const friendsCount = await Friendship.countDocuments({
          $or: [{ user_id_1: friend._id }, { user_id_2: friend._id }],
          status: "accepted",
        });

        return {
          ...friend.toObject(),
          postsCount,
          friendsCount,
        };
      })
    );

    res.json(friendsWithStats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Lấy trạng thái quan hệ bạn bè giữa user hiện tại và profile đang xem
const getFriendshipStatus = async (req, res) => {
  try {
    const userId = req.user._id;
    const { profileUserId } = req.params;

    // Tìm xem có mối quan hệ bạn bè nào giữa 2 người chưa
    const friendship = await Friendship.findOne({
      $or: [
        { user_id_1: userId, user_id_2: profileUserId },
        { user_id_1: profileUserId, user_id_2: userId },
      ],
    });

    if (!friendship) {
      return res.json({ status: "none" });
    }

    if (friendship.status === "accepted") {
      return res.json({ status: "friends" });
    }

    if (friendship.status === "pending") {
      if (friendship.user_id_1.toString() === userId.toString()) {
        return res.json({ status: "pending_sent" });
      } else {
        return res.json({ status: "pending_received" });
      }
    }
    if (friendship.status === "declined") {
      return res.json({ status: "none" });
    }
    res.json({ status: friendship.status, friendshipId: friendship._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const countFriends = async (req, res) => {
  const userId = req.params.userId;
  try {
    const count = await Friendship.countDocuments({
      $or: [{ user_id_1: userId }, { user_id_2: userId }],
      status: "accepted",
    });
    res.status(200).json(count);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  sendFriendRequest,
  cancelFriendRequest,
  searchFriends,
  searchMyFriends,
  respondFriendRequest,
  getFriendshipStatus,
  getFriendsList,
  withdrawFriendRequest,
  getUnfriendedUsers,
  getIncomingFriendRequests,
  countFriends,
};
