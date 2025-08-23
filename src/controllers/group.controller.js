const Group = require("../models/Group/group.model");
const GroupMember = require("../models/Group/group_member.model");
const GroupRequest = require("../models/Group/group_request.model");
const GroupPost = require("../models/Group/group_post.model");
const Comment = require("../models/Comment_Reaction/comment.model");
const CommentReaction = require("../models/Comment_Reaction/comment_reactions.model");
const PostReaction = require("../models/Comment_Reaction/post_reaction.model");
const PostMedia = require("../models/postMedia.model");
const notificationService = require("../services/notification.service");
const { Types } = require('mongoose');
const { getSocketIO, getUserSocketMap } = require("../socket/io-instance");

// Hàm kiểm tra quyền admin trong group
const isGroupAdmin = async (group_id, user_id) => {
    const member = await GroupMember.findOne({
        group: group_id,
        user: user_id,
        role: "admin",
        status: "approved"
    });
    return !!member;
};

//Lấy thống kê nhóm (Thành viên và bài viết)
async function getGroupStats(groupId) {
    const [totalMembers, totalPosts, latestPost] = await Promise.all([
        GroupMember.countDocuments({ group: groupId, status: "approved" }),
        GroupPost.countDocuments({ group_id: groupId, status: "approved" }),
        GroupPost.findOne({
            group_id: groupId,
            status: "approved"
        })
            .sort({ created_at: -1 })
            .select('created_at')
    ]);
    // Nếu không có bài viết nào, sẽ dùng thời gian tạo nhóm làm fallback ở getMyGroups
    return {
        totalMembers,
        totalPosts,
        lastActivity: latestPost?.created_at || null
    };
}

