const Group = require("../models/Group/group.model");
const GroupMember = require("../models/Group/group_member.model");
const GroupRequest = require("../models/Group/group_request.model");
const notificationService = require("../services/notification.service");
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
        res.status(200).json({ groups: memberships.map(m => m.group) });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Lấy danh sách thành viên (Người ngoài có thể xem được thành viên)
const getGroupMembers = async (req, res) => {
    try {
        const { group_id } = req.params;
        const members = await GroupMember.find({ group: group_id, status: "approved" }).populate("user", "username");
        res.status(200).json({ members });
    } catch (err) {
        res.status(500).json({ error: err.message });
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
        const group = await Group.findById(group_id);
        if (!group) return res.status(404).json({ error: "Group not found" });
        res.status(200).json({ group });
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

        const requests = await GroupRequest.find({ group_id, status: "pending" }).populate("user_id", "username");
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

// Chỉnh sửa thông tin nhóm (chỉ admin)
const updateGroup = async (req, res) => {
    try {
        const { group_id } = req.params;
        const { name, description, privacy, cover_url, post_approval } = req.body;
        const admin_id = req.user._id;
        const isAdmin = await isGroupAdmin(group_id, admin_id);
        if (!isAdmin) return res.status(403).json({ error: "Permission denied" });

        const group = await Group.findByIdAndUpdate(
            group_id,
            { name, description, privacy, cover_url, post_approval },
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

        await Group.findByIdAndDelete(group_id);
        await GroupMember.deleteMany({ group: group_id });
        await GroupRequest.deleteMany({ group_id });
        res.status(200).json({ message: "Group deleted" });
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
            { group: group_id, user: user_id, status: "banned" },
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
        admin_id = req.user._id
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
        admin_id = req.user._id
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
    getbannedMemberList
};