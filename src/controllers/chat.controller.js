const Message = require("../models/message.model");
const User = require("../models/user.model");

// Lấy danh sách người đã nhắn tin với user hiện tại
const getChatList = async (req, res) => {
  try {
    const myId = req.user._id;

    // Tìm tất cả các user đã từng nhắn tin với mình (from hoặc to)
    const messages = await Message.find({
      $or: [{ from: myId }, { to: myId }],
    }).populate("from to", "username avatar");

    // Lấy danh sách userId đã chat (loại trùng lặp, loại chính mình)
    const userSet = new Set();
    messages.forEach((msg) => {
      if (msg.from._id.toString() !== myId.toString())
        userSet.add(msg.from._id.toString());
      if (msg.to._id.toString() !== myId.toString())
        userSet.add(msg.to._id.toString());
    });

    // Lấy thông tin user
    const users = await User.find(
      { _id: { $in: Array.from(userSet) } },
      "_id fullName avatar_url"
    );

    res.json({ success: true, users });
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

module.exports = {
  getChatList,
  getMessagesWithUser,
};