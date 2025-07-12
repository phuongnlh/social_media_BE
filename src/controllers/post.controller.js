const Post = require("../models/post.model");
const Media = require("../models/media.model");
const PostMedia = require("../models/postMedia.model");
const PostReaction = require("../models/Comment_Reaction/post_reaction.model");
const mongoose = require("mongoose");

const createPost = async (req, res) => {
  try {
    const { content, type } = req.body;
    const userId = req.user._id;

    const post = await Post.create({ content, user_id: userId, type });

    // Xử lý media upload
    const files = req.files || [];
    const mediaIds = [];
    for (const file of files) {
      const media = await Media.create({
        user_id: userId,
        url: file.path,
        media_type: file.mimetype.startsWith("video") ? "video" : "image",
      });
      mediaIds.push(media._id);
    }

    if (mediaIds.length > 0) {
      await PostMedia.create({
        type: "post",
        post_id: post._id,
        media_id: mediaIds
      });
    }

    res.status(201).json({ message: "Post created", postId: post._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getAllPostsbyUser = async (req, res) => {
  try {
    const userId = req.user._id;
    const posts = await Post.find({ user_id: userId, is_deleted: false })
      .sort({ created_at: -1 })
      .lean();

    const populatedPosts = await Promise.all(
      posts.map(async (post) => {
        // Lấy 1 document PostMedia cho mỗi post
        const postMedia = await PostMedia.findOne({ post_id: post._id }).populate("media_id");
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

const getPostById = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user._id;
    const post = await Post.findById(postId).lean();

    if (!post) return res.status(404).json({ message: "Post not found" });
    if (post.is_deleted && post.user_id.toString() !== userId.toString()) {
      return res.status(410).json({ message: "Post has been deleted" });
    }
    if (
      post.type === "Private" &&
      post.user_id.toString() !== userId.toString()
    ) {
      return res.status(403).json({ message: "Unauthorized access" });
    }

    // Lấy 1 document PostMedia cho post này
    const postMedia = await PostMedia.findOne({ post_id: post._id }).populate("media_id");
    let media = [];
    if (postMedia && postMedia.media_id && postMedia.media_id.length > 0) {
      media = postMedia.media_id.map((m) => ({
        url: m.url,
        type: m.media_type,
      }));
    }
    res.json({
      ...post,
      media,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updatePost = async (req, res) => {
  try {
    const { content } = req.body;
    const postId = req.params.id;
    const userId = req.user._id;

    const post = await Post.findOne({ _id: postId, user_id: userId });
    if (!post)
      return res
        .status(404)
        .json({ message: "Post not found or unauthorized" });

    post.content = content || post.content;
    post.updated_at = new Date();

    await post.save();

    res.json({ message: "Post updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const softDeletePost = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user._id;

    const post = await Post.findOne({
      _id: postId,
      user_id: userId,
      is_deleted: false,
    });
    if (!post)
      return res
        .status(404)
        .json({ message: "Post not found or already deleted" });

    post.is_deleted = true;
    post.deleted_at = new Date();
    await post.save();

    res.json({
      message: "Post moved to trash. Will be permanently deleted after 7 days.",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const restorePost = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user._id;

    const post = await Post.findOne({
      _id: postId,
      user_id: userId,
      is_deleted: true,
    });
    if (!post)
      return res
        .status(404)
        .json({ message: "Post not found or not in trash" });

    const now = new Date();
    const expiredDate = new Date(
      post.deleted_at.getTime() + 7 * 24 * 60 * 60 * 1000
    );

    if (now > expiredDate) {
      return res
        .status(410)
        .json({ message: "Cannot restore. Trash expired." });
    }

    post.is_deleted = false;
    post.deleted_at = null;
    await post.save();

    res.json({ message: "Post restored successfully." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getTrashedPosts = async (req, res) => {
  try {
    const userId = req.user._id;

    // Tính thời gian trước 7 ngày
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const posts = await Post.find({
      user_id: userId,
      is_deleted: true,
      deleted_at: { $gt: sevenDaysAgo }, // Chỉ lấy bài chưa quá 7 ngày
    })
      .sort({ deleted_at: -1 })
      .lean();

    res.json({ posts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const sharePost = async (req, res) => {
  try {
    const { original_post_id, content, type } = req.body;
    const userId = req.user._id;

    // Kiểm tra bài gốc có tồn tại không
    const originalPost = await Post.findById(original_post_id);
    if (!originalPost || originalPost.is_deleted) {
      return res.status(404).json({ message: "Original post not found or deleted" });
    }

    // Không cho share bài đã share
    if (originalPost.shared_post_id) {
      return res.status(400).json({ message: "Cannot share a shared post" });
    }

    // Tạo post share
    const sharedPost = await Post.create({
      user_id: userId,
      content: content || "", // caption nếu có
      type: type || "Public",
      shared_post_id: original_post_id,
    });

    res.status(201).json({ message: "Post shared successfully", postId: sharedPost._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

//* Reaction of Post:
// Tạo hoặc cập nhật reaction (nếu đã tồn tại thì update)
const reactToPost = async (req, res) => {
  try {
    let { post_id, type } = req.body;
    const user_id = req.user._id;

    if (!type) type = "like"; // Mặc định là "like" nếu không có type

    const reaction = await PostReaction.findOneAndUpdate(
      { user_id, post_id },
      { type },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    );

    res.status(201).json({ message: "Reaction saved", reaction });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Xoá reaction của user với post
const removeReaction = async (req, res) => {
  try {
    const { post_id } = req.body;
    const user_id = req.user._id;

    await PostReaction.findOneAndDelete({ user_id, post_id });

    res.status(200).json({ message: "Reaction removed" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Lấy tất cả reaction của 1 post
const getReactionsOfPost = async (req, res) => {
  try {
    const { post_id } = req.params;
    const reactions = await PostReaction.find({ post_id }).populate("user_id", "username"); //Thêm vào các trường tương ứng nếu cần thiết

    //Đếm
    const counts = await PostReaction.aggregate([
      { $match: { post_id: new mongoose.Types.ObjectId(post_id) } },
      { $group: { _id: "$type", count: { $sum: 1 } } }
    ]);


    res.status(200).json({ reactions, counts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Lấy reaction của user với post (Có thể truyền 1 hoặc nhiều post_id)
// Dùng cho trường hợp render để hiển thị trạng thái nút tương tác
const getUserReactionsForPosts = async (req, res) => {
  try {
    const { post_ids } = req.body;
    const user_id = req.user._id;

    if (!Array.isArray(post_ids) || post_ids.length === 0) {
      return res.status(400).json({ error: "post_ids must be a non-empty array" });
    }


    const reactions = await PostReaction.find({
      post_id: { $in: post_ids },
      user_id
    });

    const result = {};
    reactions.forEach(r => {
      result[r.post_id.toString()] = r.type;
    });

    res.status(200).json({ reactions: result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  createPost,
  getAllPostsbyUser,
  getPostById,
  softDeletePost,
  updatePost,
  restorePost,
  getTrashedPosts,
  reactToPost,
  removeReaction,
  getReactionsOfPost,
  getUserReactionsForPosts,
  sharePost
};
