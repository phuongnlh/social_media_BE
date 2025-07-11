const Post = require("../models/post.model");
const Media = require("../models/media.model");
const PostMedia = require("../models/postMedia.model");

// Tạo bài đăng mới với tệp media (nếu có)
const createPost = async (req, res) => {
  try {
    const { content, type } = req.body;
    const userId = req.user._id; // lấy từ middleware xác thực

    // Tạo bài đăng mới trong cơ sở dữ liệu
    const post = await Post.create({ content, user_id: userId, type });

    // Xử lý tải lên các tệp media
    const files = req.files || [];
    for (const file of files) {
      // Tạo bản ghi media
      const media = await Media.create({
        user_id: userId,
        url: file.path,
        media_type: file.mimetype.startsWith("video") ? "video" : "image",
      });

      // Liên kết media với bài đăng
      await PostMedia.create({ post_id: post._id, media_id: media._id });
    }

    res.status(201).json({ message: "Post created", postId: post._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Lấy tất cả bài đăng của người dùng đang đăng nhập
const getAllPostsbyUser = async (req, res) => {
  try {
    const userId = req.user._id;
    // Tìm tất cả bài đăng không bị xóa của người dùng, sắp xếp theo thời gian giảm dần
    const posts = await Post.find({ user_id: userId, isDeleted: false })
      .sort({ created_at: -1 })
      .lean();

    // Nạp thông tin media cho mỗi bài đăng
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

// Lấy thông tin chi tiết của một bài đăng theo ID
const getPostById = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user._id;
    // Tìm bài đăng theo ID
    const post = await Post.findById(postId).lean();

    if (!post) return res.status(404).json({ message: "Không tìm thấy bài đăng" });
    
    // Kiểm tra nếu bài đăng đã bị xóa và người yêu cầu không phải tác giả
    if (post.isDeleted && post.user_id.toString() !== userId.toString()) {
      return res.status(410).json({ message: "Bài đăng đã bị xóa" });
    }
    
    // Kiểm tra quyền truy cập nếu bài đăng ở chế độ riêng tư
    if (
      post.type === "Private" &&
      post.user_id.toString() !== userId.toString()
    ) {
      return res.status(403).json({ message: "Không có quyền truy cập" });
    }
    
    // Lấy thông tin media của bài đăng
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

// Cập nhật nội dung của bài đăng
const updatePost = async (req, res) => {
  try {
    const { content } = req.body;
    const postId = req.params.id;
    const userId = req.user._id;

    // Tìm bài đăng và xác minh quyền sở hữu
    const post = await Post.findOne({ _id: postId, user_id: userId });
    if (!post)
      return res
        .status(404)
        .json({ message: "Không tìm thấy bài đăng hoặc không có quyền chỉnh sửa" });

    // Cập nhật nội dung và thời gian cập nhật
    post.content = content || post.content;
    post.updated_at = new Date();

    await post.save();

    res.json({ message: "Bài đăng đã được cập nhật thành công" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Xóa mềm bài đăng (chuyển vào thùng rác)
const softDeletePost = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user._id;

    // Tìm bài đăng chưa bị xóa và xác minh quyền sở hữu
    const post = await Post.findOne({
      _id: postId,
      user_id: userId,
      isDeleted: false,
    });
    if (!post)
      return res
        .status(404)
        .json({ message: "Không tìm thấy bài đăng hoặc đã bị xóa" });

    // Đánh dấu bài đăng đã bị xóa và lưu thời gian xóa
    post.isDeleted = true;
    post.deleted_at = new Date();
    await post.save();

    res.json({
      message: "Bài đăng đã được chuyển vào thùng rác. Sẽ bị xóa vĩnh viễn sau 7 ngày.",
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Khôi phục bài đăng từ thùng rác
const restorePost = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user._id;

    // Tìm bài đăng đã bị xóa và xác minh quyền sở hữu
    const post = await Post.findOne({
      _id: postId,
      user_id: userId,
      isDeleted: true,
    });
    if (!post)
      return res
        .status(404)
        .json({ message: "Không tìm thấy bài đăng hoặc không nằm trong thùng rác" });

    // Kiểm tra xem bài đăng có quá hạn khôi phục không (7 ngày)
    const now = new Date();
    const expiredDate = new Date(
      post.deleted_at.getTime() + 7 * 24 * 60 * 60 * 1000
    );

    if (now > expiredDate) {
      return res
        .status(410)
        .json({ message: "Không thể khôi phục. Đã quá thời hạn." });
    }

    // Đánh dấu bài đăng chưa bị xóa và xóa thời gian xóa
    post.isDeleted = false;
    post.deleted_at = null;
    await post.save();

    res.json({ message: "Bài đăng đã được khôi phục thành công." });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Lấy danh sách các bài đăng đang ở trong thùng rác
const getTrashedPosts = async (req, res) => {
  try {
    const userId = req.user._id;

    // Tính thời gian trước 7 ngày
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Tìm các bài đăng đã xóa mà chưa quá 7 ngày
    const posts = await Post.find({
      user_id: userId,
      isDeleted: true,
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
