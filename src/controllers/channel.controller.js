const redisClient = require("../config/database.redis");
const channelModel = require("../models/Chat/channel.model");
const friendshipModel = require("../models/friendship.model");
const messageModel = require("../models/message.model");

// Tạo channel Private 1-1
const createPrivateChannel = async (req, res) => {
  try {
    const { userAId, userBId } = req.body;
    const currentUserId = req.user._id.toString();

    if (!userAId || !userBId) {
      return res.status(400).json({
        success: false,
        message: "Both userAId and userBId are required",
      });
    }

    if (userAId === userBId) {
      return res.status(400).json({
        success: false,
        message: "Cannot create channel with yourself",
      });
    }

    const ids = [userAId, userBId].sort();
    const channelId = `private-${ids[0]}-${ids[1]}`;

    let channel = await channelModel.findOne({ channelId });
    if (channel) {
      channel.members.forEach((member) => {
        if (member.userId.toString() === currentUserId) {
          member.isDelete = false;
        }
      });
      await channel.save();
    } else {
      channel = await channelModel.create({
        channelId,
        type: "private",
        createdBy: userAId,
        members: [
          { userId: userAId, role: "member" },
          { userId: userBId, role: "member" },
        ],
      });
    }

    await channel.populate("members.userId", "fullName avatar_url email");

    res.status(201).json({
      success: true,
      message: "Private channel created successfully",
      data: channel,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating private channel",
      error: error.message,
    });
  }
};

