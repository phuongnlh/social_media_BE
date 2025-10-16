const postModel = require("../../models/post.model");
const postMediaModel = require("../../models/postMedia.model");
const UserReport = require("../../models/userReport.model");

const getPostStats = async (req, res) => {
  try {
    const totalPosts = await postModel.countDocuments();
    const postsToday = await postModel.countDocuments({
      is_deleted: false,
      createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    });
    const reportedPosts = await UserReport.distinct("reportedPost");
    const deletedPosts = await postModel.countDocuments({ is_deleted: true });

    res.status(200).json({
      success: true,
      message: "Post statistics retrieved successfully",
      data: {
        totalPosts: totalPosts,
        postsToday: postsToday,
        reportedPosts: reportedPosts.length,
        deletedPosts: deletedPosts,
      },
    });
  } catch (error) {
    console.error("Error in getPostStats:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get post statistics",
      error: error.message,
    });
  }
};

const getAllPosts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = "",
      status = "",
      type = "",
      hasMedia = "",
      sortBy = "createdAt",
      sortOrder = "desc",
      dateFrom = "",
      dateTo = "",
    } = req.query;

    const skip = (page - 1) * limit;

    // Build match conditions
    const matchConditions = {};

    // Search functionality
    if (search) {
      matchConditions.$or = [
        { content: { $regex: search, $options: "i" } },
        { "user_id.fullName": { $regex: search, $options: "i" } },
        { "user_id.username": { $regex: search, $options: "i" } },
      ];
    }

    // Status filter
    if (status) {
      switch (status) {
        case "published":
          matchConditions.is_deleted = false;
          break;
        case "deleted":
          matchConditions.is_deleted = true;
          break;
        case "reported":
          // Will handle this after getting reported post IDs
          break;
      }
    }

    // Type filter
    if (type) {
      matchConditions.type = type;
    }

    // Date range filter
    if (dateFrom || dateTo) {
      matchConditions.createdAt = {};
      if (dateFrom) {
        matchConditions.createdAt.$gte = new Date(dateFrom);
      }
      if (dateTo) {
        matchConditions.createdAt.$lte = new Date(dateTo);
      }
    }

    // Get reported post IDs if filtering by reported status
    let reportedPostIds = [];
    if (status === "reported") {
      reportedPostIds = await UserReport.distinct("reportedPost");
      matchConditions._id = { $in: reportedPostIds };
    }

    // Build sort object
    const sortObj = {};
    if (sortBy) {
      sortObj[sortBy] = sortOrder === "asc" ? 1 : -1;
    }
    console.log("Sort Object:", sortObj);

    // Get posts with aggregation
    const aggregationPipeline = [
      // Lookup user information first
      {
        $lookup: {
          from: "users",
          localField: "user_id",
          foreignField: "_id",
          as: "user_id",
        },
      },
      {
        $unwind: "$user_id",
      },

      // Apply match conditions
      {
        $match: matchConditions,
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

      // Lookup post views
      {
        $lookup: {
          from: "postviews",
          localField: "_id",
          foreignField: "post_id",
          as: "views",
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
          viewCount: { $size: "$views" },
          engagementScore: {
            $add: [
              { $size: "$reactions" },
              { $multiply: [{ $size: "$comments" }, 2] },
              {
                $multiply: [{ $ifNull: [{ $arrayElemAt: ["$shares_count.count", 0] }, 0] }, 3],
              },
            ],
          },
        },
      },

      // Project only needed fields
      {
        $project: {
          _id: 1,
          content: 1,
          type: 1,
          user_id: {
            _id: 1,
            fullName: 1,
            username: 1,
            avatar_url: 1,
          },
          reactionCount: 1,
          commentCount: 1,
          sharesCount: 1,
          viewCount: 1,
          is_deleted: 1,
          createdAt: 1,
          updatedAt: 1,
          engagementScore: 1,
        },
      },

      // Sort
      {
        $sort: Object.keys(sortObj).length > 0 ? sortObj : { createdAt: -1 },
      },

      // Facet for pagination and total count
      {
        $facet: {
          posts: [{ $skip: parseInt(skip) }, { $limit: parseInt(limit) }],
          totalCount: [{ $count: "count" }],
        },
      },
    ];

    // Handle media filter in aggregation if needed
    if (hasMedia !== "") {
      const mediaCondition = hasMedia === "true" ? { $ne: [] } : { $eq: [] };

      // Add media lookup before the match stage
      aggregationPipeline.splice(-3, 0, {
        $lookup: {
          from: "postmedias",
          localField: "_id",
          foreignField: "post_id",
          as: "mediaCheck",
        },
      });

      // Add media filter to match conditions
      aggregationPipeline.splice(-2, 0, {
        $match: {
          mediaCheck: mediaCondition,
        },
      });
    }

    const posts = await postModel.aggregate(aggregationPipeline);

    const paginatedPosts = posts[0].posts || [];
    const totalCount = posts[0].totalCount[0]?.count || 0;

    // Get post IDs for additional data lookup
    const postIds = paginatedPosts.map((p) => p._id);

    // Get media for all posts
    const postMedias = await postMediaModel
      .find({
        post_id: { $in: postIds },
      })
      .populate("media_id")
      .lean();

    // Map media by post_id
    const mediaMap = new Map();
    postMedias.forEach((pm) => {
      const media = (pm.media_id || []).map((m) => ({
        url: m.url,
        thumbnail: m.thumbnail_url || m.url,
        type: m.media_type,
        duration: m.duration || null,
      }));
      mediaMap.set(pm.post_id.toString(), media);
    });

    // Count reported posts
    const reportedPostCounts = await UserReport.aggregate([
      {
        $match: {
          reportedPost: { $in: postIds },
        },
      },
      {
        $group: {
          _id: "$reportedPost",
          count: { $sum: 1 },
        },
      },
    ]);

    const reportedMap = new Map();
    reportedPostCounts.forEach((r) => {
      reportedMap.set(r._id.toString(), r.count);
    });

    // Attach media and report count to posts
    const postsWithAllData = paginatedPosts.map((post) => {
      const media = mediaMap.get(post._id.toString()) || [];
      const reportCount = reportedMap.get(post._id.toString()) || 0;

      return {
        ...post,
        media,
        reportCount,
      };
    });

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / parseInt(limit));
    const currentPage = parseInt(page);

    res.status(200).json({
      success: true,
      message: "Posts retrieved successfully",
      data: {
        posts: postsWithAllData,
        pagination: {
          currentPage,
          totalPages,
          limit: parseInt(limit),
          totalCount,
          hasNextPage: currentPage < totalPages,
          hasPrevPage: currentPage > 1,
        },
      },
    });
  } catch (error) {
    console.error("Error in getAllPosts:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get posts",
      error: error.message,
    });
  }
};

