const Fuse = require("fuse.js");

const Post = require("../models/post.model");
const Media = require("../models/media.model");
const PostMedia = require("../models/postMedia.model");
const PostReaction = require("../models/Comment_Reaction/post_reaction.model");
const adsModel = require("../models/Payment_Ads/ads.model");
const userModel = require("../models/user.model");
const Friendship = require("../models/friendship.model");
const Comment = require("../models/Comment_Reaction/comment.model");
const Activity = require("../models/Payment_Ads/activity-ads.model");
const mongoose = require("mongoose");
const notificationService = require("../services/notification.service");
const { getSocketIO, getUserSocketMap, getNotificationUserSocketMap } = require("../socket/io-instance");
const moderationService = require("../queues/moderationQueue");
const NodeCache = require("node-cache");
const { calculatePostScore } = require("../services/scoring.service");
const User = require("../models/user.model");
const commentModel = require("../models/Comment_Reaction/comment.model");
const postMediaModel = require("../models/postMedia.model");

// Tạo bài đăng mới với tệp media (nếu có)
const createPost = async (req, res) => {
  try {
    const { content, type, media } = req.body;
    const userId = req.user._id;

    // Tạo bài đăng mới
    let post = await Post.create({
      content,
      user_id: userId,
      type,
    });

    const mediaIds = [];

    // Nếu có media URL được gửi từ FE
    if (media && Array.isArray(media) && media.length > 0) {
      for (const item of media) {
        // Tạo bản ghi media
        const mediaDoc = await Media.create({
          user_id: userId,
          url: item.url,
          media_type: item.media_type || "image",
        });
        mediaIds.push(mediaDoc._id);
      }

      // Liên kết media với post
      await PostMedia.create({
        type: "post",
        post_id: post._id,
        media_id: mediaIds,
      });
    }

    // Kiểm duyệt hình ảnh
    const getMedia = await PostMedia.findOne({ post_id: post._id }).populate("media_id");

    if (getMedia && getMedia.media_id.length > 0) {
      if (getMedia.media_id.length === 1) {
        await moderationService.checkSinglePostImage(
          post._id,
          getMedia.media_id[0].url,
          getMedia.media_id[0].media_type
        );
      } else {
        await moderationService.checkPostWithMultipleImages(
          post._id,
          getMedia.media_id.map((m) => ({
            url: m.url,
            mediaType: m.media_type,
          }))
        );
        console.log(`Multiple images moderation queued for post ${post._id}`);
      }
    }

    // Populate media cho response
    const postMedia = await PostMedia.findOne({ post_id: post._id }).populate("media_id");

    const mediaData =
      postMedia?.media_id?.map((m) => ({
        url: m.url,
        type: m.media_type,
      })) || [];

    const author = await userModel.findById(userId).select("username avatar_url fullName");
    res.status(201).json({
      message: "Post created successfully",
      post: {
        ...post.toObject(),
        author,
        media: mediaData,
      },
    });
  } catch (err) {
    console.error("Lỗi tạo bài đăng:", err);
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
const getPostById = async (req, res) => {
  try {
    const postId = req.params.id;
    const userId = req.user._id.toString();

    // Tìm bài đăng theo ID
    const post = await Post.findById(postId)
      .populate("user_id", "username avatar_url fullName is_deleted")
      .populate({
        path: "shared_post_id",
        populate: { path: "user_id", select: "username avatar_url fullName is_deleted" },
      })
      .lean();

    if (!post) return res.status(404).json({ message: "Post not found" });

    // Nếu post chính bị xoá và user không phải tác giả → trả 410
    if (post.is_deleted && post.user_id?._id.toString() !== userId) {
      return res.status(410).json({ message: "Post has been deleted" });
    }

    // Quyền truy cập cho post Private
    if (post.type === "Private" && post.user_id?._id.toString() !== userId) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Kiểm tra author của post chính
    const isAuthorDeleted = post.user_id?.is_deleted;
    const author = isAuthorDeleted ? { username: "Unknown", avatar_url: null, fullName: null } : post.user_id;

    // Media cho post chính
    const postMedia = await PostMedia.findOne({ post_id: post._id }).populate("media_id").lean();
    const media = postMedia?.media_id?.map((m) => ({ url: m.url, type: m.media_type })) || [];

    // Shared post
    let sharedPost = null;
    if (post.shared_post_id) {
      const sharedDeleted = post.shared_post_id.is_deleted;
      const sharedAuthorDeleted = post.shared_post_id.user_id?.is_deleted;
      sharedPost = {
        ...post.shared_post_id,
        content: sharedDeleted || sharedAuthorDeleted ? "Post is not available" : post.shared_post_id.content,
        author: sharedAuthorDeleted
          ? { username: "Unknown", avatar_url: null, fullName: null }
          : post.shared_post_id.user_id,
        media: [],
      };

      if (!sharedDeleted && !sharedAuthorDeleted) {
        const sharedMedia = await PostMedia.findOne({ post_id: post.shared_post_id._id }).populate("media_id").lean();
        sharedPost.media = sharedMedia?.media_id?.map((m) => ({ url: m.url, type: m.media_type })) || [];
      }
    }

    // Reaction và comment count
    const [reactions, comments] = await Promise.all([
      PostReaction.find({ post_id: post._id }).lean(),
      Comment.find({ post_id: post._id, is_deleted: false }).lean(),
    ]);

    const reactionCount = reactions.length;
    const commentCount = comments.length;

    // Trả về response
    const { user_id, shared_post_id, ...rest } = post;
    res.json({
      ...rest,
      author,
      shared_post_id: sharedPost,
      media,
      reactionCount,
      commentCount,
    });
  } catch (err) {
    console.error(err);
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
        message: "Post not found or you do not have permission to edit this post",
      });

    // Cập nhật nội dung và thời gian cập nhật
    post.content = content || post.content;
    post.updated_at = new Date();

    await post.save();

    res.json({ message: "Post updated successfully" });
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
      is_deleted: false,
    });
    if (!post) return res.status(404).json({ message: "Post not found or has been deleted" });

    // Kiểm tra xem bài đăng có quảng cáo đang hoạt động không
    const activeAds = await adsModel.find({
      post_id: postId,
      status: { $in: ["active", "paused", "waiting_payment"] },
    });
    if (activeAds.length > 0) {
      return res.status(400).json({
        message:
          "Cannot delete this post because there are active ads. Please stop or cancel the ads before deleting the post.",
        hasActiveAds: true,
      });
    }

    // Đánh dấu bài đăng đã bị xóa và lưu thời gian xóa
    post.is_deleted = true;
    post.deleted_at = new Date();
    await post.save();

    res.status(200).json({
      message: "Post has been moved to trash. It will be permanently deleted after 7 days.",
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
      is_deleted: true,
    });
    if (!post)
      return res.status(404).json({
        message: "Post not found or not in trash",
      });

    // Kiểm tra xem bài đăng có quá hạn khôi phục không (7 ngày)
    const now = new Date();
    const expiredDate = new Date(post.deleted_at.getTime() + 7 * 24 * 60 * 60 * 1000);

    if (now > expiredDate) {
      return res.status(410).json({ message: "Cannot restore post. It has expired." });
    }

    // Đánh dấu bài đăng chưa bị xóa và xóa thời gian xóa
    post.is_deleted = false;
    post.deleted_at = null;
    await post.save();

    res.json({ message: "Post restored successfully." });
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
    if (type === null || type === "null") {
      const deletedReaction = await PostReaction.findOneAndDelete({
        user_id,
        post_id,
      });
      // Chỉ giảm counter nếu thực sự có reaction bị xóa
      if (deletedReaction) {
        await adsModel.updateOne({ post_id: post_id, status: "active" }, [
          {
            $set: {
              total_interactions: {
                $max: [{ $subtract: ["$total_interactions", 1] }, 0],
              },
            },
          },
        ]);
      }
      return res.status(201).json({ message: "Reaction saved", reaction: deletedReaction });
    }
    if (!type) type = "like"; // Mặc định là "like" nếu không có type

    // Kiểm tra xem user đã react post này chưa
    const existingReaction = await PostReaction.findOne({ user_id, post_id });
    const isNewReaction = !existingReaction;

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

    // Chỉ tăng total_interactions nếu là reaction mới (chưa từng react)
    if (isNewReaction) {
      await adsModel.updateOne({ post_id: post_id, status: "active" }, [
        {
          $set: {
            total_interactions: { $add: ["$total_interactions", 1] },
          },
        },
      ]);
    }

    // Gửi thông báo cho chủ post
    try {
      const post = await Post.findById(post_id);
      if (post && post.user_id.toString() !== user_id.toString()) {
        // Lấy danh sách user đã react (trừ chủ post)
        const reactions = await PostReaction.find({ post_id }).populate("user_id", "username fullName");
        const otherReactUsers = reactions.filter(
          (r) => r.user_id && r.user_id._id.toString() !== post.user_id.toString()
        );
        if (otherReactUsers.length > 0) {
          const currentUser = otherReactUsers.find((r) => r.user_id._id.toString() === user_id.toString());
          const otherCount = otherReactUsers.length - 1;
          let contentNoti = "";
          if (otherCount > 0) {
            contentNoti = `${
              currentUser.user_id.fullName || currentUser.user_id.username
            } and ${otherCount} others have reacted to your post.`;
          } else {
            contentNoti = `${currentUser.user_id.fullName || currentUser.user_id.username} has reacted to your post.`;
          }
          const io = getSocketIO();
          const notificationsNamespace = io.of("/notifications");
          const notificationUserSocketMap = getNotificationUserSocketMap();
          await notificationService.createNotificationWithNamespace(
            notificationsNamespace,
            post.user_id,
            "post_reaction",
            contentNoti,
            notificationUserSocketMap,
            {
              fromUser: user_id,
              relatedId: post_id,
            }
          );
        }
      }
    } catch (notifyErr) {
      console.error("Không thể gửi thông báo reaction bài viết:", notifyErr);
    }

    return res.status(201).json({ message: "Reaction saved", reaction });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Lấy tất cả reaction của 1 post
