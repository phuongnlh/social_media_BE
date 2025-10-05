const GroupPost = require("../models/Group/group_post.model");
const Media = require("../models/media.model");
const Group = require("../models/Group/group.model");
const PostMedia = require("../models/postMedia.model");
const GroupMember = require("../models/Group/group_member.model");
const Post = require("../models/post.model");
const PostReaction = require("../models/Comment_Reaction/post_reaction.model");
const mongoose = require("mongoose");
const User = require("../models/user.model");
const notificationService = require("../services/notification.service");
const GroupPostReport = require("../models/Group/group_postReport.model");
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

// Tạo bài viết trong group
const createGroupPost = async (req, res) => {
    try {
        const { group_id, content } = req.body;
        const user_id = req.user._id;

        // Kiểm tra user là thành viên group
        const member = await GroupMember.findOne({ group: group_id, user: user_id, status: "approved" });
        if (!member) return res.status(403).json({ error: "Bạn không phải thành viên nhóm này." });

        // Kiểm tra hạn chế đăng bài
        if (
            member.restrict_post_until &&
            new Date(member.restrict_post_until) > new Date()
        ) {
            return res.status(403).json({
                error: "Bạn đang bị hạn chế đăng bài đến " + member.restrict_post_until,
                restrict_reason: member.restrict_reason
            });
        }
        // Lấy group để kiểm tra post_approval
        const group = await Group.findById(group_id);
        if (!group) return res.status(404).json({ error: "Group not found" });

        // Kiểm tra quyền admin
        const isAdmin = await isGroupAdmin(group_id, user_id);

        // Xác định trạng thái post
        let status = "approved";
        if (group.post_approval && !isAdmin) {
            status = "pending";
        }

        // Tạo post với status phù hợp
        const groupPost = await GroupPost.create({ group_id, user_id, content, status });

        // Xử lý media upload
        const files = req.files || [];
        const mediaIds = [];
        for (const file of files) {
            const media = await Media.create({
                user_id,
                url: file.path,
                media_type: file.mimetype.startsWith("video") ? "video" : "image",
            });
            mediaIds.push(media._id);
        }

        if (mediaIds.length > 0) {
            await PostMedia.create({
                type: "post_group",
                postgr_id: groupPost._id,
                media_id: mediaIds
            });
        }

        if (status === "pending") {
            return res.status(201).json({ message: "Bài viết của bạn đang chờ duyệt", postId: groupPost._id });
        }
        res.status(201).json({ message: "Group post created", postId: groupPost._id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Lấy tất cả bài viết trong group
const getAllPostsInGroup = async (req, res) => {
    try {
        const { group_id } = req.params;

        // Chỉ lấy bài viết đã duyệt và chưa xóa
        const query = { group_id, is_deleted: false, status: "approved" };

        const posts = await GroupPost.find(query)
            .sort({ created_at: -1 })
            .populate("user_id", "username fullName avatar_url")
            .lean();

        const populatedPosts = await Promise.all(
            posts.map(async (post) => {
                const postMedia = await PostMedia.findOne({ postgr_id: post._id }).populate("media_id");
                let media = [];
                if (postMedia && postMedia.media_id && postMedia.media_id.length > 0) {
                    media = postMedia.media_id.map((m) => ({
                        url: m.url,
                        type: m.media_type,
                    }));
                }
                return {
                    ...post,
                    media,
                };
            })
        );

        res.json(populatedPosts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Lấy chi tiết 1 bài viết trong group
const getGroupPostById = async (req, res) => {
    try {
        const { post_id } = req.params;
        const user_id = req.user._id;

        const post = await GroupPost.findById(post_id)
            .populate("user_id", "username")
            .lean();
        if (!post || post.is_deleted) return res.status(404).json({ message: "Post not found" });

        // Kiểm tra quyền admin
        const isAdmin = await isGroupAdmin(post.group_id, user_id);

        // Nếu không phải admin và không phải chủ bài viết, chỉ xem được bài đã duyệt
        if (!isAdmin && String(post.user_id._id) !== String(user_id) && post.status !== "approved") {
            return res.status(403).json({ message: "You are not allowed to view this post" });
        }

        const postMedia = await PostMedia.findOne({ postgr_id: post._id }).populate("media_id");
        let media = [];
        if (postMedia && postMedia.media_id && postMedia.media_id.length > 0) {
            media = postMedia.media_id.map((m) => ({
                url: m.url,
                type: m.media_type,
            }));
        }

        res.json({ ...post, media });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Chỉnh sửa bài viết trong group (chỉ chủ post)
const updateGroupPost = async (req, res) => {
    try {
        const { post_id } = req.params;
        const { content } = req.body;
        const user_id = req.user._id;

        const post = await GroupPost.findOne({ _id: post_id, user_id });
        if (!post) return res.status(404).json({ message: "Post not found or unauthorized" });

        post.content = content || post.content;
        post.updated_at = new Date();
        await post.save();

        res.json({ message: "Post updated successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Xóa mềm bài viết trong group (chỉ chủ post)
const softDeleteGroupPost = async (req, res) => {
    try {
        const { post_id } = req.params;
        const user_id = req.user._id;

        const post = await GroupPost.findOne({ _id: post_id, user_id, is_deleted: false });
        if (!post) return res.status(404).json({ message: "Post not found or already deleted" });

        post.is_deleted = true;
        post.deleted_at = new Date();
        await post.save();

        res.json({ message: "Post moved to trash." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Khôi phục bài viết đã xóa mềm (chỉ chủ post)
const restoreGroupPost = async (req, res) => {
    try {
        const { post_id } = req.params;
        const user_id = req.user._id;

        const post = await GroupPost.findOne({ _id: post_id, user_id, is_deleted: true });
        if (!post) return res.status(404).json({ message: "Post not found or not in trash" });

        post.is_deleted = false;
        post.deleted_at = null;
        await post.save();

        res.json({ message: "Post restored successfully." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Chia sẻ bài viết trong group lên tường cá nhân
const shareGroupPostToWall = async (req, res) => {
    try {
        const { group_post_id, content, type } = req.body;
        const userId = req.user._id;

        // Lấy group post và group
        const groupPost = await GroupPost.findById(group_post_id);
        if (!groupPost || groupPost.is_deleted) {
            return res.status(404).json({ message: "Group post not found or deleted" });
        }

        const group = await Group.findById(groupPost.group_id);
        if (!group) {
            return res.status(404).json({ message: "Group not found" });
        }

        // 1. Nếu group public => cho share
        if (group.privacy === "public") {
            const sharedPost = await Post.create({
                user_id: userId,
                content: content || "",
                type: type || "Public",
                shared_post_id: group_post_id, // trỏ tới GroupPost
            });

            // Gửi thông báo cho chủ post group
            try {
                // kiểm tra xem người dùng có phải là chủ bài viết không
                if (groupPost.user_id.toString() !== userId.toString()) {
                    const io = getSocketIO();
                    const userSocketMap = getUserSocketMap();
                    const sharer = await User.findById(userId);
                    await notificationService.createNotification(
                        io,
                        groupPost.user_id,
                        "group_post_shared",
                        `${sharer.username} đã chia sẻ bài viết của bạn trong nhóm "${group.name}".`,
                        userSocketMap
                    );
                }
            } catch (error) {
                console.error("Không thể gửi thông báo share group post:", error);
            }
            return res.status(201).json({ message: "Shared group post to wall", postId: sharedPost._id });
        }

        // 2. Nếu group private => không cho share
        if (group.privacy === "Private") {
            return res.status(403).json({ message: "Cannot share post from a private group" });
        }
        return res.status(400).json({ message: "Unsupported group privacy type" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Lấy feed bài viết từ tất cả group mà user đã tham gia
const getGroupFeed = async (req, res) => {
    try {
        const user_id = req.user._id;
        const page = parseInt(req.query.page) > 0 ? parseInt(req.query.page) : 1;
        const limit = parseInt(req.query.limit) > 0 ? parseInt(req.query.limit) : 10;
        const skip = (page - 1) * limit;

        // Lấy danh sách group user đã tham gia
        const memberships = await GroupMember.find({ user: user_id, status: "approved" }).select("group");
        const groupIds = memberships.map(m => m.group);

        if (!groupIds.length) {
            return res.json({ posts: [], total: 0, page, limit });
        }

        // Query tổng số lượng post
        const total = await GroupPost.countDocuments({
            group_id: { $in: groupIds },
            is_deleted: false,
            $or: [
                { status: "approved" },
                { user_id: user_id }
            ]
        });

        // Lấy post, populate group name và user fullname
        const posts = await GroupPost.find({
            group_id: { $in: groupIds },
            is_deleted: false,
            $or: [
                { status: "approved" },
                { user_id: user_id }
            ]
        })
            .sort({ created_at: -1 })
            .skip(skip)
            .limit(limit)
            .populate([
                { path: "user_id", select: "username fullName avatar_url" },
                { path: "group_id", select: "name" }
            ])
            .lean();

        // Lấy media cho từng post
        const populatedPosts = await Promise.all(
            posts.map(async (post) => {
                const postMedia = await PostMedia.findOne({ postgr_id: post._id }).populate("media_id");
                let media = [];
                if (postMedia && postMedia.media_id && postMedia.media_id.length > 0) {
                    media = postMedia.media_id.map((m) => ({
                        url: m.url,
                        type: m.media_type,
                    }));
                }
                return {
                    ...post,
                    group_name: post.group_id?.name || "",
                    user_fullname: post.user_id?.fullname || "",
                    media,
                };
            })
        );

        res.json({ posts: populatedPosts, total, page, limit });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Admin duyệt bài viết trong group
const approveGroupPost = async (req, res) => {
    try {
        const { post_id } = req.params;
        const { action, violation } = req.body; // "approve" hoặc "reject" || violation : true/false (Đánh dấu vi phạm nếu reject)
        const admin_id = req.user._id;

        // Tìm bài viết
        const post = await GroupPost.findById(post_id);
        if (!post || post.is_deleted) {
            return res.status(404).json({ message: "Post not found" });
        }

        // Kiểm tra quyền admin
        const isAdmin = await isGroupAdmin(post.group_id, admin_id);
        if (!isAdmin) {
            return res.status(403).json({ message: "Only admin can approve/reject posts" });
        }

        if (post.status !== "pending") {
            return res.status(400).json({ message: "Post is not pending approval" });
        }
        let notiContent = "";
        let notiType = "";
        const group = await Group.findById(post.group_id);
        const groupName = group.name;

        if (action === "approve") {
            post.status = "approved";
            post.approved_by = admin_id;
            post.approved_at = new Date();
            notiType = "group_post_approved";
            notiContent = `Bài viết của bạn trong nhóm "${groupName}" đã được duyệt.`;
        } else if (action === "reject") {
            post.status = "rejected";
            post.approved_by = admin_id;
            post.approved_at = new Date();
            notiType = "group_post_rejected";
            notiContent = `Bài viết của bạn trong nhóm "${groupName}" đã bị từ chối.`;

            if (violation === "true") {
                await GroupMember.findOneAndUpdate(
                    { group: post.group_id, user: post.user_id },
                    { $inc: { count_violations: 1 } }
                );
                notiContent += " Bài viết bị đánh dấu vi phạm.";
            }

        } else {
            return res.status(400).json({ message: "Invalid action" });
        }

        await post.save();

        // Gửi thông báo cho user
        try {
            const io = getSocketIO();
            const userSocketMap = getUserSocketMap();
            const group = await Group.findById(post.group_id);
            await notificationService.createNotification(
                io,
                post.user_id,
                notiType,
                `${notiContent}`,
                userSocketMap
            );
        } catch (notifyErr) {
            console.error("Không thể gửi thông báo duyệt/từ chối bài viết:", notifyErr);
        }
        res.json({ message: `Post ${action}d successfully` });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Lấy danh sách bài viết chờ duyệt trong group (dành cho admin)
const getPendingPostsInGroup = async (req, res) => {
    try {
        const { group_id } = req.params;
        const user_id = req.user._id;

        // Kiểm tra quyền admin
        const isAdmin = await isGroupAdmin(group_id, user_id);
        if (!isAdmin) {
            return res.status(403).json({ message: "Only admin can view pending posts" });
        }

        const posts = await GroupPost.find({ group_id, status: "pending", is_deleted: false })
            .sort({ created_at: -1 })
            .populate("user_id", "username fullName avatar_url")
            .lean();

        const populatedPosts = await Promise.all(
            posts.map(async (post) => {
                const postMedia = await PostMedia.findOne({ postgr_id: post._id }).populate("media_id");
                let media = [];
                if (postMedia && postMedia.media_id && postMedia.media_id.length > 0) {
                    media = postMedia.media_id.map((m) => ({
                        url: m.url,
                        type: m.media_type,
                    }));
                }
                return {
                    ...post,
                    media,
                };
            })
        );

        res.json(populatedPosts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Report bài viết trong group
const reportGroupPost = async (req, res) => {
    try {
        const { post_id } = req.params;
        const { reason, description } = req.body;
        const user_id = req.user._id;

        // Kiểm tra bài viết tồn tại
        const post = await GroupPost.findById(post_id);
        if (!post || post.is_deleted) {
            return res.status(404).json({ message: "Post not found" });
        }

        // Kiểm tra user có phải thành viên group không
        const member = await GroupMember.findOne({
            group: post.group_id,
            user: user_id,
            status: "approved"
        });
        if (!member) {
            return res.status(403).json({ error: "Bạn không phải thành viên nhóm này." });
        }

        // Không cho phép report bài viết của chính mình
        if (post.user_id.toString() === user_id.toString()) {
            return res.status(400).json({ message: "Không thể report bài viết của chính mình" });
        }

        // Kiểm tra đã report chưa (unique index sẽ tự động prevent duplicate)
        const existingReport = await GroupPostReport.findOne({
            group_post_id: post_id,
            reporter_id: user_id
        });
        if (existingReport) {
            return res.status(400).json({ message: "Bạn đã báo cáo bài viết này rồi" });
        }

        // Tạo report mới
        await GroupPostReport.create({
            group_post_id: post_id,
            group_id: post.group_id,
            reporter_id: user_id,
            reason,
            description
        });
        res.json({
            message: "Đã báo cáo bài viết thành công",
        });
    } catch (err) {
        console.error("Report error:", err);
        if (err.code === 11000) {
            return res.status(400).json({ message: "Bạn đã báo cáo bài viết này rồi" });
        }
        res.status(500).json({ error: err.message });
    }
};

// Lấy danh sách bài viết bị báo cáo trong group (dành cho admin)
const getReportedPostsInGroup = async (req, res) => {
    try {
        const { group_id } = req.params;
        const user_id = req.user._id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        // Kiểm tra quyền admin
        const isAdmin = await isGroupAdmin(group_id, user_id);
        if (!isAdmin) {
            return res.status(403).json({ message: "Only admin can view reported posts" });
        }

        // Aggregate để lấy các post có report
        const reportedPosts = await GroupPostReport.aggregate([
            { $match: { group_id: new mongoose.Types.ObjectId(group_id), status: "pending" } },
            { $group: { _id: "$group_post_id", reportCount: { $sum: 1 } } },
            { $match: { reportCount: { $gt: 0 } } },
            { $sort: { reportCount: -1 } },
            { $skip: skip },
            { $limit: limit }
        ]);

        const posts = await Promise.all(reportedPosts.map(async (item) => {
            const post = await GroupPost.findById(item._id)
                .populate("user_id", "username fullName avatar_url")
                .lean();

            if (!post || post.is_deleted) return null;

            const postMedia = await PostMedia.findOne({ postgr_id: post._id }).populate("media_id");
            let media = [];
            if (postMedia?.media_id?.length > 0) {
                media = postMedia.media_id.map(m => ({
                    url: m.url,
                    type: m.media_type
                }));
            }

            return {
                ...post,
                media,
                report_count: item.reportCount
            };
        }));

        res.json({ posts: posts.filter(Boolean), page, limit });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getReportsForPost = async (req, res) => {
    try {
        const { post_id } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const reports = await GroupPostReport.find({
            group_post_id: post_id,
            status: "pending"
        })
            .populate("reporter_id", "username fullName")
            .skip(skip)
            .limit(limit)
            .lean();

        const total = await GroupPostReport.countDocuments({
            group_post_id: post_id,
            status: "pending"
        });

        res.json({ reports, total, page, limit });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Xử lý report (dành cho admin)
const handleGroupPostReport = async (req, res) => {
    try {
        const { post_id } = req.params;
        const { action } = req.body; // "dismiss_reports" hoặc "delete_post"
        const admin_id = req.user._id;

        // Tìm bài viết và kiểm tra quyền admin
        const post = await GroupPost.findById(post_id);
        if (!post || post.is_deleted) {
            return res.status(404).json({ message: "Post not found" });
        }

        const isAdmin = await isGroupAdmin(post.group_id, admin_id);
        if (!isAdmin) {
            return res.status(403).json({ message: "Only admin can handle reports" });
        }

        if (action === "dismiss_reports") {
            // Đánh dấu tất cả report là "dismissed"
            await GroupPostReport.updateMany(
                { group_post_id: post_id, status: "pending" },
                {
                    status: "dismissed",
                    reviewed_by: admin_id,
                    reviewed_at: new Date()
                }
            );
            res.json({ message: "All reports dismissed successfully" });

        } else if (action === "delete_post") {
            // Xóa mềm bài viết
            post.is_deleted = true;
            post.deleted_at = new Date();
            await post.save();

            // +1 vào count_violations của member trong group
            await GroupMember.findOneAndUpdate(
                { group: post.group_id, user: post.user_id },
                { $inc: { count_violations: 1 } }
            );

            // Đánh dấu tất cả report là "reviewed"
            await GroupPostReport.updateMany(
                { group_post_id: post_id, status: "pending" },
                {
                    status: "reviewed",
                    reviewed_by: admin_id,
                    reviewed_at: new Date()
                }
            );
            res.json({ message: "Post deleted and reports processed successfully" });

        } else {
            return res.status(400).json({ message: "Invalid action. Use 'dismiss_reports' or 'delete_post'" });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

//* Reaction of Post:
// Tạo hoặc cập nhật reaction cho group post
const reactToGroupPost = async (req, res) => {
    try {
        let { postgr_id, type } = req.body;
        const user_id = req.user._id;

        if (!type) type = "like";

        const reaction = await PostReaction.findOneAndUpdate(
            { user_id, postgr_id },
            { type },
            { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
        );

        // Gửi thông báo cho chủ post group
        try {
            const groupPost = await GroupPost.findById(postgr_id);
            if (groupPost && groupPost.user_id.toString() !== user_id.toString()) {
                // Lấy danh sách user đã react (trừ chủ post)
                const reactions = await PostReaction.find({ postgr_id })
                    .populate("user_id", "username");
                // Lọc ra user react khác chủ post
                const otherReactUsers = reactions.filter(
                    r => r.user_id && r.user_id._id.toString() !== groupPost.user_id.toString()
                );
                if (otherReactUsers.length > 0) {
                    const currentUser = otherReactUsers.find(r => r.user_id._id.toString() === user_id.toString());
                    const otherCount = otherReactUsers.length - 1;
                    let contentNoti = "";
                    if (otherCount > 0) {
                        contentNoti = `${currentUser.user_id.username} và ${otherCount} người khác đã bày tỏ cảm xúc bài viết của bạn trong nhóm.`;
                    } else {
                        contentNoti = `${currentUser.user_id.username} đã bày tỏ cảm xúc bài viết của bạn trong nhóm.`;
                    }
                    const io = getSocketIO();
                    const userSocketMap = getUserSocketMap();
                    await notificationService.createNotification(
                        io,
                        groupPost.user_id,
                        "group_post_reaction",
                        contentNoti,
                        userSocketMap
                    );
                }
            }
        } catch (notifyErr) {
            console.error("Không thể gửi thông báo reaction group post:", notifyErr);
        }

        res.status(201).json({ message: "Reaction saved", reaction });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Xoá reaction của user với group post
const removeGroupPostReaction = async (req, res) => {
    try {
        const { postgr_id } = req.body;
        const user_id = req.user._id;

        await PostReaction.findOneAndDelete({ user_id, postgr_id });

        res.status(200).json({ message: "Reaction removed" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Lấy tất cả reaction của 1 group post
const getReactionsOfGroupPost = async (req, res) => {
    try {
        const { postgr_id } = req.params;
        const reactions = await PostReaction.find({ postgr_id }).populate("user_id", "username fullName");

        // Đếm số lượng từng loại reaction
        const counts = await PostReaction.aggregate([
            { $match: { postgr_id: new mongoose.Types.ObjectId(postgr_id) } },
            { $group: { _id: "$type", count: { $sum: 1 } } }
        ]);

        res.status(200).json({ reactions, counts });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Lấy reaction của user với nhiều group post (có thể truyền 1 hoặc nhiều postgr_ids)
const getUserReactionsForGroupPosts = async (req, res) => {
    try {
        const { postgr_ids } = req.body;
        const user_id = req.user._id;

        if (!Array.isArray(postgr_ids) || postgr_ids.length === 0) {
            return res.status(400).json({ error: "postgr_ids must be a non-empty array" });
        }

        const reactions = await PostReaction.find({
            postgr_id: { $in: postgr_ids },
            user_id
        });

        const result = {};
        reactions.forEach(r => {
            result[r.postgr_id.toString()] = r.type;
        });

        res.status(200).json({ reactions: result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const increaseViewCount = async (req, res) => {
  try {
    const postgrId = req.params.id;
    await GroupPost.findByIdAndUpdate(postgrId, { $inc: { viewCount: 1 } });
    res.status(200).json({ message: "View count increased" });
  } catch (err) {
    console.error(err);
  }
};

module.exports = {
    createGroupPost,
    getAllPostsInGroup,
    getGroupPostById,
    updateGroupPost,
    softDeleteGroupPost,
    restoreGroupPost,
    shareGroupPostToWall,
    approveGroupPost,
    getPendingPostsInGroup,
    reactToGroupPost,
    removeGroupPostReaction,
    getReactionsOfGroupPost,
    getUserReactionsForGroupPosts,
    getGroupFeed,
    reportGroupPost,
    getReportedPostsInGroup,
    handleGroupPostReport,
    getReportsForPost,
    increaseViewCount
};