// Tạo group mới
const createGroup = async (req, res) => {
    try {
        const { name, description, privacy } = req.body;
        const creator = req.user._id;

        // Lấy url cover từ file upload (nếu có)
        let cover_url = undefined;
        if (req.files && req.files.length > 0) {
            cover_url = req.files[0].path;
        }

        const group = await Group.create({ name, description, privacy, cover_url, creator });
        // Thêm creator vào group với vai trò admin
        await GroupMember.create({ group: group._id, user: creator, role: "admin", status: "approved" });
        res.status(201).json({ message: "Group created", group });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Lấy danh sách group user đã tham gia
const getMyGroups = async (req, res) => {
    try {
        const user_id = req.user._id;
        const memberships = await GroupMember.find({ user: user_id, status: "approved" }).populate("group");
        if (!memberships.length) {
            return res.status(200).json({ message: "You haven't joined any groups yet", groups: [] });
        }
        const groupsWithStats = await Promise.all(
            memberships.map(async m => {
                const stats = await getGroupStats(m.group._id);
                return {
                    ...m.group.toObject(),
                    role: m.role,
                    ...stats,
                    lastActivity: stats.lastActivity || m.group.created_at
                };
            })
        );
        res.status(200).json({ groups: groupsWithStats });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Lấy danh sách thành viên (Người ngoài có thể xem được thành viên)
const getGroupMembers = async (req, res) => {
  try {
    const { group_id } = req.params;
    if (!Types.ObjectId.isValid(group_id)) {
      return res.status(400).json({ error: 'group_id không hợp lệ' });
    }

    const {
      search,
      roles,
      sort = 'role,-postCount,name',
      minViolations,
      maxViolations,
      skip,
      limit
    } = req.query;

    // parse roles
    const roleArr = roles
      ? String(roles).split(',').map(s => s.trim()).filter(Boolean)
      : null;

    // parse sort "role,-postCount,name" -> sortObj cho $sort
    const toSortObj = (s) => {
      const map = {
        role: 'roleWeight',
        name: 'user.fullName',
        username: 'user.username',
        postCount: 'postCount'
      };
      return String(s).split(',').reduce((acc, key) => {
        key = key.trim();
        if (!key) return acc;
        const dir = key.startsWith('-') ? -1 : 1;
        const field = key.replace(/^-/, '');
        acc[map[field] || field] = dir;
        return acc;
      }, {});
    };
    const sortObj = toSortObj(sort);
    const defaultSort = { roleWeight: 1, postCount: -1, 'user.fullName': 1 };

    // base filter
    const matchStage = {
      group: new Types.ObjectId(group_id),
      status: 'approved',
      is_removed: { $ne: true }
    };
    if (roleArr?.length) matchStage.role = { $in: roleArr };
    if (minViolations !== undefined) {
      matchStage.count_violations = {
        ...(matchStage.count_violations || {}),
        $gte: Number(minViolations)
      };
    }
    if (maxViolations !== undefined) {
      matchStage.count_violations = {
        ...(matchStage.count_violations || {}),
        $lte: Number(maxViolations)
      };
    }

    const pipeline = [
      { $match: matchStage },

      { 
        $lookup: { 
          from: 'users', 
          localField: 'user', 
          foreignField: '_id', 
          as: 'user',
          pipeline: [
            {
              $project: {
                _id: 1,
                username: 1,
                fullName: 1,
                avatar_url: 1
              }
            }
          ]
        } 
      },
      { $unwind: '$user' },

      // Search theo tên / username (không phân biệt hoa thường)
      ...(search ? [{
        $match: {
          $or: [
            { 'user.fullName': { $regex: search, $options: 'i' } },
            { 'user.username': { $regex: search, $options: 'i' } }
          ]
        }
      }] : []),

      // Lookup đếm bài đã duyệt của user trong group
      {
        $lookup: {
          from: 'groupposts', // collection mặc định của model GroupPost
          let: { uid: '$user._id', gid: '$group' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$user_id', '$$uid'] },
                    { $eq: ['$group_id', '$$gid'] }
                  ]
                },
                status: 'approved',
                is_deleted: false
              }
            },
            { $count: 'count' }
          ],
          as: 'postStats'
        }
      },

      // Tính postCount & roleWeight (admin trước)
      {
        $addFields: {
          postCount: { $ifNull: [{ $arrayElemAt: ['$postStats.count', 0] }, 0] },
          roleWeight: {
            $switch: {
              branches: [{ case: { $eq: ['$role', 'admin'] }, then: 0 }],
              default: 1 // member
            }
          }
        }
      },

      // Sort
      { $sort: Object.keys(sortObj).length ? sortObj : defaultSort },
      
      {
        $project: {
          postStats: 0,
          '__v': 0
        }
      },

      // Phân trang (nếu truyền)
      ...(skip ? [{ $skip: Number(skip) }] : []),
      ...(limit ? [{ $limit: Number(limit) }] : [])
    ];

    const members = await GroupMember.aggregate(pipeline)
      .collation({ locale: 'vi', strength: 1 }) // sort tên có dấu
      .exec();

    return res.status(200).json({ members });
  } catch (err) {
    console.error('getGroupMembers error:', err);
    return res.status(500).json({ error: err.message });
  }
};