const getReactionsOfPost = async (req, res) => {
  try {
    const { post_id } = req.params;
    const reactions = await PostReaction.find({ post_id }).populate("user_id", "fullName avatar_url");

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

// Cache cho static data
const staticCache = new NodeCache({ stdTTL: 300, checkperiod: 60 }); // 5 phút

function createNaturalMixFeed(organicPosts, adPosts, config = {}) {
  const {
    maxAdDensity = 0.15, // Tối đa 15% là ads
    minPostsBeforeFirstAd = 3, // Ít nhất 3 bài trước ad đầu tiên
    minSpacingBetweenAds = 4, // Ít nhất 4 bài giữa 2 ads
    randomSpacingRange = 2, // Random ±2 để tự nhiên
  } = config;

  // Nếu không có ads, trả về organic posts
  if (!adPosts.length) {
    return organicPosts;
  }

  if (!organicPosts.length) {
    return adPosts;
  }

  // Giới hạn số ads theo maxAdDensity
  const maxAdsAllowed = Math.floor((organicPosts.length * maxAdDensity) / (1 - maxAdDensity));
  const adsToUse = adPosts.slice(0, Math.min(maxAdsAllowed, adPosts.length));
  const totalPosts = organicPosts.length + adsToUse.length;

  // ✅ TÍNH TOÁN VỊ TRÍ QUẢNG CÁO
  const adPositions = calculateAdPositions(organicPosts.length, adsToUse.length, {
    minPostsBeforeFirstAd,
    minSpacingBetweenAds,
    randomSpacingRange,
  });

  // ✅ MERGE ORGANIC + ADS
  const finalFeed = [];
  let organicIndex = 0;
  let adIndex = 0;

  for (let position = 0; position < totalPosts; position++) {
    // Kiểm tra có cần chèn ad tại vị trí này không
    if (adPositions.includes(position) && adIndex < adsToUse.length) {
      finalFeed.push(adsToUse[adIndex]);
      adIndex++;
    } else if (organicIndex < organicPosts.length) {
      finalFeed.push(organicPosts[organicIndex]);
      organicIndex++;
    }
  }

  // Thêm các bài organic còn lại (nếu có)
  while (organicIndex < organicPosts.length) {
    finalFeed.push(organicPosts[organicIndex]);
    organicIndex++;
  }

  return finalFeed;
}

/**
 * Tính toán vị trí chèn quảng cáo
 */
function calculateAdPositions(
  organicCount,
  adCount,
  { minPostsBeforeFirstAd, minSpacingBetweenAds, randomSpacingRange }
) {
  const positions = [];

  if (adCount === 0 || organicCount === 0) {
    return positions;
  }

  // Tính khoảng cách trung bình giữa các ads
  const totalSlots = organicCount + adCount;
  const averageSpacing = Math.floor(totalSlots / (adCount + 1));

  let currentPosition = minPostsBeforeFirstAd;

  for (let i = 0; i < adCount; i++) {
    // Random spacing trong khoảng cho phép
    const randomOffset = Math.floor(Math.random() * (randomSpacingRange * 2 + 1) - randomSpacingRange);

    const spacing =
      i === 0 ? minPostsBeforeFirstAd + randomOffset : Math.max(minSpacingBetweenAds, averageSpacing + randomOffset);

    currentPosition += spacing;

    // Đảm bảo không vượt quá số lượng posts
    if (currentPosition >= totalSlots) {
      break;
    }

    positions.push(currentPosition);

    // Di chuyển position sang vị trí tiếp theo (tính cả ad vừa chèn)
    currentPosition += 1;
  }

  return positions.sort((a, b) => a - b);
}

/**
 * API: GET /post/recommend
 * Query params: page, limit, lat, lng
 * Headers: X-Client-IP (optional)
 */
const getRecommendPost = async (req, res) => {
  const startTime = Date.now();

  try {
    const userId = req.user._id;
    const userLocation = req.userLocation; // Từ middleware

    // Pagination
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
    const skip = (page - 1) * limit;

    // Lấy user info
    const user = await userModel.findById(userId).select("username gender age location").lean();

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // === FETCH DATA SONG SONG ===
    const [friendships, postAds, reactions, comments] = await Promise.all([
      // 1. Friendships
      Friendship.find({
        $or: [{ user_id_1: userId }, { user_id_2: userId }],
        status: "accepted",
      })
        .select("user_id_1 user_id_2")
        .lean(),

      // 2. Active ads (cache 5 phút)
      getCachedAds(),

      // 3. User reactions
      PostReaction.find({ user_id: userId }).select("post_id").lean(),

      // 4. User comments
      Comment.find({ user_id: userId, is_deleted: false }).select("post_id").lean(),
    ]);

    // Convert to Sets for O(1) lookup
    const friendIds = new Set(
      friendships.map((f) =>
        f.user_id_1.toString() === userId.toString() ? f.user_id_2.toString() : f.user_id_1.toString()
      )
    );

    const reactedPostIds = new Set(reactions.map((r) => r.post_id?.toString()).filter(Boolean));

    const commentedPostIds = new Set(comments.map((c) => c.post_id?.toString()).filter(Boolean));

    // === AGGREGATE POSTS ===
    const posts = await Post.aggregate([
      // Match: visible posts
      {
        $match: {
          is_deleted: false,
          $or: [
            { type: "Public" },
            {
              type: "Friends",
              user_id: { $in: [userId, ...Array.from(friendIds)] },
            },
          ],
        },
      },

      // Lookup reactions
      {
        $lookup: {
          from: "postreactions",
          localField: "_id",
          foreignField: "post_id",
          as: "reactions",
        },
      },

      // Lookup comments
      {
        $lookup: {
          from: "comments",
          let: { postId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$post_id", "$$postId"] },
                is_deleted: false,
              },
            },
          ],
          as: "comments",
        },
      },

      // Lookup shares count
      {
        $lookup: {
          from: "posts",
          let: { postId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$shared_post_id", "$$postId"] },
                is_deleted: false,
              },
            },
            { $count: "count" },
          ],
          as: "shares_count",
        },
      },

      // Add computed fields
      {
        $addFields: {
          reactionCount: { $size: "$reactions" },
          commentCount: { $size: "$comments" },
          sharesCount: {
            $ifNull: [{ $arrayElemAt: ["$shares_count.count", 0] }, 0],
          },
        },
      },

      // Remove unnecessary fields
      {
        $project: {
          reactions: 0,
          comments: 0,
          shares_count: 0,
        },
      },

      // Sort by recency first (trước khi score)
      { $sort: { createdAt: -1 } },

      // Limit to reasonable number trước khi populate
      { $limit: Math.max(limit * 5, 100) }, // Lấy 5x posts để có buffer
    ]);

    // === POPULATE USER & MEDIA ===
    const populatedPosts = await Post.populate(posts, [
      {
        path: "user_id",
        select: "username avatar_url fullName",
      },
      {
        path: "shared_post_id",
        populate: {
          path: "user_id",
          select: "username avatar_url fullName is_deleted",
        },
      },
    ]);

    // Populate media (batch query thay vì N+1)
    const postIds = populatedPosts.map((p) => p._id);
    const sharedPostIds = populatedPosts.map((p) => p.shared_post_id?._id).filter(Boolean);

    const allPostIds = [...postIds, ...sharedPostIds];

    const postMedias = await PostMedia.find({
      post_id: { $in: allPostIds },
    })
      .populate("media_id")
      .lean();

    // Map media by post_id
    const mediaMap = new Map();
    postMedias.forEach((pm) => {
      const media = (pm.media_id || []).map((m) => ({
        url: m.url,
        type: m.media_type,
      }));
      mediaMap.set(pm.post_id.toString(), media);
    });

    // Attach media & handle shared posts
    const postsWithMedia = populatedPosts.map((post) => {
      const media = mediaMap.get(post._id.toString()) || [];

      let sharedPost = null;
      if (post.shared_post_id) {
        const sharedAuthor = post.shared_post_id.user_id;
        const sharedPostDeleted = post.shared_post_id.is_deleted;

        // Nếu user đã bị xoá (is_deleted = true)
        const isUserDeleted = sharedAuthor?.is_deleted;
        sharedPost = {
          ...post.shared_post_id.toObject(),
          content: isUserDeleted || sharedPostDeleted ? "Post is not available" : post.shared_post_id.content,
          author: isUserDeleted ? { username: "Unknown", avatar_url: null } : sharedAuthor,
          media: isUserDeleted || sharedPostDeleted ? [] : mediaMap.get(post.shared_post_id._id.toString()) || [],
        };
      }

      return {
        ...post,
        media,
        shared_post_id: sharedPost,
        randomKey: Math.random(),
      };
    });

    // === CALCULATE SCORES ===
    const context = {
      user,
      userLocation,
      reactedPostIds,
      commentedPostIds,
      friendIds,
      postAds,
    };

    const scoredPosts = postsWithMedia.map((post) => {
      const scoreResult = calculatePostScore(post, context);

      return {
        _id: post._id,
        content: post.content,
        type: post.type,
        author: post.user_id,
        media: post.media,
        shared_post_id: post.shared_post_id,
        reactionCount: post.reactionCount,
        commentCount: post.commentCount,
        sharesCount: post.sharesCount,
        viewCount: post.viewCount || 0,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,

        // Scoring metadata
        score: scoreResult.score,
        isAd: scoreResult.isAd,
        adMatches: scoreResult.adMatches,
        randomKey: post.randomKey,
      };
    });

    // Sort by final score
    scoredPosts.sort((a, b) => b.score - a.score || a.randomKey - b.randomKey);

    // ✅ ============== NATURAL MIX ALGORITHM ==============
    const adPosts = scoredPosts.filter((p) => p.isAd);
    const organicPosts = scoredPosts.filter((p) => !p.isAd);

    const finalPosts = createNaturalMixFeed(organicPosts, adPosts, {
      maxAdDensity: 0.3, // 15% là ads (1 ad mỗi ~6-7 posts)
      minPostsBeforeFirstAd: 3, // Ít nhất 3 bài trước ad đầu tiên
      minSpacingBetweenAds: 4, // Ít nhất 4 bài giữa 2 ads
      randomSpacingRange: 2, // Random ±2 bài để tự nhiên hơn
    });
    // ✅ ================================================

    // Pagination
    const paginatedPosts = finalPosts.slice(skip, skip + limit);

    // Get total count
    const totalPosts = finalPosts.length;

    // Response
    const responseTime = Date.now() - startTime;

    res.json({
      success: true,
      page,
      limit,
      total: totalPosts,
      totalPages: Math.ceil(totalPosts / limit),
      posts: paginatedPosts,

      // Metadata
      meta: {
        responseTime: `${responseTime}ms`,
        userLocation: userLocation?.displayName || "Unknown",
        locationSource: userLocation?.source || "none",
        locationCacheHit: req.locationCacheHit || false,
        adsCount: adPosts.length,
        organicCount: organicPosts.length,
        adDensity: `${((adPosts.length / finalPosts.length) * 100).toFixed(1)}%`,
        feedComposition: {
          totalPosts: finalPosts.length,
          ads: adPosts.length,
          organic: organicPosts.length,
        },
      },
    });
  } catch (err) {
    console.error("[RecommendPost] Error:", {
      message: err.message,
      stack: err.stack,
      userId: req.user?._id,
    });

    res.status(500).json({
      success: false,
      error: "Failed to get recommended posts",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

/**
 * Get cached ads
 */
async function getCachedAds() {
  const cacheKey = "active_ads";
  let ads = staticCache.get(cacheKey);

  if (!ads) {
    ads = await adsModel
      .find({ status: "active" })
      .select("post_id target_location target_age target_gender priority")
      .lean();

    staticCache.set(cacheKey, ads, 300); // Cache 5 phút
  }

  return ads;
}

// Expose cache clear function
const clearRecommendCache = () => {
  staticCache.flushAll();
  console.log("[Cache] Recommend cache cleared");
};

const getAllPostsbyUserId = async (req, res) => {
  try {
    const userId = req.params.userId;
    const { media_only } = req.query;

    const posts = await Post.find({ user_id: userId, is_deleted: false }).sort({ createdAt: -1 }).lean();

    const populatedPosts = await Post.populate(posts, [
      { path: "user_id", select: "username avatar_url fullName is_deleted" },
      { path: "shared_post_id", populate: { path: "user_id", select: "username avatar_url fullName is_deleted" } },
    ]);

    const postsWithMedia = await Promise.all(
      populatedPosts.map(async (post) => {
        const authorDeleted = post.user_id?.is_deleted;
        const author = authorDeleted ? { username: "Unknown", avatar_url: null, fullName: null } : post.user_id;

        let media = [];
        const postMedia = await PostMedia.findOne({ post_id: post._id }).populate("media_id").lean();
        if (postMedia?.media_id?.length > 0) {
          media = postMedia.media_id.map((m) => ({ url: m.url, type: m.media_type }));
        }

        let sharedPost = null;
        if (post.shared_post_id) {
          const sharedDeleted = post.shared_post_id.is_deleted;
          const sharedAuthorDeleted = post.shared_post_id.user_id?.is_deleted;
          sharedPost = {
            ...post.shared_post_id.toObject(),
            content: sharedDeleted || sharedAuthorDeleted ? "Post is not available" : post.shared_post_id.content,
            author: sharedAuthorDeleted ? { username: "Unknown", avatar_url: null } : post.shared_post_id.user_id,
            media: [],
          };
          if (!sharedDeleted && !sharedAuthorDeleted) {
            const sharedMedia = await PostMedia.findOne({ post_id: post.shared_post_id._id })
              .populate("media_id")
              .lean();
            sharedPost.media = sharedMedia?.media_id?.map((m) => ({ url: m.url, type: m.media_type })) || [];
          }
        }

        return {
          ...post,
          author,
          media,
          shared_post_id: sharedPost,
        };
      })
    );

    const filteredPosts =
      media_only && (media_only === "true" || media_only === "1")
        ? postsWithMedia.filter((post) => post.media.length > 0)
        : postsWithMedia;

    res.json(filteredPosts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Cache Fuse instance
const postFuseCache = new Map();

// Hàm chuẩn hóa tiếng Việt
function removeAccents(str) {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

// Tạo cache key
function getCacheKey(userId, friendIds) {
  return `${userId}_${friendIds.sort().join(",")}`;
}

const searchPost = async (req, res) => {
  const { query, page = 1, limit = 10 } = req.query;
  const userId = req.user._id.toString();
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);

  try {
    // 1. Lấy danh sách bạn bè
    const friendships = await Friendship.find({
      $or: [{ user_id_1: userId }, { user_id_2: userId }],
      status: "accepted",
    }).lean();

    const friendIds = friendships.map((f) =>
      f.user_id_1.toString() === userId ? f.user_id_2.toString() : f.user_id_1.toString()
    );

    // 2. Lấy tất cả bài post cần tìm kiếm
    const posts = await Post.find({
      is_deleted: false,
      $or: [{ type: "Public" }, { type: "Friends", user_id: { $in: [...friendIds, userId] } }],
    })
      .lean()
      .select("_id content user_id type createdAt shared_post_id")
      .sort({ createdAt: -1 });

    if (posts.length === 0) {
      return res.json({ data: [], total: 0, page: pageNum, limit: limitNum });
    }

    // 3. Fuse.js
    const cacheKey = getCacheKey(userId, friendIds);
    let fuse = postFuseCache.get(cacheKey);
    if (!fuse) {
      fuse = new Fuse(posts, {
        keys: ["content"],
        threshold: 0.4,
        includeScore: true,
        shouldSort: true,
        minMatchCharLength: 1,
        ignoreLocation: true,
        getFn: (obj, path) => removeAccents(obj[path] || ""),
      });
      postFuseCache.set(cacheKey, fuse);
      if (postFuseCache.size > 50) postFuseCache.delete(postFuseCache.keys().next().value);
    }

    let results = posts;
    if (query && query.trim()) {
      results = fuse.search(query.trim()).map((r) => r.item);
    }

    // 4. Phân trang
    const total = results.length;
    const start = (pageNum - 1) * limitNum;
    const paginated = results.slice(start, start + limitNum);

    // 5. Gắn author, media, reactions, comments, shared post
    const postsWithDetails = await Promise.all(
      paginated.map(async (post) => {
        const [authorDoc, reactions, comments, shares, postMedia] = await Promise.all([
          User.findById(post.user_id).lean().select("username avatar_url fullName is_deleted"),
          PostReaction.countDocuments({ post_id: post._id }),
          Comment.countDocuments({ post_id: post._id, is_deleted: false }),
          Post.countDocuments({ shared_post_id: post._id, is_deleted: false }),
          PostMedia.findOne({ post_id: post._id }).populate("media_id").lean(),
        ]);

        const isAuthorDeleted = authorDoc?.is_deleted;
        const author = isAuthorDeleted ? { username: "Unknown", avatar_url: null, fullName: null } : authorDoc;

        const media = postMedia?.media_id?.map((m) => ({ url: m.url, type: m.media_type })) || [];

        // Shared post
        let sharedPost = null;
        if (post.shared_post_id) {
          const shared = await Post.findById(post.shared_post_id).lean();
          if (shared) {
            const sharedAuthorDoc = await User.findById(shared.user_id)
              .lean()
              .select("username avatar_url fullName is_deleted");
            const sharedAuthorDeleted = sharedAuthorDoc?.is_deleted;
            sharedPost = {
              ...shared,
              content: sharedAuthorDeleted || shared.is_deleted ? "Post is not available" : shared.content,
              author: sharedAuthorDeleted ? { username: "Unknown", avatar_url: null } : sharedAuthorDoc,
              media: [],
            };
            if (!sharedAuthorDeleted && !shared.is_deleted) {
              const sharedMedia = await PostMedia.findOne({ post_id: shared._id }).populate("media_id").lean();
              sharedPost.media = sharedMedia?.media_id?.map((m) => ({ url: m.url, type: m.media_type })) || [];
            }
          }
        }

        return {
          ...post,
          author,
          media,
          shared_post_id: sharedPost,
          reactionCount: reactions,
          commentCount: comments,
          shares_count: shares,
        };
      })
    );

    res.json({
      data: postsWithDetails,
      total,
      page: pageNum,
      limit: limitNum,
      hasMore: start + limitNum < total,
    });
  } catch (err) {
    console.error("Search post error:", err);
    res.status(500).json({ error: "Lỗi tìm kiếm bài viết" });
  }
};

// Helper function to create progress activities
const createProgressActivities = async (ads, oldViews, newViews) => {
  const oldProgress = (oldViews / ads.target_views) * 100;
  const newProgress = (newViews / ads.target_views) * 100;

  const milestones = [
    { percent: 25, type: "progress_25" },
    { percent: 50, type: "progress_50" },
    { percent: 75, type: "progress_75" },
  ];

  for (const milestone of milestones) {
    if (oldProgress < milestone.percent && newProgress >= milestone.percent) {
      await Activity.create({
        user_id: ads.user_id,
        ads_id: ads._id,
        type: milestone.type,
        metadata: {
          campaign_name: ads.campaign_name,
          progress_percent: milestone.percent,
          views_count: newViews,
        },
      });
    }
  }
};

const increaseViewCount = async (req, res) => {
  try {
    const postId = req.params.id;

    // Lấy thông tin ads trước khi update (để so sánh progress)
    const adsBeforeUpdate = await adsModel.findOne({
      post_id: postId,
      status: "active",
    });

    // Tăng view count của Post
    await Post.findByIdAndUpdate(postId, { $inc: { viewCount: 1 } });

    // Cập nhật Ads với atomic operation
    const updateResult = await adsModel.updateOne(
      {
        post_id: postId,
        status: "active",
      },
      [
        {
          $set: {
            current_views: {
              $min: [{ $add: ["$current_views", 1] }, "$target_views"],
            },
            status: {
              $cond: {
                if: {
                  $gte: [{ $add: ["$current_views", 1] }, "$target_views"],
                },
                then: "completed",
                else: "active",
              },
            },
            completed_at: {
              $cond: {
                if: {
                  $gte: [{ $add: ["$current_views", 1] }, "$target_views"],
                },
                then: new Date(),
                else: "$completed_at",
              },
            },
          },
        },
      ]
    );

    // Tạo activities nếu có ads được update
    if (updateResult.modifiedCount > 0 && adsBeforeUpdate) {
      const adsAfterUpdate = await adsModel.findById(adsBeforeUpdate._id);

      // Tạo progress activities (25%, 50%, 75%)
      await createProgressActivities(adsAfterUpdate, adsBeforeUpdate.current_views, adsAfterUpdate.current_views);

      // Tạo completed activity
      if (adsAfterUpdate.status === "completed" && adsBeforeUpdate.status === "active") {
        await Activity.create({
          user_id: adsAfterUpdate.user_id,
          ads_id: adsAfterUpdate._id,
          type: "campaign_completed",
          metadata: {
            campaign_name: adsAfterUpdate.campaign_name,
            views_count: adsAfterUpdate.current_views,
          },
        });
      }
    }

    res.status(200).json({ message: "View count increased" });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Failed to increase view count",
      error: err.message,
    });
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
  getReactionsOfPost,
  getUserReactionsForPosts,
  sharePost,
  getRecommendPost,
  clearRecommendCache,
  getAllPostsbyUserId,
  searchPost,
  increaseViewCount,
};
