const mongoose = require("mongoose");
const Comment = require("../models/Comment_Reaction/comment.model");
const CommentReaction = require("../models/Comment_Reaction/comment_reactions.model");
const Post = require("../models/post.model");
const GroupPost = require("../models/Group/group_post.model");
const User = require("../models/user.model");
const notificationService = require("../services/notification.service");
const { getSocketIO, getUserSocketMap } = require("../socket/io-instance");

//* Comment:
// Đếm số lượng bình luận của một bài viết
const getGroupPostCommentCount = async (req, res) => {
    try {
        const { postgr_id } = req.params;
        
        const count = await Comment.countDocuments({ 
            postgr_id, 
            isDeleted: false 
        });
        
        res.status(200).json({ count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


// Tạo bình luận mới
const createComment = async (req, res) => {
    try {
        const { post_id, postgr_id, content, parent_comment_id } = req.body;
        const user_id = req.user._id;

        // Chỉ nhận 1 trong 2: post_id hoặc postgr_id
        if (!post_id && !postgr_id) {
            return res.status(400).json({ error: "Must provide post_id or postgr_id" });
        }

        let media = undefined;
        if (req.files && req.files.length > 0) {
            const file = req.files[0];
            media = {
                url: file.path,
                media_type: file.mimetype.startsWith("video") ? "video" : "image"
            };
        }

        const comment = await Comment.create({
            user_id,
            post_id,
            postgr_id,
            content,
            parent_comment_id,
            media
        });

        // Gửi thông báo
        try {
            const io = getSocketIO();
            const userSocketMap = getUserSocketMap();
            const commenter = await User.findById(user_id);

            // 1. Reply comment: gửi cho chủ comment được reply (nếu không phải là mình)
            if (parent_comment_id) {
                const parentComment = await Comment.findById(parent_comment_id);
                if (parentComment && parentComment.user_id.toString() !== user_id.toString()) {
                    await notificationService.createNotification(
                        io,
                        parentComment.user_id,
                        "reply_comment",
                        `${commenter.username} đã trả lời bình luận của bạn`,
                        userSocketMap
                    );
                }
            } else {
                // 2. Bình luận vào post cá nhân
                if (post_id) {
                    const post = await Post.findById(post_id);
                    if (post && post.user_id.toString() !== user_id.toString()) {
                        await notificationService.createNotification(
                            io,
                            post.user_id,
                            "comment",
                            `${commenter.username} đã bình luận vào bài viết của bạn`,
                            userSocketMap
                        );
                    }
                }
                // 3. Bình luận vào post group
                else if (postgr_id) {
                    const groupPost = await GroupPost.findById(postgr_id);
                    if (groupPost && groupPost.user_id.toString() !== user_id.toString()) {
                        const group = await Group.findById(groupPost.group_id);
                        const groupName = group ? group.name : "nhóm";
                        await notificationService.createNotification(
                            io,
                            groupPost.user_id,
                            "comment",
                            `${commenter.username} đã bình luận vào bài viết của bạn trong nhóm ${groupName}`,
                            userSocketMap
                        );
                    }
                }
            }
        } catch (notifyErr) {
            console.error("Không thể gửi thông báo bình luận:", notifyErr);
        }

        res.status(201).json({ message: "Comment created", comment });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Lấy tất cả bình luận của 1 bài viết (chỉ lấy comment chưa xóa)
//TODO Phân cấp tạm thời (sau này cải tiến lại)
const getCommentsOfPost = async (req, res) => {
    try {
        const { post_id, postgr_id } = req.params;

        let filter = { isDeleted: false };

        if (post_id) filter.post_id = new mongoose.Types.ObjectId(post_id);
        if (postgr_id) filter.postgr_id = new mongoose.Types.ObjectId(postgr_id);

        const comments = await Comment.find(filter)
            .populate("user_id", "fullName avatar_url")
            .sort({ createdAt: 1 });

        const commentMap = {};
        const roots = [];

        comments.forEach(comment => {
            comment = comment.toObject();
            comment.replies = [];
            commentMap[comment._id] = comment;
        });

        comments.forEach(comment => {
            if (comment.parent_comment_id && commentMap[comment.parent_comment_id]) {
                commentMap[comment.parent_comment_id].replies.push(commentMap[comment._id]);
            } else {
                roots.push(commentMap[comment._id]);
            }
        });

        res.status(200).json({ comments: roots });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Chỉnh sửa bình luận (chỉ cho phép chỉnh sửa bình luận của chính mình)
const editComment = async (req, res) => {
    try {
        const { comment_id } = req.params;
        const { content } = req.body;
        const user_id = req.user._id;

        const comment = await Comment.findOneAndUpdate(
            { _id: comment_id, user_id },
            { content },
            { new: true, runValidators: true }
        );

        if (!comment) return res.status(404).json({ error: "Comment not found or no permission" });

        res.status(200).json({ message: "Comment updated", comment });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Xóa mềm bình luận (đánh dấu là đã xóa, không xóa khỏi DB)
const softDeleteComment = async (req, res) => {
    try {
        const { comment_id } = req.params;
        const user_id = req.user._id;
        const comment = await Comment.findOneAndUpdate(
            { _id: comment_id, user_id },
            { isDeleted: true, deleted_at: new Date() },
            { new: true }
        );
        if (!comment) return res.status(404).json({ error: "Comment not found or no permission" });
        res.status(200).json({ message: "Comment deleted", comment });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Khôi phục bình luận đã xóa mềm
//? Cái này chắc dành cho admin
const restoreComment = async (req, res) => {
    try {
        const { comment_id } = req.params;
        const user_id = req.user._id;
        const comment = await Comment.findOneAndUpdate(
            { _id: comment_id, user_id },
            { isDeleted: false, deleted_at: null },
            { new: true }
        );
        if (!comment) return res.status(404).json({ error: "Comment not found or no permission" });
        res.status(200).json({ message: "Comment restored", comment });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};


// * Reactions of Comment
// Tạo hoặc cập nhật reaction cho comment
const reactToComment = async (req, res) => {
    try {
        const { comment_id, type } = req.body;
        const user_id = req.user._id;
        const reaction = await CommentReaction.findOneAndUpdate(
            { user_id, comment_id },
            { type: type || "like" },
            { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
        );
        try {
            const comment = await Comment.findById(comment_id);
            if (comment && comment.user_id.toString() !== user_id.toString()) {
                // Lấy danh sách user đã react (trừ chủ comment)
                const reactions = await CommentReaction.find({ comment_id })
                    .populate("user_id", "username");
                // Lọc ra user react khác chủ comment
                const otherReactUsers = reactions.filter(
                    r => r.user_id && r.user_id._id.toString() !== comment.user_id.toString()
                );
                if (otherReactUsers.length > 0) {
                    const currentUser = otherReactUsers.find(r => r.user_id._id.toString() === user_id.toString());
                    const otherCount = otherReactUsers.length - 1;
                    let contentNoti = "";
                    if (otherCount > 0) {
                        contentNoti = `${currentUser.user_id.username} và ${otherCount} người khác đã bày tỏ cảm xúc bình luận của bạn`;
                    } else {
                        contentNoti = `${currentUser.user_id.username} đã bày tỏ cảm xúc bình luận của bạn`;
                    }
                    const io = getSocketIO();
                    const userSocketMap = getUserSocketMap();
                    await notificationService.createNotification(
                        io,
                        comment.user_id,
                        "comment_reaction",
                        contentNoti,
                        userSocketMap
                    );
                }
            }
        } catch (notifyErr) {
            console.error("Không thể gửi thông báo reaction bình luận:", notifyErr);
        }
        res.status(200).json({ message: "Comment reaction saved", reaction });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Xoá reaction của user với comment
const removeCommentReaction = async (req, res) => {
    try {
        const { comment_id } = req.body;
        const user_id = req.user._id;
        await CommentReaction.findOneAndDelete({ user_id, comment_id });
        res.status(200).json({ message: "Comment reaction removed" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Lấy tất cả reaction của 1 comment
const getReactionsOfComment = async (req, res) => {
    try {
        const { comment_id } = req.params;
        const reactions = await CommentReaction.find({ comment_id }).populate("user_id", "username avatar_url");
        // Đếm số lượng từng loại reaction
        const counts = await CommentReaction.aggregate([
            { $match: { comment_id: new mongoose.Types.ObjectId(comment_id) } },
            { $group: { _id: "$type", count: { $sum: 1 } } }
        ]);
        res.status(200).json({ reactions, counts });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// Lấy reaction của user với comment (Có thể truyền 1 hoặc nhiều comment_id)
const getUserReactionsForComments = async (req, res) => {
    try {
        const { comment_ids } = req.body;
        const user_id = req.user._id;

        if (!Array.isArray(comment_ids) || comment_ids.length === 0) {
            return res.status(400).json({ error: "comment_ids must be a non-empty array" });
        }

        const reactions = await CommentReaction.find({
            comment_id: { $in: comment_ids },
            user_id
        });

        const result = {};
        reactions.forEach(r => {
            result[r.comment_id.toString()] = r.type;
        });

        res.status(200).json({ reactions: result });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    createComment,
    getCommentsOfPost,
    editComment,
    softDeleteComment,
    restoreComment,
    reactToComment,
    removeCommentReaction,
    getReactionsOfComment,
    getUserReactionsForComments,
    getGroupPostCommentCount
};