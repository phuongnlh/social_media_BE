const GroupPost = require("../models/Group/group_post.model");
const Media = require("../models/media.model");
const Group = require("../models/Group/group.model");
const PostMedia = require("../models/postMedia.model");
const GroupMember = require("../models/Group/group_member.model");
const Post = require("../models/post.model");
const PostReaction = require("../models/Comment_Reaction/post_reaction.model");
const mongoose = require("mongoose");

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
        const user_id = req.user._id;

        // Kiểm tra quyền admin
        const isAdmin = await isGroupAdmin(group_id, user_id);

        // Nếu là admin: lấy tất cả bài chưa xóa
        // Nếu không: chỉ lấy bài đã duyệt hoặc bài của chính mình
        let query = { group_id, is_deleted: false };
        if (!isAdmin) {
            query["$or"] = [
                { status: "approved" },
                { user_id: user_id }
            ];
        }

        const posts = await GroupPost.find(query)
            .sort({ created_at: -1 })
            .populate("user_id", "username")
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

// Admin duyệt bài viết trong group
const approveGroupPost = async (req, res) => {
    try {
        const { post_id } = req.params;
        const { action } = req.body; // "approve" hoặc "reject"
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

        if (action === "approve") {
            post.status = "approved";
            post.approved_by = admin_id;
            post.approved_at = new Date();
        } else if (action === "reject") {
            post.status = "rejected";
            post.approved_by = admin_id;
            post.approved_at = new Date();
        } else {
            return res.status(400).json({ message: "Invalid action" });
        }

        await post.save();
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
            .populate("user_id", "username")
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
        const reactions = await PostReaction.find({ postgr_id }).populate("user_id", "username");

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
    getUserReactionsForGroupPosts
};