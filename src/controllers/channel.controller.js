const channelModel = require("../models/Chat/channel.model");

// Tạo channel Private 1-1
const createPrivateChannel = async (req, res) => {
  try {
    const { userAId, userBId } = req.body;

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
    if (!channel) {
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
    const { name, memberIds, avatar } = req.body;
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
      })
      .populate("members.userId", "fullName avatar_url email")
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
    const { avatar } = req.body;
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
      return res.status(400).json({
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

module.exports = {
  createPrivateChannel,
  createGroupChannel,
  updateGroupName,
  updateGroupAvatar,
  addMemberToGroup,
  removeMemberFromGroup,
  leaveGroupChannel,
  deleteGroupChannel,
  getUserChannels,
  getChannelDetails,
  changeMemberRole,
};