// Tạo channel Group với nhiều thành viên
const createGroupChannel = async (req, res) => {
  try {
    const { name, memberIds } = req.body;
    const createdBy = req.user._id.toString();

    // Tạo channelId unique
    const channelId = `group-${Date.now()}-${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Tạo danh sách members với creator là admin
    const members = [{ userId: createdBy, role: "admin" }];

    // Thêm các members khác
    if (memberIds && memberIds.length > 0) {
      memberIds.forEach((memberId) => {
        if (memberId !== createdBy) {
          members.push({ userId: memberId, role: "member" });
        }
      });
    }
    const avatar = req.file
      ? req.file.path
      : "https://res.cloudinary.com/doxtbwyyc/image/upload/v1754065338/image_copy_yjz7dz.png";

    const channel = await channelModel.create({
      channelId,
      type: "group",
      name,
      avatar,
      createdBy,
      members,
    });

    await channel.populate("members.userId", "fullName avatar_url email");

    res.status(201).json({
      success: true,
      message: "Group channel created successfully",
      data: channel,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error creating group channel",
      error: error.message,
    });
  }
};

// Đổi tên channel group
const updateGroupName = async (req, res) => {
  try {
    const { channelId } = req.params;
    const { name } = req.body;
    const userId = req.user._id.toString();

    const channel = await channelModel.findOne({ channelId });
    if (!channel) {
      return res.status(404).json({
        success: false,
        message: "Channel not found",
      });
    }

    if (channel.type !== "group") {
      return res.status(400).json({
        success: false,
        message: "Cannot rename private channel",
      });
    }

    // Kiểm tra quyền (chỉ admin mới được đổi tên)
    const member = channel.members.find((m) => m.userId.toString() === userId);
    if (!member || member.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can rename the group",
      });
    }

    channel.name = name;
    await channel.save();

    res.status(200).json({
      success: true,
      message: "Group name updated successfully",
      data: channel,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating group name",
      error: error.message,
    });
  }
};

// Thêm thành viên vào channel group
const addMemberToGroup = async (req, res) => {
  try {
    const { channelId } = req.params;
    const { memberIds } = req.body;
    const userId = req.user._id.toString();

    const channel = await channelModel.findOne({ channelId });
    if (!channel) {
      return res.status(404).json({
        success: false,
        message: "Channel not found",
      });
    }

    if (channel.type !== "group") {
      return res.status(400).json({
        success: false,
        message: "Cannot add members to private channel",
      });
    }

    // Kiểm tra quyền (chỉ admin mới được thêm thành viên)
    const member = channel.members.find((m) => m.userId.toString() === userId);
    if (!member || member.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can add members",
      });
    }

    // Thêm các members mới
    const newMembers = [];
    memberIds.forEach((memberId) => {
      const existingMember = channel.members.find(
        (m) => m.userId.toString() === memberId
      );
      if (!existingMember) {
        newMembers.push({ userId: memberId, role: "member" });
      }
    });

    channel.members.push(...newMembers);
    await channel.save();
    await channel.populate("members.userId", "fullName avatar_url email");

    res.status(200).json({
      success: true,
      message: "Members added successfully",
      data: channel,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error adding members",
      error: error.message,
    });
  }
};

// Xoá thành viên khỏi channel group
const removeMemberFromGroup = async (req, res) => {
  try {
    const { channelId, memberId } = req.params;
    const userId = req.user._id.toString();

    const channel = await channelModel.findOne({ channelId });
    if (!channel) {
      return res.status(404).json({
        success: false,
        message: "Channel not found",
      });
    }

    if (channel.type !== "group") {
      return res.status(400).json({
        success: false,
        message: "Cannot remove members from private channel",
      });
    }

    // Kiểm tra quyền
    const currentMember = channel.members.find(
      (m) => m.userId.toString() === userId
    );
    const targetMember = channel.members.find(
      (m) => m.userId.toString() === memberId
    );

    if (!currentMember) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this group",
      });
    }

    if (!targetMember) {
      return res.status(404).json({
        success: false,
        message: "Member not found in this group",
      });
    }

    // Chỉ admin mới được kick người khác, hoặc member tự rời nhóm
    if (userId !== memberId && currentMember.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can remove other members",
      });
    }

    // Không cho phép xóa creator cuối cùng
    const admins = channel.members.filter((m) => m.role === "admin");
    if (targetMember.role === "admin" && admins.length === 1) {
      return res.status(400).json({
        success: false,
        message: "Cannot remove the last admin",
      });
    }

    // Xóa member
    channel.members = channel.members.filter(
      (m) => m.userId.toString() !== memberId
    );
    await channel.save();

    res.status(200).json({
      success: true,
      message: "Member removed successfully",
      data: channel,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error removing member",
      error: error.message,
    });
  }
};

// Xoá channel group
const deleteGroupChannel = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.user._id.toString();

    const channel = await channelModel.findOne({ channelId });
    if (!channel) {
      return res.status(404).json({
        success: false,
        message: "Channel not found",
      });
    }

    if (channel.type !== "group") {
      return res.status(400).json({
        success: false,
        message: "Cannot delete private channel",
      });
    }

    // Chỉ creator mới được xóa group
    if (channel.createdBy !== userId) {
      return res.status(403).json({
        success: false,
        message: "Only the creator can delete this group",
      });
    }

    await channelModel.deleteOne({ channelId });

    res.status(200).json({
      success: true,
      message: "Group channel deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error deleting group channel",
      error: error.message,
    });
  }
};

// Lấy danh sách các channel của user hiện tại
const getUserChannels = async (req, res) => {
  try {
    const userId = req.user._id.toString();

    const channels = await channelModel
      .find({
        "members.userId": userId,
        "members.isDelete": { $ne: true },
      })
      .populate("members.userId", "fullName avatar_url email")
      .sort({ updatedAt: -1 });

    // Tính số tin nhắn chưa đọc cho mỗi channel
    const channelsWithUnreadCount = await Promise.all(
      channels.map(async (channel) => {
        try {
          // Đếm số tin nhắn trong channel mà user chưa đọc
          const unreadCount = await messageModel.countDocuments({
            channelId: channel.channelId,
            from: { $ne: userId }, // Không tính tin nhắn của chính user
            "readBy.userId": { $ne: userId }, // User chưa đọc
          });

          return {
            ...channel.toObject(),
            unreadCount: unreadCount || 0,
          };
        } catch (error) {
          console.error(
            `Error calculating unread for channel ${channel.channelId}:`,
            error
          );
          return {
            ...channel.toObject(),
            unreadCount: 0,
          };
        }
      })
    );

    res.status(200).json({
      success: true,
      message: "User channels retrieved successfully",
      data: channelsWithUnreadCount,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving channels",
      error: error.message,
    });
  }
};

// Lấy thông tin chi tiết channel
const getChannelDetails = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.user._id.toString();

    const channel = await channelModel
      .findOne({ channelId })
      .populate("members.userId", "fullName avatar_url email");

    if (!channel) {
      return res.status(404).json({
        success: false,
        message: "Channel not found",
      });
    }

    // Kiểm tra quyền truy cập
    const member = channel.members.find(
      (m) => m.userId._id.toString() === userId
    );
    if (!member) {
      return res.status(403).json({
        success: false,
        message: "You are not a member of this channel",
      });
    }

    res.status(200).json({
      success: true,
      message: "Channel details retrieved successfully",
      data: channel,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving channel details",
      error: error.message,
    });
  }
};

// Thay đổi role của member (chỉ dành cho admin)
const changeMemberRole = async (req, res) => {
  try {
    const { channelId, memberId } = req.params;
    const { role } = req.body;
    const userId = req.user._id.toString();

    if (!["admin", "member"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role. Must be 'admin' or 'member'",
      });
    }

    const channel = await channelModel.findOne({ channelId });
    if (!channel) {
      return res.status(404).json({
        success: false,
        message: "Channel not found",
      });
    }

    if (channel.type !== "group") {
      return res.status(400).json({
        success: false,
        message: "Cannot change roles in private channel",
      });
    }

    // Kiểm tra quyền
    const currentMember = channel.members.find(
      (m) => m.userId.toString() === userId
    );
    if (!currentMember || currentMember.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can change member roles",
      });
    }

    // Tìm member cần thay đổi role
    const targetMember = channel.members.find(
      (m) => m.userId.toString() === memberId
    );
    if (!targetMember) {
      return res.status(404).json({
        success: false,
        message: "Member not found in this group",
      });
    }

    // Không cho phép creator tự hạ cấp nếu là admin duy nhất
    if (userId === memberId && role === "member") {
      const admins = channel.members.filter((m) => m.role === "admin");
      if (admins.length === 1) {
        return res.status(400).json({
          success: false,
          message: "Cannot demote yourself as the last admin",
        });
      }
    }

    targetMember.role = role;
    await channel.save();
    await channel.populate("members.userId", "fullName avatar_url email");

    res.status(200).json({
      success: true,
      message: "Member role updated successfully",
      data: channel,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error changing member role",
      error: error.message,
    });
  }
};

// Cập nhật avatar của group channel
const updateGroupAvatar = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.user._id.toString();

    const channel = await channelModel.findOne({ channelId });
    if (!channel) {
      return res.status(404).json({
        success: false,
        message: "Channel not found",
      });
    }

    if (channel.type !== "group") {
      return res.status(400).json({
        success: false,
        message: "Cannot update avatar of private channel",
      });
    }

    // Kiểm tra quyền (chỉ admin mới được đổi avatar)
    const member = channel.members.find((m) => m.userId.toString() === userId);
    if (!member || member.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Only admins can update group avatar",
      });
    }
    const avatar = req.file.path;
    if (!avatar) {
      return res.status(400).json({
        success: false,
        message: "No avatar file uploaded",
      });
    }

    channel.avatar = avatar;
    await channel.save();

    res.status(200).json({
      success: true,
      message: "Group avatar updated successfully",
      data: channel,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error updating group avatar",
      error: error.message,
    });
  }
};

// Rời khỏi group channel
const leaveGroupChannel = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.user._id.toString();

    const channel = await channelModel.findOne({ channelId });
    if (!channel) {
      return res.status(404).json({
        success: false,
        message: "Channel not found",
      });
    }

    if (channel.type !== "group") {
      return res.status(400).json({
        success: false,
        message: "Cannot leave private channel",
      });
    }

    const member = channel.members.find((m) => m.userId.toString() === userId);
    if (!member) {
      return res.status(404).json({
        success: false,
        message: "You are not a member of this group",
      });
    }

    // Kiểm tra nếu là admin duy nhất
    const admins = channel.members.filter((m) => m.role === "admin");
    if (member.role === "admin" && admins.length === 1) {
      return res.status(403).json({
        success: false,
        message:
          "Cannot leave as the last admin. Transfer admin role first or delete the group.",
      });
    }

    // Xóa member khỏi group
    channel.members = channel.members.filter(
      (m) => m.userId.toString() !== userId
    );
    await channel.save();

    res.status(200).json({
      success: true,
      message: "Left group successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error leaving group",
      error: error.message,
    });
  }
};

// Lấy danh sách channel chat, tin nhắn giữa người dùng hiện tại và người khác
const getChannelChatList = async (req, res) => {
  try {
    const currentUserId = req.user._id;

    const channels = await channelModel
      .find({
        members: currentUserId,
      })
      .populate("members", "fullName avatar_url")
      .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      message: "Channels retrieved successfully",
      data: channels,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving channels",
      error: error.message,
    });
  }
};

// Get messages in a channel
const getChannelMessages = async (req, res) => {
  try {
    const { channelId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const userId = req.user._id;

    const skip = (page - 1) * parseInt(limit);

    // Lấy deletedAt của user trong channel
    const channel = await channelModel.findOne(
      { channelId, "members.userId": userId },
      { "members.$": 1 }
    );
    const deletedAt = channel?.members?.[0]?.deletedAt || null;

    // Tạo filter cho message
    const messageFilter = { channelId };
    if (deletedAt) {
      messageFilter.createdAt = { $gt: deletedAt };
    }

    // Đếm tổng số message theo filter
    const totalMessages = await messageModel.countDocuments(messageFilter);

    // Lấy message
    const messages = await messageModel
      .find(messageFilter)
      .populate("from", "fullName avatar_url")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      success: true,
      messages: messages.reverse(),
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalMessages / parseInt(limit)),
        totalMessages,
        hasMore: skip + messages.length < totalMessages,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

const muteGroupChat = async (req, res) => {
  try {
    const { channelId } = req.params;
    const { state } = req.body;
    const userId = req.user._id.toString();

    // Kiểm tra user có quyền truy cập channel không
    const channel = await channelModel.findOne({
      channelId,
      "members.userId": userId,
    });

    if (!channel) {
      return res.status(404).json({
        success: false,
        message: "Channel not found or access denied",
      });
    }

    await channelModel.updateOne(
      { channelId, "members.userId": userId },
      { $set: { "members.$.isMuted": state } }
    );

    res.status(200).json({
      success: true,
      message: "Update successfully",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error muting group",
      error: error.message,
    });
  }
};

// Lấy số tin nhắn chưa đọc của một channel cụ thể
const getChannelUnreadCount = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.user._id.toString();

    // Kiểm tra user có quyền truy cập channel không
    const channel = await channelModel.findOne({
      channelId,
      "members.userId": userId,
    });

    if (!channel) {
      return res.status(404).json({
        success: false,
        message: "Channel not found or access denied",
      });
    }

    // Đếm số tin nhắn chưa đọc
    const unreadCount = await messageModel.countDocuments({
      channelId,
      from: { $ne: userId }, // Không tính tin nhắn của chính user
      "readBy.userId": { $ne: userId }, // User chưa đọc
    });

    res.status(200).json({
      success: true,
      message: "Unread count retrieved successfully",
      data: { channelId, unreadCount },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving unread count",
      error: error.message,
    });
  }
};

// Lấy số tin nhắn chưa đọc của tất cả channels
const getAllChannelsUnreadCount = async (req, res) => {
  try {
    const userId = req.user._id.toString();

    // Lấy tất cả channels của user
    const channels = await channelModel.find({
      "members.userId": userId,
    });

    const unreadCounts = {};

    // Tính unread count cho từng channel
    await Promise.all(
      channels.map(async (channel) => {
        try {
          const unreadCount = await messageModel.countDocuments({
            channelId: channel.channelId,
            from: { $ne: userId },
            "readBy.userId": { $ne: userId },
          });
          unreadCounts[channel.channelId] = unreadCount;
        } catch (error) {
          console.error(
            `Error calculating unread for ${channel.channelId}:`,
            error
          );
          unreadCounts[channel.channelId] = 0;
        }
      })
    );

    res.status(200).json({
      success: true,
      message: "All channels unread counts retrieved successfully",
      data: unreadCounts,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving unread counts",
      error: error.message,
    });
  }
};

// Đánh dấu tất cả tin nhắn trong channel là đã đọc
const markChannelAsRead = async (req, res) => {
  try {
    const { channelId } = req.params;
    const userId = req.user._id.toString();

    // Kiểm tra user có quyền truy cập channel không
    const channel = await channelModel.findOne({
      channelId,
      "members.userId": userId,
    });

    if (!channel) {
      return res.status(404).json({
        success: false,
        message: "Channel not found or access denied",
      });
    }

    // Cập nhật tất cả tin nhắn chưa đọc thành đã đọc
    const result = await messageModel.updateMany(
      {
        channelId,
        from: { $ne: userId }, // Không update tin nhắn của chính user
        "readBy.userId": { $ne: userId }, // Chỉ update những tin nhắn chưa đọc
      },
      {
        $addToSet: {
          // Sử dụng $addToSet thay vì $push để tránh duplicate
          readBy: {
            userId: userId,
            readAt: new Date(),
          },
        },
      }
    );

    res.status(200).json({
      success: true,
      message: "Channel marked as read successfully",
      data: {
        channelId,
        messagesMarked: result.modifiedCount,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error marking channel as read",
      error: error.message,
    });
  }
};

const getUserOnlineStatus = async (req, res) => {
  try {
    const userId = req.user._id;

    const listIds = await channelModel.find(
      { members: { $elemMatch: { userId } } },
      { members: 1 }
    );

    if (!listIds || listIds.length === 0) return [];

    const listFriendIds = [
      ...new Set(
        listIds
          .flatMap((doc) => doc.members.map((m) => m.userId.toString()))
          .filter((id) => id !== userId.toString())
      ),
    ];

    // Dùng pipeline để check online
    const pipeline = redisClient.multi();
    listFriendIds.forEach((fid) => {
      pipeline.sIsMember("online_users", String(fid));
      pipeline.hGet("user:lastActive", fid);
    });

    const results = await pipeline.exec();

    const onlineStatuses = listFriendIds.map((fid, index) => ({
      friendId: fid,
      isOnline: results[index * 2] === 1,
      lastActive: results[index * 2 + 1] || null,
    }));

    res.status(200).json({
      success: true,
      message: "User online status retrieved successfully",
      data: { userId, onlineStatuses },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error retrieving user online status",
      error: error.message,
    });
  }
};

const deleteChat = async (req, res) => {
  const { channelId } = req.params;
  const userId = req.user._id;
  try {
    const channel = await channelModel.findOne({ channelId, "members.userId": userId });
    if (!channel) {
      return res.status(404).json({ success: false, message: "Channel not found" });
    }

    channel.members = channel.members.map((member) => {
      if (member.userId.toString() === userId.toString()) {
        return { ...member, isDelete: true, deletedAt: new Date() };
      }
      return member;
    });

    await channel.save();

    res.status(200).json({ success: true, message: "Chat deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error deleting chat", error: error.message });
  }
};

const restoreChat = async (req, res) => {
  const { channelId } = req.params;
  const userId = req.user._id;
  try {
    const channel = await channelModel.findOne({ channelId, "members.userId": userId });
    if (!channel) {
      return res.status(404).json({ success: false, message: "Channel not found" });
    }

    channel.members = channel.members.map((member) => {
      if (member.userId.toString() === userId.toString()) {
        return { ...member, isDelete: false };
      }
      return member;
    });

    await channel.save();

    res.status(200).json({ success: true, message: "Chat restored successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Error restoring chat", error: error.message });
  }
};

module.exports = {
  createPrivateChannel,
  createGroupChannel,
  updateGroupName,
  getChannelChatList,
  getChannelMessages,
  updateGroupAvatar,
  addMemberToGroup,
  removeMemberFromGroup,
  leaveGroupChannel,
  deleteGroupChannel,
  getUserChannels,
  getChannelDetails,
  changeMemberRole,
  getChannelUnreadCount,
  getAllChannelsUnreadCount,
  markChannelAsRead,
  getUserOnlineStatus,
  muteGroupChat,
  deleteChat,
  restoreChat
};
