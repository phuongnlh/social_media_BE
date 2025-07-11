const Follower = require("../models/follower.model");
const User = require("../models/user.model");
const notificationService = require("../services/notification.service");
const { getSocketIO, getUserSocketMap } = require("../socket/io-instance");

// Theo dõi một người dùng khác
const followUser = async (req, res) => {
  const followerId = req.user._id;
  const { followingId } = req.body;

  if (followerId.toString() === followingId)
    return res.status(400).json({ message: "Không thể tự theo dõi bản thân" });

  try {
    // Kiểm tra xem đã theo dõi người dùng này chưa
    const existing = await Follower.findOne({
      follower_id: followerId,
      following_id: followingId,
    });
    if (existing) return res.status(409).json({ message: "Đã theo dõi người dùng này" });

    // Tạo bản ghi theo dõi mới
    const follow = await Follower.create({
      follower_id: followerId,
      following_id: followingId,
    });
    
    // Gửi thông báo đến người được theo dõi
    try {
      const follower = await User.findById(followerId);
      const io = getSocketIO();
      const userSocketMap = getUserSocketMap();
      
      await notificationService.createNotification(
        io,
        followingId,
        'follow',
        `${follower.username} đã bắt đầu theo dõi bạn`,
        userSocketMap
      );
    } catch (notifyErr) {
      console.error("Không thể gửi thông báo theo dõi:", notifyErr);
      // Tiếp tục thực thi ngay cả khi gửi thông báo thất bại
    }
    
    res.status(201).json({ message: "Đã theo dõi", follow });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Hủy theo dõi một người dùng
const unfollowUser = async (req, res) => {
  const followerId = req.user._id;
  const { followingId } = req.body;

  try {
    // Tìm và xóa bản ghi theo dõi
    const deleted = await Follower.findOneAndDelete({
      follower_id: followerId,
      following_id: followingId,
    });
    if (!deleted) return res.status(404).json({ message: "Chưa theo dõi người dùng này" });

    res.json({ message: "Đã hủy theo dõi" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Lấy danh sách người theo dõi mình
const getFollowers = async (req, res) => {
  const userId = req.user._id;

  try {
    // Tìm các bản ghi mà người dùng hiện tại được theo dõi (following_id = userId)
    const followers = await Follower.find({ following_id: userId }).populate(
      "follower_id",
      "username avatar_url"
    );
    res.json(followers.map((f) => f.follower_id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Lấy danh sách người mình đang theo dõi
const getFollowings = async (req, res) => {
  const userId = req.user._id;

  try {
    // Tìm các bản ghi mà người dùng hiện tại theo dõi (follower_id = userId)
    const following = await Follower.find({ follower_id: userId }).populate(
      "following_id",
      "username avatar_url"
    );
    res.json(following.map((f) => f.following_id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  followUser,
  unfollowUser,
  getFollowers,
  getFollowings,
};
