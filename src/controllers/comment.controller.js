const mongoose = require("mongoose");
const Comment = require("../models/Comment_Reaction/comment.model");
const CommentReaction = require("../models/Comment_Reaction/comment_reactions.model");
const Post = require("../models/post.model");
const GroupPost = require("../models/Group/group_post.model");
const User = require("../models/user.model");
const notificationService = require("../services/notification.service");
const grpcClient = require("../services/grpcClient");
const {
  getSocketIO,
  getUserSocketMap,
  getNotificationUserSocketMap,
} = require("../socket/io-instance");
const moderationQueue = require("../queues/moderationQueue");
const moderationService = require("../queues/moderationQueue");

//* Comment:
// Đếm số lượng bình luận của một bài viết
const getGroupPostCommentCount = async (req, res) => {
  try {
    const { postgr_id } = req.params;

    const count = await Comment.countDocuments({
      postgr_id,
      isDeleted: false,
    });

    res.status(200).json({ count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Tạo bình luận mới
const createComment = async (req, res) => {
  const MAX_DEPTH = 2;
  try {
    const { post_id, postgr_id, content, parent_comment_id } = req.body;
    const user_id = req.user._id;

    // Chỉ nhận 1 trong 2: post_id hoặc postgr_id
    if (!post_id && !postgr_id) {
      return res
        .status(400)
        .json({ error: "Must provide post_id or postgr_id" });
    }

    let media = undefined;
    if (req.files && req.files.length > 0) {
      const file = req.files[0];
      media = {
        url: file.path,
        media_type: file.mimetype.startsWith("video") ? "video" : "image",
      };
    }

    let level = 0,
      root_id = null,
      thread_parent_id = null,
      ancestors = [],
      reply_to_comment_id = null;

    if (parent_comment_id) {
      const parent = await Comment.findById(parent_comment_id).lean();
      if (!parent) {
        return res.status(400).json({ error: "Parent not found" });
      }

      const pLevel = parent.level ?? 0;
      level = Math.min(pLevel + 1, MAX_DEPTH);

      // root_id: id comment cấp 0 của thread
      if (pLevel === 0) {
        root_id = parent._id;
      } else {
        root_id = parent.root_id ?? parent._id;
      }

      // thread_parent_id: luôn là ID của comment cấp 1 trong nhánh
      if (pLevel === 0) {
        // reply vào root -> nếu tạo ra level 1 thì thread_parent_id có thể set về root
        thread_parent_id = parent._id;
      } else if (pLevel === 1) {
        // reply vào level 1 -> thread_parent_id PHẢI là chính parent._id
        thread_parent_id = parent._id;
      } else {
        // reply vào level 2 -> giữ nhánh của parent
        thread_parent_id = parent.thread_parent_id || parent._id;
      }

      // ancestors: tối đa 2 phần tử [root, level1]
      if (pLevel === 0) {
        ancestors = [parent._id];
      } else if (pLevel === 1) {
        ancestors = [parent.root_id ?? parent._id, parent._id];
      } else {
        const l1Id = parent.thread_parent_id ?? parent._id;
        const rId = parent.root_id ?? parent.ancestors?.[0] ?? l1Id;
        ancestors = [rId, l1Id];
      }

      reply_to_comment_id = parent_comment_id;
    }

    const comment = await Comment.create({
      user_id,
      post_id,
      postgr_id,
      content,
      parent_comment_id,
      media,
      level,
      root_id,
      thread_parent_id,
      ancestors,
      reply_to_comment_id,
    });

    if (media) {
      console.log("Check image/video for moderation:", media.url);
      await moderationService.checkCommentImage(
        comment._id,
        media.url,
        media.media_type
      );
    }

    grpcClient.CheckComment(
      { comment_id: comment._id, content: comment.content },
      async (err, response) => {
        if (response) {
          comment.content = response.censor_content;
          await comment.save();
        }
      }
    );

    // Gửi thông báo
    try {
      const io = getSocketIO();
      const notificationsNamespace = io.of("/notifications");
      const notificationUserSocketMap = getNotificationUserSocketMap();
      const commenter = await User.findById(user_id);

      // 1. Reply comment: gửi cho chủ comment được reply (nếu không phải là mình)
      if (parent_comment_id) {
        const parentComment = await Comment.findById(parent_comment_id);
        if (
          parentComment &&
          parentComment.user_id.toString() !== user_id.toString()
        ) {
          await notificationService.createNotificationWithNamespace(
            notificationsNamespace,
            parentComment.user_id,
            "reply_comment",
            `${commenter.fullName} đã trả lời bình luận của bạn`,
            notificationUserSocketMap,
            { fromUser: commenter._id, relatedId: comment._id }
          );
        }
      } else {
        // 2. Bình luận vào post cá nhân
        if (post_id) {
          const post = await Post.findById(post_id);
          if (post && post.user_id.toString() !== user_id.toString()) {
            await notificationService.createNotificationWithNamespace(
              notificationsNamespace,
              post.user_id,
              "comment",
              `${commenter.fullName} đã bình luận vào bài viết của bạn`,
              notificationUserSocketMap,
              { fromUser: commenter._id, relatedId: comment._id }
            );
          }
        }
        // 3. Bình luận vào post group
        else if (postgr_id) {
          const groupPost = await GroupPost.findById(postgr_id);
          if (
            groupPost &&
            groupPost.user_id.toString() !== user_id.toString()
          ) {
            const group = await Group.findById(groupPost.group_id);
            const groupName = group ? group.name : "nhóm";
            await notificationService.createNotificationWithNamespace(
              notificationsNamespace,
              groupPost.user_id,
              "comment",
              `${commenter.fullName} đã bình luận vào bài viết của bạn trong nhóm ${groupName}`,
              notificationUserSocketMap,
              { fromUser: commenter._id, relatedId: comment._id }
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

// Lấy tất cả bình luận của 1 bài viết
const getCommentsOfPost = async (req, res) => {
  try {
    const { post_id, postgr_id } = req.params;
    const filter = { isDeleted: false };
    if (post_id) filter.post_id = new mongoose.Types.ObjectId(post_id);
    if (postgr_id) filter.postgr_id = new mongoose.Types.ObjectId(postgr_id);

    const all = await Comment.find(filter)
      .populate("user_id", "fullName avatar_url")
      .sort({ createdAt: 1 })
      .lean();

    const roots = all.filter((c) => (c.level ?? 0) === 0);
    const level1 = all.filter((c) => c.level === 1);
    const level2 = all.filter((c) => c.level === 2);

    // index nhanh để suy luận quan hệ
    const byId = new Map(all.map((c) => [String(c._id), c]));

    // Gom cấp 1 theo root (chịu trường hợp parent_comment_id bị thiếu)
    const childrenL1 = new Map(); // rootId -> [l1...]
    for (const c of level1) {
      const rootKey = c.parent_comment_id
        ? String(c.parent_comment_id)
        : c.root_id
        ? String(c.root_id)
        : null;
      if (!rootKey) continue;
      if (!childrenL1.has(rootKey)) childrenL1.set(rootKey, []);
      childrenL1.get(rootKey).push(c);
    }

    // Helper: tìm id "đầu nhánh" cấp 1 cho 1 comment cấp 2
    const getL1Key = (c2) => {
      // 1) Ưu tiên thread_parent_id nếu đã có và là id cấp 1
      if (c2.thread_parent_id) return String(c2.thread_parent_id);

      // 2) ancestors[1] (schema bạn có ancestors: [root, level1])
      if (Array.isArray(c2.ancestors) && c2.ancestors.length >= 2) {
        return String(c2.ancestors[1]);
      }

      // 3) lần ngược theo parent
      if (c2.parent_comment_id) {
        const p = byId.get(String(c2.parent_comment_id));
        if (p) {
          if ((p.level ?? 0) === 1) return String(p._id); // parent là cấp 1
          if (p.level === 2) {
            // parent là cấp 2 -> bám theo nhánh của parent
            return String(p.thread_parent_id || p._id);
          }
          if ((p.level ?? 0) === 0) {
            // parent là root (dữ liệu sai), coi root như "đầu nhánh"
            return String(p._id);
          }
        }
      }

      // 4) cuối cùng: dùng root_id nếu có (ít chính xác hơn)
      if (c2.root_id) return String(c2.root_id);

      return null;
    };

    // Gom cấp 2 theo đầu nhánh (id của comment cấp 1)
    const childrenL2ByThread = new Map(); // l1Id -> [l2...]
    for (const c of level2) {
      const l1Key = getL1Key(c);
      if (!l1Key) continue;
      if (!childrenL2ByThread.has(l1Key)) childrenL2ByThread.set(l1Key, []);
      childrenL2ByThread.get(l1Key).push(c);
    }

    // Build 0 -> 1 -> 2
    const result = roots.map((r) => {
      const l1s = childrenL1.get(String(r._id)) || [];
      const replies = l1s.map((l1) => {
        const l2s = childrenL2ByThread.get(String(l1._id)) || [];
        return {
          ...l1,
          replies: l2s.map((l2) => ({
            ...l2,
            replying_to: l2.reply_to_comment_id, // để FE hiện "Replying to ..."
          })),
          replies_count: l2s.length,
        };
      });
      return { ...r, replies };
    });

    res.status(200).json({ comments: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Đếm số lượng bình luận của 1 bài viết
const countCommentsOfPost = async (req, res) => {
  try {
    const { post_id } = req.params;
    const count = await Comment.countDocuments({ post_id, isDeleted: false });
    res.status(200).json(count);
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

    if (!comment)
      return res
        .status(404)
        .json({ error: "Comment not found or no permission" });

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
    if (!comment)
      return res
        .status(404)
        .json({ error: "Comment not found or no permission" });
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
    if (!comment)
      return res
        .status(404)
        .json({ error: "Comment not found or no permission" });
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
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      }
    );
    try {
      const comment = await Comment.findById(comment_id);
      if (comment && comment.user_id.toString() !== user_id.toString()) {
        // Lấy danh sách user đã react (trừ chủ comment)
        const reactions = await CommentReaction.find({ comment_id }).populate(
          "user_id",
          "username"
        );
        // Lọc ra user react khác chủ comment
        const otherReactUsers = reactions.filter(
          (r) =>
            r.user_id && r.user_id._id.toString() !== comment.user_id.toString()
        );
        if (otherReactUsers.length > 0) {
          const currentUser = otherReactUsers.find(
            (r) => r.user_id._id.toString() === user_id.toString()
          );
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
    const reactions = await CommentReaction.find({ comment_id }).populate(
      "user_id",
      "username avatar_url"
    );
    // Đếm số lượng từng loại reaction
    const counts = await CommentReaction.aggregate([
      { $match: { comment_id: new mongoose.Types.ObjectId(comment_id) } },
      { $group: { _id: "$type", count: { $sum: 1 } } },
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
      return res
        .status(400)
        .json({ error: "comment_ids must be a non-empty array" });
    }

    const reactions = await CommentReaction.find({
      comment_id: { $in: comment_ids },
      user_id,
    });

    const result = {};
    reactions.forEach((r) => {
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
  getGroupPostCommentCount,
  countCommentsOfPost,
};