// Add bulk action handler
const bulkPostAction = async (req, res) => {
  try {
    const { postIds, action } = req.body;

    if (!postIds || !Array.isArray(postIds) || postIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Post IDs are required",
      });
    }

    if (!["delete", "restore", "hide"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action",
      });
    }

    let updateQuery = {};

    switch (action) {
      case "delete":
        updateQuery = { is_deleted: true };
        break;
      case "restore":
        updateQuery = { is_deleted: false };
        break;
      case "hide":
        updateQuery = { is_hidden: true };
        break;
    }

    const result = await postModel.updateMany({ _id: { $in: postIds } }, updateQuery);

    res.status(200).json({
      success: true,
      message: `Posts ${action}d successfully`,
      data: {
        modifiedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    console.error("Error in bulkPostAction:", error);
    res.status(500).json({
      success: false,
      message: "Failed to perform bulk action",
      error: error.message,
    });
  }
};

// Add single post action handler
const postAction = async (req, res) => {
  try {
    const { postId } = req.params;
    const { action } = req.params;

    if (!["delete", "restore"].includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action",
      });
    }

    let updateQuery = {};

    switch (action) {
      case "delete":
        updateQuery = { is_deleted: true };
        break;
      case "restore":
        updateQuery = { is_deleted: false };
        break;
    }

    const result = await postModel.findByIdAndUpdate(postId, updateQuery, { new: true });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    res.status(200).json({
      success: true,
      message: `Post ${action}d successfully`,
      data: result,
    });
  } catch (error) {
    console.error("Error in postAction:", error);
    res.status(500).json({
      success: false,
      message: `Failed to ${action} post`,
      error: error.message,
    });
  }
};

module.exports = {
  getAllPosts,
  getPostStats,
  bulkPostAction,
  postAction,
};