// Gửi yêu cầu tham gia group (nếu private)
const requestJoinGroup = async (req, res) => {
    try {
        const { group_id } = req.body;
        const user_id = req.user._id;
        const group = await Group.findById(group_id);
        if (!group) return res.status(404).json({ error: "Group not found" });

        // Kiểm tra đã là thành viên chưa
        const isMember = await GroupMember.findOne({ group: group_id, user: user_id, status: "approved", is_banned: false });
        if (isMember) {
            return res.status(400).json({ error: "Already a member of this group" });
        }
        // Kiểm tra đã bị ban chưa
        const isBanned = await GroupMember.findOne({ group: group_id, user: user_id, status: "banned" });
        if (isBanned) {
            return res.status(403).json({ error: "You are banned from this group, can't join again." });
        }
        // Kiểm tra đã gửi request chưa
        const existingRequest = await GroupRequest.findOne({ group_id, user_id, status: "pending" });
        if (existingRequest) {
            return res.status(400).json({ error: "Request sent, please wait" });
        }

        // Nếu public thì vào luôn
        if (group.privacy === "Public") {
            await GroupMember.create({ group: group_id, user: user_id, role: "member", status: "approved" });
            return res.status(200).json({ message: "Joined group" });
        }

        // Nếu private thì gửi request
        await GroupRequest.findOneAndUpdate(
            { group_id, user_id },
            { status: "pending", requested_at: new Date() },
            { upsert: true, new: true }
        );
        res.status(200).json({ message: "Join request sent" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Rời group
const leaveGroup = async (req, res) => {
    try {
        const { group_id } = req.body;
        const user_id = req.user._id;

        // Kiểm tra thành viên có trong group không
        const member = await GroupMember.findOne({ group: group_id, user: user_id });
        if (!member) {
            return res.status(400).json({ error: "You are not a member of this group." });
        }

        // Nếu là admin thì không cho phép rời nhóm
        if (member.role === "admin") {
            return res.status(403).json({ error: "Admins cannot leave the group. Please transfer admin rights to someone else first." });
        }

        await GroupMember.findOneAndDelete({ group: group_id, user: user_id });
        res.status(200).json({ message: "Left group" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Lấy toàn bộ danh sách group
const getAllGroups = async (req, res) => {
    try {
        const groups = await Group.find();
        res.status(200).json({ groups });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Lấy thông tin chi tiết nhóm
const getGroupDetail = async (req, res) => {
    try {
        const { group_id } = req.params;
        const user_id = req.user._id;

        const group = await Group.findById(group_id);
        if (!group) return res.status(404).json({ error: "Group not found" });

        // Lấy thống kê nhóm (members và posts)
        const stats = await getGroupStats(group_id);

        let isJoined = false;
        let isAdmin = false;

        // Kiểm tra trạng thái tham gia và quyền admin (chỉ khi đã đăng nhập)
        if (user_id) {
            const membership = await GroupMember.findOne({
                group: group_id,
                user: user_id,
                status: "approved"
            });

            if (membership) {
                isJoined = true;
                isAdmin = membership.role === "admin";
            }
        }

        res.status(200).json({
            group: {
                ...group.toObject(),
                totalMembers: stats.totalMembers,
                totalPosts: stats.totalPosts,
                lastActivity: stats.lastActivity,
                isJoined,
                isAdmin
            },

        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Duyệt hoặc từ chối yêu cầu tham gia nhóm (chỉ admin)
const handleJoinRequest = async (req, res) => {
    try {
        const { request_id } = req.params;
        const { action } = req.body; // "approved" hoặc "rejected"
        const admin_id = req.user._id;

        if (!["approved", "rejected"].includes(action)) {
            return res.status(400).json({ error: "Invalid action" });
        }
        const request = await GroupRequest.findById(request_id);
        if (!request) return res.status(404).json({ error: "Request not found" });

        // Kiểm tra quyền admin
        const isAdmin = await isGroupAdmin(request.group_id, admin_id);
        if (!isAdmin) return res.status(403).json({ error: "Permission denied" });

        request.status = action;
        request.handled_at = new Date();
        await request.save();

        if (action === "approved") {
            await GroupMember.create({
                group: request.group_id,
                user: request.user_id,
                role: "member",
                status: "approved"
            });

            // Gửi thông báo cho người dùng
            try {
                const io = getSocketIO();
                const userSocketMap = getUserSocketMap();
                const group = await Group.findById(request.group_id);
                await notificationService.createNotification(
                    io,
                    request.user_id,
                    "group_join_approved",
                    `Yêu cầu tham gia nhóm "${group.name}" của bạn đã được duyệt.`,
                    userSocketMap
                );
            } catch (notifyErr) {
                console.error("Không thể gửi thông báo duyệt nhóm:", notifyErr);
            }
        }
        res.status(200).json({ message: `Request ${action}` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Lấy danh sách người chờ duyệt (chỉ admin)
const getPendingRequests = async (req, res) => {
    try {
        const { group_id } = req.params;
        const admin_id = req.user._id;
        const isAdmin = await isGroupAdmin(group_id, admin_id);
        if (!isAdmin) return res.status(403).json({ error: "Permission denied" });

        const requests = await GroupRequest.find({ group_id, status: "pending" }).populate("user_id", "username fullName avatar_url");
        res.status(200).json({ requests });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Gán hoặc hạ quyền quản trị (chỉ creator group)
const changeMemberRole = async (req, res) => {
    try {
        const { group_id, user_id, role } = req.body; // "admin" hoặc "member"
        const requester_id = req.user._id;
        if (!["admin", "member"].includes(role)) {
            return res.status(400).json({ error: "Invalid role" });
        }

        // Lấy group để kiểm tra creator
        const group = await Group.findById(group_id);
        if (!group) return res.status(404).json({ error: "Group not found" });

        // Chỉ creator mới có quyền này
        if (group.creator.toString() !== requester_id.toString()) {
            return res.status(403).json({ error: "Chỉ người tạo nhóm mới có quyền thay đổi quyền quản trị." });
        }

        // Không cho phép creator tự hạ quyền chính mình
        if (role === "member" && user_id.toString() === requester_id.toString()) {
            return res.status(400).json({ error: "Cannot demote creator." });
        }

        const member = await GroupMember.findOneAndUpdate(
            { group: group_id, user: user_id },
            { role },
            { new: true }
        );
        if (!member) return res.status(404).json({ error: "Member not found" });
        res.status(200).json({ message: "Role updated", member });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Tự hạ quyền bản thân (nếu là admin) || Chuyển đổi quyền Creator cho 1 admin khác
const demoteOrTransferCreator = async (req, res) => {
    try {
        const { group_id, action, new_creator_id } = req.body; // action: "demote" hoặc "transfer_creator"
        const current_user_id = req.user._id;

        if (!["demote", "transfer_creator"].includes(action)) {
            return res.status(400).json({ error: "Invalid action. Use 'demote' or 'transfer_creator'" });
        }

        // Lấy group và kiểm tra
        const group = await Group.findById(group_id);
        if (!group) return res.status(404).json({ error: "Group not found" });

        // Lấy thông tin member hiện tại
        const currentMember = await GroupMember.findOne({ 
            group: group_id, 
            user: current_user_id, 
            status: "approved" 
        });
        if (!currentMember) return res.status(404).json({ error: "You are not a member of this group" });

        // 1. Tự hạ quyền (admin → member)
        if (action === "demote") {
            if (currentMember.role !== "admin") {
                return res.status(400).json({ error: "You are not an admin" });
            }

            // Creator không thể tự hạ quyền
            if (group.creator.toString() === current_user_id.toString()) {
                return res.status(400).json({ error: "Creator cannot demote themselves. Transfer creator role first." });
            }

            // Hạ quyền từ admin → member
            currentMember.role = "member";
            await currentMember.save();

            return res.status(200).json({ 
                message: "Successfully demoted yourself to member", 
                member: currentMember 
            });
        }

        // 2. Chuyển quyền Creator (chỉ creator mới làm được)
        if (action === "transfer_creator") {
            if (group.creator.toString() !== current_user_id.toString()) {
                return res.status(403).json({ error: "Only the current creator can transfer creator role" });
            }

            if (!new_creator_id) {
                return res.status(400).json({ error: "new_creator_id is required for transfer_creator action" });
            }

            // Kiểm tra người nhận có phải admin không
            const newCreatorMember = await GroupMember.findOne({
                group: group_id,
                user: new_creator_id,
                role: "admin",
                status: "approved"
            });

            if (!newCreatorMember) {
                return res.status(400).json({ error: "New creator must be an admin member of the group" });
            }

            // Chuyển creator trong Group model
            group.creator = new_creator_id;
            await group.save();

            // Current creator vẫn giữ role admin (không tự động hạ quyền)
            
            return res.status(200).json({ 
                message: "Creator role transferred successfully", 
                newCreator: new_creator_id,
                group 
            });
        }

    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Chỉnh sửa thông tin nhóm (chỉ admin)
const updateGroup = async (req, res) => {
    try {
        const { group_id } = req.params;
        const { name, description, privacy, post_approval } = req.body;
        const admin_id = req.user._id;
        const isAdmin = await isGroupAdmin(group_id, admin_id);
        if (!isAdmin) return res.status(403).json({ error: "Permission denied" });

        // Xử lý cover_url từ file upload (nếu có)
        let updateData = { name, description, privacy, post_approval };

        if (req.files && req.files.length > 0) {
            updateData.cover_url = req.files[0].path;
        }

        const group = await Group.findByIdAndUpdate(
            group_id,
            updateData,
            { new: true, runValidators: true }
        );
        if (!group) return res.status(404).json({ error: "Group not found" });
        res.status(200).json({ message: "Group updated", group });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Xóa nhóm (chỉ admin)
const deleteGroup = async (req, res) => {
    try {
        const { group_id } = req.params;
        const admin_id = req.user._id;
        const isAdmin = await isGroupAdmin(group_id, admin_id);
        if (!isAdmin) return res.status(403).json({ error: "Permission denied" });

        // 1. Lấy tất cả post IDs của group
        const groupPosts = await GroupPost.find({ group_id }).select('_id');
        const postIds = groupPosts.map(post => post._id);

        // 2. Lấy tất cả comment IDs từ các group posts
        const comments = await Comment.find({ 
            postgr_id: { $in: postIds } 
        }).select('_id');
        const commentIds = comments.map(comment => comment._id);

        // 3. Xóa tất cả dữ liệu liên quan theo thứ tự đúng
        await Promise.all([
            // 3a. Xóa comment reactions trước
            CommentReaction.deleteMany({ 
                comment_id: { $in: commentIds } 
            }),
            
            // 3b. Xóa post reactions
            PostReaction.deleteMany({ 
                postgr_id: { $in: postIds } 
            }),
            
            // 3c. Xóa media của posts
            PostMedia.deleteMany({ 
                postgr_id: { $in: postIds } 
            }),
        ]);

        // 4. Xóa comments (sau khi đã xóa reactions)
        await Comment.deleteMany({ 
            postgr_id: { $in: postIds } 
        });

        // 5. Xóa group posts (sau khi đã xóa comments và reactions)
        await GroupPost.deleteMany({ group_id });

        // 6. Xóa members và requests
        await Promise.all([
            GroupMember.deleteMany({ group: group_id }),
            GroupRequest.deleteMany({ group_id }),
        ]);

        // 7. Cuối cùng xóa group
        await Group.findByIdAndDelete(group_id);

        res.status(200).json({ message: "Group and all related data deleted successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Ban thành viên khỏi nhóm (chỉ admin)
const banMember = async (req, res) => {
    try {
        const { group_id, user_id, ban_reason } = req.body;
        const admin_id = req.user._id;
        const isAdmin = await isGroupAdmin(group_id, admin_id);
        if (!isAdmin) return res.status(403).json({ error: "Permission denied" });

        const targetMember = await GroupMember.findOne({ group: group_id, user: user_id });
        if (!targetMember) return res.status(404).json({ error: "Member not found" });
        if (targetMember.role === "admin") {
            return res.status(403).json({ error: "Need to demote before banning" });
        }

        const member = await GroupMember.findOneAndUpdate(
            { group: group_id, user: user_id },
            {
                status: "banned",
                banned_at: new Date(),
                ban_reason: ban_reason || null,
                is_removed: true,
            },
            { new: true }
        );
        if (!member) return res.status(404).json({ error: "Member not found" });

        // Gửi thông báo cho user bị ban
        try {
            const io = getSocketIO();
            const userSocketMap = getUserSocketMap();
            const group = await Group.findById(group_id);
            await notificationService.createNotification(
                io,
                user_id,
                "group_banned",
                `Bạn đã bị cấm khỏi nhóm "${group.name}".${ban_reason ? " Lý do: " + ban_reason : ""}`,
                userSocketMap
            );
        } catch (notifyErr) {
            console.error("Không thể gửi thông báo ban nhóm:", notifyErr);
        }

        res.status(200).json({ message: "Member banned", member });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Gỡ Ban thành viên (chỉ admin)
const unbanMember = async (req, res) => {
    try {
        const { group_id, user_id } = req.body;
        const admin_id = req.user._id;
        const isAdmin = await isGroupAdmin(group_id, admin_id);
        if (!isAdmin) return res.status(403).json({ error: "Permission denied" });

        const member = await GroupMember.findOneAndDelete({
            group: group_id,
            user: user_id,
            status: "banned",
            is_removed: true
        });
        if (!member) return res.status(404).json({ error: "Member not found" });
        res.status(200).json({ message: "Member unbanned", member });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

//Hạn chế thành viên đăng bài
const restrictMember = async (req, res) => {
    try {
        const { group_id, user_id, days, restrict_reason } = req.body;
        const admin_id = req.user._id
        const isAdmin = await isGroupAdmin(group_id, admin_id);
        if (!isAdmin) return res.status(403).json({ error: "Pemission denied" })
        if (!days || days <= 0) return res.status(400).json({ error: "Invalid days" })

        const until = new Date()
        until.setDate(until.getDate() + days)

        const member = await GroupMember.findOneAndUpdate(
            { group: group_id, user: user_id, status: "approved" },
            {
                restrict_post_until: until,
                restrict_reason: restrict_reason || null
            },
            { new: true }
        );

        if (!member) return res.status(404).json({ error: "Member not found" })
        // Gửi thông báo cho user bị hạn chế

        try {
            const io = getSocketIO();
            const userSocketMap = getUserSocketMap();
            const group = await Group.findById(group_id);
            await notificationService.createNotification(
                io,
                user_id,
                "group_restricted",
                `Bạn đã bị hạn chế đăng bài trong nhóm "${group.name}".${restrict_reason ? " Lý do: " + restrict_reason : ""}`,
                userSocketMap
            );
        } catch (notifyErr) {
            console.error("Không thể gửi thông báo hạn chế nhóm:", notifyErr);
        }
        res.status(200).json({ message: "Member restricted from posting", member })
    } catch (error) {
        res.status(500).json({ error: err.message });
    }
}

//Lấy danh sách thành viên bị hạn chế
const getRestrictMemberList = async (req, res) => {
    try {
        const { group_id } = req.params
        const admin_id = req.user._id
        const isAdmin = await isGroupAdmin(group_id, admin_id);
        if (!isAdmin) return res.status(403).json({ error: "Pemission denied" })

        const members = await GroupMember.find({
            group: group_id,
            restrict_post_until: { $ne: null },
            status: "approved",
        }).populate("user", "username avatar_url")
        res.status(200).json({ members })
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

// Lấy danh sách thành viên bị ban
const getbannedMemberList = async (req, res) => {
    try {
        const { group_id } = req.params
        const admin_id = req.user._id
        const isAdmin = await isGroupAdmin(group_id, admin_id);
        if (!isAdmin) return res.status(403).json({ error: "Pemission denied" })

        const members = await GroupMember.find({
            group: group_id,
            status: "banned",
            is_removed: true
        }).populate("user", "username avatar_url")
        res.status(200).json({ members })
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

// Lấy danh sách group đã tham gia theo user_id
const getUserGroups = async (req, res) => {
    try {
        const user_id = req.params.user_id;
        const memberships = await GroupMember.find({
          user: user_id,
          status: "approved",
        }).populate("group");
        if (!memberships.length) {
          return res
            .status(200)
            .json({ message: "You haven't joined any groups yet", groups: [] });
        }
        const groupsWithStats = await Promise.all(
          memberships.map(async (m) => {
            const stats = await getGroupStats(m.group._id);
            return {
              ...m.group.toObject(),
              role: m.role,
              ...stats,
              lastActivity: stats.lastActivity || m.group.created_at,
            };
          })
        );
        res.status(200).json({ groups: groupsWithStats });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    createGroup,
    getMyGroups,
    requestJoinGroup,
    leaveGroup,
    getAllGroups,
    getGroupDetail,
    handleJoinRequest,
    getPendingRequests,
    getGroupMembers,
    changeMemberRole,
    updateGroup,
    deleteGroup,
    banMember,
    unbanMember,
    restrictMember,
    getRestrictMemberList,
    getbannedMemberList,
    demoteOrTransferCreator
};