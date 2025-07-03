const Post = require("../models/post.model");
const Media = require("../models/media.model");
const PostMedia = require("../models/postMedia.model");

const createPost = async (req, res) => {
  try {
    const { content, type } = req.body;
    const userId = req.user._id; // lấy từ middleware xác thực

    const post = await Post.create({ content, user_id: userId, type });

    // Xử lý media upload
    const files = req.files || [];
    for (const file of files) {
      const media = await Media.create({
        user_id: userId,
        url: file.path,
        media_type: file.mimetype.startsWith("video") ? "video" : "image",
      });

      await PostMedia.create({ post_id: post._id, media_id: media._id });
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
        const mediaLinks = await PostMedia.find({ post_id: post._id }).populate(
          "media_id"
        );

        return {
          ...post,
          media: mediaLinks.map((m) => ({
            url: m.media_id.url,
            type: m.media_id.media_type,
          })),
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
    const mediaLinks = await PostMedia.find({ post_id: post._id }).populate(
      "media_id"
    );

    res.json({
      ...post,
      media: mediaLinks.map((m) => ({
        url: m.media_id.url,
        type: m.media_id.media_type,
      })),
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

module.exports = {
  createPost,
  getAllPostsbyUser,
  getPostById,
  softDeletePost,
  updatePost,
  restorePost,
  getTrashedPosts,
};
