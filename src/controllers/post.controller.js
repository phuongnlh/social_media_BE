const Post = require("../models/post.model");
const Media = require("../models/media.model");
const PostMedia = require("../models/postMedia.model");
const PostReaction = require("../models/Comment_Reaction/post_reaction.model");
const adsModel = require("../models/Payment_Ads/ads.model");
const userModel = require("../models/user.model");
const Friendship = require("../models/friendship.model");
const Comment = require("../models/Comment_Reaction/comment.model");
const mongoose = require("mongoose");
const notificationService = require("../services/notification.service");
const { getSocketIO, getUserSocketMap } = require("../socket/io-instance");

// Tạo bài đăng mới với tệp media (nếu có)
const createPost = async (req, res) => {
  try {
    const { content, type } = req.body;
    const userId = req.user._id;

    // Tạo bài đăng mới trong cơ sở dữ liệu
    const post = await Post.create({ content, user_id: userId, type });

    // Xử lý tải lên các tệp media
    const files = req.files || [];
    const mediaIds = [];
    for (const file of files) {
      // Tạo bản ghi media
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
        media_id: mediaIds,
      });
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
    const posts = await Post.find({ user_id: userId, is_deleted: false })
      .sort({ createdAt: -1 })
      .populate("user_id", "username avatar_url fullName") // Nạp thông tin người dùng
      .lean();
    // Nạp thông tin media cho mỗi bài đăng
    const populatedPosts = await Promise.all(
      posts.map(async (post) => {
        // Lấy 1 document PostMedia cho mỗi post
        const postMedia = await PostMedia.findOne({
          post_id: post._id,
        }).populate("media_id");
        let media = [];
        if (postMedia && postMedia.media_id && postMedia.media_id.length > 0) {
          media = postMedia.media_id.map((m) => ({
            url: m.url,
            type: m.media_type,
          }));
        }
        const { user_id, ...rest } = post;

        return {
          ...rest,
          author: user_id, // Rename user_id => author
          media,
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
    
    // Tìm bài đăng theo ID và populate thông tin user
    const post = await Post.findById(postId)
      .populate("user_id", "username avatar_url fullName")
      .lean();

    if (!post)
      return res.status(404).json({ message: "Không tìm thấy bài đăng" });

    // Kiểm tra nếu bài đăng đã bị xóa và người yêu cầu không phải tác giả
    if (post.isDeleted && post.user_id._id.toString() !== userId.toString()) {
      return res.status(410).json({ message: "Bài đăng đã bị xóa" });
    }

    // Kiểm tra quyền truy cập nếu bài đăng ở chế độ riêng tư
    if (
      post.type === "Private" &&
      post.user_id._id.toString() !== userId.toString()
    ) {
      return res.status(403).json({ message: "Không có quyền truy cập" });
    }

    // Lấy 1 document PostMedia cho post này
    const postMedia = await PostMedia.findOne({ post_id: post._id }).populate(
      "media_id"
    );
    let media = [];
    if (postMedia && postMedia.media_id && postMedia.media_id.length > 0) {
      media = postMedia.media_id.map((m) => ({
        url: m.url,
        type: m.media_type,
      }));
    }

    // Destructure để rename user_id thành author
    const { user_id, ...rest } = post;
    
    res.json({
      ...rest,
      author: user_id, // Rename user_id => author và bao gồm username, fullName, avatar_url
      media,
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
      return res.status(404).json({
        message: "Không tìm thấy bài đăng hoặc không có quyền chỉnh sửa",
      });

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
      message:
        "Bài đăng đã được chuyển vào thùng rác. Sẽ bị xóa vĩnh viễn sau 7 ngày.",
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
      return res.status(404).json({
        message: "Không tìm thấy bài đăng hoặc không nằm trong thùng rác",
      });

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

const sharePost = async (req, res) => {
  try {
    const { original_post_id, content, type } = req.body;
    const userId = req.user._id;

    // Kiểm tra bài gốc có tồn tại không
    const originalPost = await Post.findById(original_post_id);
    if (!originalPost || originalPost.is_deleted) {
      return res
        .status(404)
        .json({ message: "Original post not found or deleted" });
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

    res
      .status(201)
      .json({ message: "Post shared successfully", postId: sharedPost._id });
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
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      }
    );
    // Gửi thông báo cho chủ post
    try {
      const post = await Post.findById(post_id);
      if (post && post.user_id.toString() !== user_id.toString()) {
        // Lấy danh sách user đã react (trừ chủ post)
        const reactions = await PostReaction.find({ post_id }).populate(
          "user_id",
          "username fullName"
        );
        const otherReactUsers = reactions.filter(
          (r) =>
            r.user_id && r.user_id._id.toString() !== post.user_id.toString()
        );
        if (otherReactUsers.length > 0) {
          const currentUser = otherReactUsers.find(
            (r) => r.user_id._id.toString() === user_id.toString()
          );
          const otherCount = otherReactUsers.length - 1;
          let contentNoti = "";
          if (otherCount > 0) {
            contentNoti = `${
              currentUser.user_id.fullName || currentUser.user_id.username
            } và ${otherCount} người khác đã bày tỏ cảm xúc bài viết của bạn.`;
          } else {
            contentNoti = `${
              currentUser.user_id.fullName || currentUser.user_id.username
            } đã bày tỏ cảm xúc bài viết của bạn.`;
          }
          const io = getSocketIO();
          const userSocketMap = getUserSocketMap();
          await notificationService.createNotification(
            io,
            post.user_id,
            "post_reaction",
            contentNoti,
            userSocketMap
          );
        }
      }
    } catch (notifyErr) {
      console.error("Không thể gửi thông báo reaction bài viết:", notifyErr);
    }
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
    const posts = await Post.find({ is_deleted: false })
      .sort({ created_at: -1 })
      .lean();

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
    const reactions = await PostReaction.find({ post_id }).populate(
      "user_id",
      "fullName avatar_url"
    ); //Thêm vào các trường tương ứng nếu cần thiết

    //Đếm
    const counts = await PostReaction.aggregate([
      { $match: { post_id: new mongoose.Types.ObjectId(post_id) } },
      { $group: { _id: "$type", count: { $sum: 1 } } },
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
    const { post_id } = req.body;
    const user_id = req.user._id;

    const reactions = await PostReaction.findOne({
      post_id,
      user_id,
    });

    res.status(200).json(reactions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Lấy tất cả bài đăng của người dùng đang đăng nhập
const getRecommendPost = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await userModel.findById(userId).lean();

    // Pagination params
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // 1. Lấy danh sách bạn bè
    const friendships = await Friendship.find({
      $or: [{ user_id_1: userId }, { user_id_2: userId }],
      status: "accepted",
    }).lean();

    const friendIds = friendships.map((f) =>
      f.user_id_1.toString() === userId.toString() ? f.user_id_2 : f.user_id_1
    );

    // 2. Lấy quảng cáo active
    const postAds = await adsModel
      .find({ status: "active" })
      .select("post_id target_location target_age target_gender")
      .lean();

    // 3. Lấy tất cả post (chỉ match, chưa phân trang)
    const posts = await Post.aggregate([
      {
        $match: {
          is_deleted: false,
          $or: [
            { type: "Public" },
            { type: "Friends", user_id: { $in: [...friendIds, userId] } },
          ],
        },
      },
      {
        $lookup: {
          from: "postreactions",
          localField: "_id",
          foreignField: "post_id",
          as: "reactions",
        },
      },
      {
        $lookup: {
          from: "comments",
          localField: "_id",
          foreignField: "post_id",
          as: "comments",
        },
      },
      {
        $addFields: {
          reactionCount: { $size: "$reactions" },
          commentCount: { $size: "$comments" },
        },
      },
    ]);

    // 4. Populate author & shared_post_id
    const populatedPosts = await Post.populate(posts, [
      {
        path: "user_id",
        select: "username avatar_url fullName",
      },
      {
        path: "shared_post_id",
        populate: {
          path: "user_id",
          select: "username avatar_url fullName",
        },
      },
    ]);

    // 5. Populate media
    const postsWithMedia = await Promise.all(
      populatedPosts.map(async (post) => {
        // Media cho post chính
        const postMedia = await PostMedia.findOne({
          post_id: post._id,
        }).populate("media_id");
        let media = [];
        if (postMedia?.media_id?.length > 0) {
          media = postMedia.media_id.map((m) => ({
            url: m.url,
            type: m.media_type,
          }));
        }

        // Nếu có shared_post thì thêm media trực tiếp vào object đó
        let sharedPost = null;
        if (post.shared_post_id) {
          const sharedPostMedia = await PostMedia.findOne({
            post_id: post.shared_post_id._id,
          }).populate("media_id");

          let sharedMedia = [];
          if (sharedPostMedia?.media_id?.length > 0) {
            sharedMedia = sharedPostMedia.media_id.map((m) => ({
              url: m.url,
              type: m.media_type,
            }));
          }

          // clone object mongoose sang plain object + gắn media vào trong
          sharedPost = {
            ...post.shared_post_id.toObject(),
            media: sharedMedia,
          };
        }

        return {
          ...post,
          author: post.user_id,
          media, // media của post chính
          shared_post_id: sharedPost, // shared_post có media nằm trong luôn
        };
      })
    );


    // 6. Lấy tương tác user để ưu tiên
    const reactions = await PostReaction.find({ user_id: userId }).lean();
    const reactedPostIds = reactions.map((r) => r.post_id?.toString());

    const comments = await Comment.find({ user_id: userId }).lean();
    const commentedPostIds = comments.map((c) => c.post_id?.toString());

    // 7. Hàm tính score
    function calculateScore(post, user, reactedPostIds, commentedPostIds) {
      let score = 0;
      let isAd = false;

      const ageInHours = (Date.now() - new Date(post.createdAt)) / 3600000;

      // Recency
      score += Math.max(0, 50 - ageInHours);

      // User interactions
      if (reactedPostIds.includes(post._id.toString())) score += 25;
      if (commentedPostIds.includes(post._id.toString())) score += 35;

      // Social factors
      score += (post.reactionCount || 0) * 1;
      score += (post.commentCount || 0) * 2;
      score += Math.floor((post.viewCount || 0) / 10);

      // Ads targeting
      const ad = postAds.find(
        (a) => a.post_id.toString() === post._id.toString()
      );
      if (ad) {
        isAd = true; // luôn đánh dấu là ads

        const match =
          ad.target_gender.includes(user.gender) ||
          user.age >= ad.target_age.min ||
          user.age <= ad.target_age.max ||
          ad.target_location.includes(user.location);

        if (match) {
          score += 100;
        }
      }

      return { score, isAd };
    }

    // 8. Tính score và sort tất cả
    const scoredPosts = postsWithMedia.map((post) => {
      const { score, isAd } = calculateScore(
        post,
        user,
        reactedPostIds,
        commentedPostIds
      );
      return {
        ...post,
        score,
        isAd,
      };
    });

    scoredPosts.sort((a, b) => b.score - a.score);

    // 9. Slice theo page
    const paginatedPosts = scoredPosts.slice(skip, skip + limit);

    res.json({
      page,
      limit,
      total: scoredPosts.length,
      totalPages: Math.ceil(scoredPosts.length / limit),
      posts: paginatedPosts,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


const getAllPostsbyUserId = async (req, res) => {
  try {
    const userId = req.params.userId;
    const { media_only } = req.query; // Tham số query để lọc posts có media
    
    // Tìm tất cả bài đăng không bị xóa của người dùng, sắp xếp theo thời gian giảm dần
    const posts = await Post.find({ user_id: userId, is_deleted: false })
      .sort({ createdAt: -1 })
      .populate("user_id", "username avatar_url fullName") // Nạp thông tin người dùng
      .lean();
    
    // Nạp thông tin media cho mỗi bài đăng
    const populatedPosts = await Promise.all(
      posts.map(async (post) => {
        // Lấy 1 document PostMedia cho mỗi post
        const postMedia = await PostMedia.findOne({
          post_id: post._id,
        }).populate("media_id");
        let media = [];
        if (postMedia && postMedia.media_id && postMedia.media_id.length > 0) {
          media = postMedia.media_id.map((m) => ({
            url: m.url,
            type: m.media_type,
          }));
        }
        const { user_id, ...rest } = post;

        return {
          ...rest,
          author: user_id, // Rename user_id => author
          media,
        };
      })
    );
    
    // Lọc posts có media nếu media_only được truyền vào
    let filteredPosts = populatedPosts;
    if (media_only && (media_only === 'true' || media_only === '1')) {
      filteredPosts = populatedPosts.filter(post => post.media && post.media.length > 0);
    }
    
    res.json(filteredPosts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const searchPost = async (req, res) => {
  try {
    const { query } = req.query;
    const posts = await Post.find({
      content: { $regex: query, $options: "i" },
      is_deleted: false,
    })
      .sort({ createdAt: -1 })
      .populate("user_id", "username avatar_url fullName") // Nạp thông tin người dùng
      .lean();
    // Nạp thông tin media cho mỗi bài đăng
    const populatedPosts = await Promise.all(
      posts.map(async (post) => {
        // Lấy 1 document PostMedia cho mỗi post
        const postMedia = await PostMedia.findOne({
          post_id: post._id,
        }).populate("media_id");
        let media = [];
        if (postMedia && postMedia.media_id && postMedia.media_id.length > 0) {
          media = postMedia.media_id.map((m) => ({
            url: m.url,
            type: m.media_type,
          }));
        }
        const { user_id, ...rest } = post;

        return {
          ...rest,
          author: user_id, // Rename user_id => author
          media,
        };
      })
    );
    res.json(populatedPosts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const increaseViewCount = async (req, res) => {
  try {
    const postId = req.params.id;
    await Post.findByIdAndUpdate(postId, { $inc: { viewCount: 1 } });
    res.status(200).json({ message: "View count increased" });
  } catch (err) {
    console.error(err);
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
  sharePost,
  getRecommendPost,
  getAllPostsbyUserId,
  searchPost,
  increaseViewCount,
};
