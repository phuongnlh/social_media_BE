const Media = require("../models/media.model");
const PostMedia = require("../models/postMedia.model");
const Post = require("../models/post.model");

/**
 * Lấy tất cả hình ảnh mà user đã đăng
 * @param {*} req 
 * @param {*} res 
 */
const getUserImages = async (req, res) => {
  try {
    const { user_id } = req.params;
    const { page = 1, limit = 20, type = "image" } = req.query;

    // Tìm tất cả posts của user
    const userPosts = await Post.find({
      user_id: user_id,
      is_deleted: false
    }).select('_id');

    if (!userPosts.length) {
      return res.status(200).json({
        success: true,
        data: [],
        pagination: {
          total: 0,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: 0
        },
        message: "No posts found for this user"
      });
    }

    const postIds = userPosts.map(post => post._id);

    // Tìm tất cả media của các posts này
    const postMedias = await PostMedia.find({
      post_id: { $in: postIds },
      type: "post"
    }).populate({
      path: 'media_id',
      match: { media_type: type }, // Lọc theo loại media (image/video)
      select: 'url media_type createdAt'
    }).populate({
      path: 'post_id',
      select: 'content createdAt user_id',
      populate: {
        path: 'user_id',
        select: 'fullName avatar_url'
      }
    });

    // Flatten và filter media
    let mediaList = [];
    postMedias.forEach(postMedia => {
      if (postMedia.media_id && postMedia.media_id.length > 0) {
        postMedia.media_id.forEach(media => {
          if (media) { // Check if media exists after populate filter
            mediaList.push({
              _id: media._id,
              url: media.url,
              media_type: media.media_type,
              createdAt: media.createdAt,
              post: {
                _id: postMedia.post_id._id,
                content: postMedia.post_id.content,
                createdAt: postMedia.post_id.createdAt,
                user: postMedia.post_id.user_id
              }
            });
          }
        });
      }
    });

    // Sort by creation date (newest first)
    mediaList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Pagination
    const total = mediaList.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedMedia = mediaList.slice(startIndex, endIndex);

    res.status(200).json({
      success: true,
      data: paginatedMedia,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error("Error in getUserImages:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Lấy tất cả video mà user đã đăng
 * @param {*} req 
 * @param {*} res 
 */
const getUserVideos = async (req, res) => {
  try {
    // Reuse getUserImages logic but with type=video
    req.query.type = "video";
    return getUserImages(req, res);
  } catch (error) {
    console.error("Error in getUserVideos:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Lấy tất cả media (images + videos) mà user đã đăng
 * @param {*} req 
 * @param {*} res 
 */
const getUserAllMedia = async (req, res) => {
  try {
    const { user_id } = req.params;
    const { page = 1, limit = 20 } = req.query;

    // Tìm tất cả posts của user
    const userPosts = await Post.find({
      user_id: user_id,
      is_deleted: false
    }).select('_id');

    if (!userPosts.length) {
      return res.status(200).json({
        success: true,
        data: [],
        pagination: {
          total: 0,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: 0
        },
        message: "No posts found for this user"
      });
    }

    const postIds = userPosts.map(post => post._id);

    // Tìm tất cả media của các posts này (không filter theo type)
    const postMedias = await PostMedia.find({
      post_id: { $in: postIds },
      type: "post"
    }).populate({
      path: 'media_id',
      select: 'url media_type createdAt'
    }).populate({
      path: 'post_id',
      select: 'content createdAt user_id',
      populate: {
        path: 'user_id',
        select: 'fullName avatar_url'
      }
    });

    // Flatten media
    let mediaList = [];
    postMedias.forEach(postMedia => {
      if (postMedia.media_id && postMedia.media_id.length > 0) {
        postMedia.media_id.forEach(media => {
          mediaList.push({
            _id: media._id,
            url: media.url,
            media_type: media.media_type,
            createdAt: media.createdAt,
            post: {
              _id: postMedia.post_id._id,
              content: postMedia.post_id.content,
              createdAt: postMedia.post_id.createdAt,
              user: postMedia.post_id.user_id
            }
          });
        });
      }
    });

    // Sort by creation date (newest first)
    mediaList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    // Pagination
    const total = mediaList.length;
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedMedia = mediaList.slice(startIndex, endIndex);

    res.status(200).json({
      success: true,
      data: paginatedMedia,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error("Error in getUserAllMedia:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

/**
 * Lấy thống kê media của user
 * @param {*} req 
 * @param {*} res 
 */
const getUserMediaStats = async (req, res) => {
  try {
    const { user_id } = req.params;

    // Tìm tất cả posts của user
    const userPosts = await Post.find({
      user_id: user_id,
      is_deleted: false
    }).select('_id');

    if (!userPosts.length) {
      return res.status(200).json({
        success: true,
        data: {
          totalImages: 0,
          totalVideos: 0,
          totalMedia: 0,
          recentMedia: []
        }
      });
    }

    const postIds = userPosts.map(post => post._id);

    // Tìm tất cả media
    const postMedias = await PostMedia.find({
      post_id: { $in: postIds },
      type: "post"
    }).populate({
      path: 'media_id',
      select: 'url media_type createdAt'
    });

    // Đếm media
    let totalImages = 0;
    let totalVideos = 0;
    let recentMedia = [];

    postMedias.forEach(postMedia => {
      if (postMedia.media_id && postMedia.media_id.length > 0) {
        postMedia.media_id.forEach(media => {
          if (media.media_type === 'image') {
            totalImages++;
          } else if (media.media_type === 'video') {
            totalVideos++;
          }
          
          recentMedia.push({
            _id: media._id,
            url: media.url,
            media_type: media.media_type,
            createdAt: media.createdAt
          });
        });
      }
    });

    // Sort và lấy 6 media gần nhất
    recentMedia.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    recentMedia = recentMedia.slice(0, 6);

    res.status(200).json({
      success: true,
      data: {
        totalImages,
        totalVideos,
        totalMedia: totalImages + totalVideos,
        recentMedia
      }
    });

  } catch (error) {
    console.error("Error in getUserMediaStats:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
};

module.exports = {
  getUserImages,
  getUserVideos,
  getUserAllMedia,
  getUserMediaStats
};
