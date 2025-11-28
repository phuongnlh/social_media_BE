const postModel = require("../../models/post.model");
const postMediaModel = require("../../models/postMedia.model");
const UserReport = require("../../models/userReport.model");
const { Types } = require("mongoose");

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
      severity = "",
      is_deleted = "" 
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
    if (is_deleted !== "" && is_deleted !== undefined && is_deleted !== null) {
      matchConditions.is_deleted = is_deleted === "true";
    }

    // Legacy status filter
    if (status) {
      switch (status) {
        case "published":
          matchConditions.is_deleted = false;
          break;
        case "deleted":
          matchConditions.is_deleted = true;
          break;
        case "reported":
          break;
      }
    }

    // Type filter
    if (type) {
      matchConditions.type = type;
    }

    // Severity filter
    if (severity && severity !== "" && severity !== "none") {
      matchConditions.severity = severity;
    } else if (severity === "none") {
      matchConditions.$or = [
        { severity: { $exists: false } },
        { severity: null },
        { severity: "" },
        { severity: "none" }
      ];
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

      // Lookup ads information
      {
        $lookup: {
          from: "ads",
          let: { postId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$post_id", "$$postId"] },
                status: { $in: ["active", "completed", "pending_review"] },
              },
            },
            {
              $project: {
                campaign_name: 1,
                status: 1,
                target_views: 1,
                current_views: 1,
                started_at: 1,
                completed_at: 1,
              },
            },
          ],
          as: "ads",
        },
      },

      // Lookup reports for this post
      {
        $lookup: {
          from: "userreports",
          let: { postId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$reportedPost", "$$postId"] },
              },
            },
            {
              $lookup: {
                from: "users",
                localField: "reportedBy",
                foreignField: "_id",
                as: "reporter",
              },
            },
            {
              $unwind: {
                path: "$reporter",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $project: {
                _id: 1,
                reportType: 1,
                reason: 1,
                status: 1,
                actionTaken: 1,
                createdAt: 1,
                reporter: {
                  _id: 1,
                  fullName: 1,
                  username: 1,
                  avatar_url: 1,
                },
              },
            },
            {
              $sort: { createdAt: -1 },
            },
          ],
          as: "reports",
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
          hasAds: { $gt: [{ $size: "$ads" }, 0] },
          reportCount: { $size: "$reports" },
          pendingReportCount: {
            $size: {
              $filter: {
                input: "$reports",
                as: "report",
                cond: { $eq: ["$$report.status", "pending"] },
              },
            },
          },
        },
      },

      // Media filter
      ...(hasMedia !== "" && hasMedia !== undefined && hasMedia !== null
        ? [
          {
            $lookup: {
              from: "postmedias",
              localField: "_id",
              foreignField: "post_id",
              as: "mediaCheck",
            },
          },
          {
            $match: {
              $expr:
                hasMedia === "true"
                  ? { $gt: [{ $size: { $ifNull: ["$mediaCheck", []] } }, 0] }
                  : { $eq: [{ $size: { $ifNull: ["$mediaCheck", []] } }, 0] },
            },
          },
        ]
        : []),

      // Project only needed fields
      {
        $project: {
          _id: 1,
          content: 1,
          type: 1,
          severity: 1,
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
          hasAds: 1,
          ads: 1,
          reportCount: 1,
          pendingReportCount: 1,
          reports: 1,
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

    // Attach media to posts
    const postsWithAllData = paginatedPosts.map((post) => {
      const media = mediaMap.get(post._id.toString()) || [];

      // Group reports by type for summary
      const reportTypeCount = {};
      post.reports.forEach((report) => {
        reportTypeCount[report.reportType] =
          (reportTypeCount[report.reportType] || 0) + 1;
      });

      return {
        ...post,
        media,
        reportTypeCount,
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

    const result = await postModel.findByIdAndUpdate(postId, updateQuery, {
      new: true,
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    // Nếu action là delete, resolve tất cả reports pending và investigating
    if (action === "delete") {
      await UserReport.updateMany(
        {
          reportedPost: postId,
          status: { $in: ["pending", "investigating"] }
        },
        {
          $set: {
            status: "resolved",
            actionTaken: "content_removed",
            resolvedAt: new Date()
          }
        }
      );
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

const updatePostDeleteStatus = async (req, res) => {
  try {
    const { postId } = req.params;
    const { is_deleted, reason, adminNote } = req.body;

    // Validate is_deleted value
    if (typeof is_deleted !== "boolean") {
      return res.status(400).json({
        success: false,
        message: "is_deleted must be a boolean value (true or false)",
      });
    }

    // Check if post exists
    const post = await postModel.findById(postId).populate("user_id", "fullName username avatar_url email");
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    // Update post delete status
    const updateData = {
      is_deleted,
      ...(is_deleted && { deleted_at: new Date() }),
      ...(!is_deleted && { deleted_at: null }),
    };

    const updatedPost = await postModel.findByIdAndUpdate(
      postId,
      updateData,
      { new: true }
    ).populate("user_id", "fullName username avatar_url email");

    if (is_deleted) {
      await UserReport.updateMany(
        {
          reportedPost: postId,
          status: { $in: ["pending", "investigating"] }
        },
        {
          $set: {
            status: "resolved",
            actionTaken: "content_removed",
            resolvedAt: new Date()
          }
        }
      );
    }

    // Gửi thông báo cho user
    try {
      const { getSocketIO, getNotificationUserSocketMap } = require("../../socket/io-instance");
      const notificationService = require("../../services/notification.service");

      const io = getSocketIO();
      const notificationsNamespace = io.of("/notifications");
      const notificationUserSocketMap = getNotificationUserSocketMap();

      // Truncate content to max 100 characters
      const maxContentLength = 30;
      let postContentPreview = post.content || "[No content]";
      if (postContentPreview.length > maxContentLength) {
        postContentPreview = postContentPreview.substring(0, maxContentLength) + "...";
      }

      let notificationMessage = "";

      if (is_deleted) {
        // Thông báo khi post bị xóa
        if (reason || adminNote) {
          // Có lý do cụ thể
          notificationMessage =
            `🚨 POST DELETED BY ADMIN\n` +
            `Your post has been removed by administrator.\n\n` +
            `Post content: "${postContentPreview}"\n\n` +
            (reason ? `Reason: ${reason}\n` : '') +
            (adminNote ? `Admin Note: ${adminNote}\n` : '') +
            `\nPlease review our community guidelines to avoid future violations.`;
        } else {
          // Thông báo mặc định
          notificationMessage =
            `🚨 POST DELETED BY ADMIN\n` +
            `Your post has been removed for violating our community guidelines and policies.\n\n` +
            `Post content: "${postContentPreview}"\n\n` +
            `Common violations include:\n` +
            `• Inappropriate or offensive content\n` +
            `• Spam or misleading information\n` +
            `• Harassment or hate speech\n` +
            `• Copyright infringement\n\n` +
            `Please review our community guidelines to ensure future posts comply with our policies.\n` +
            `Repeated violations may result in account restrictions.`;
        }
      } else {
        // Thông báo khi post được khôi phục
        if (reason || adminNote) {
          // Có lý do cụ thể
          notificationMessage =
            `✅ POST RESTORED\n` +
            `Your post has been restored by administrator.\n\n` +
            `Post content: "${postContentPreview}"\n\n` +
            (reason ? `Reason: ${reason}\n` : '') +
            (adminNote ? `Note: ${adminNote}\n` : '') +
            `\nYour post is now visible again.`;
        } else {
          // Thông báo mặc định
          notificationMessage =
            `✅ POST RESTORED\n` +
            `Good news! Your post has been reviewed and restored by our administrator.\n\n` +
            `Post content: "${postContentPreview}"\n\n` +
            `Your content is now visible to your audience again.\n` +
            `Thank you for your patience during the review process.`;
        }
      }

      await notificationService.createNotificationWithNamespace(
        notificationsNamespace,
        post.user_id._id,
        "system",
        notificationMessage,
        notificationUserSocketMap,
        {
          relatedId: postId,
          type: "admin_post"
        }
      );
    } catch (notifyErr) {
      console.error("Failed to send notification:", notifyErr);
    }

    res.status(200).json({
      success: true,
      message: `Post ${is_deleted ? "deleted" : "restored"} successfully`,
      data: updatedPost,
    });
  } catch (error) {
    console.error("Error in updatePostDeleteStatus:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update post delete status",
      error: error.message,
    });
  }
};

const getAllPostReportsByStatus = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = 'reportCount',
      order = 'desc',
      type = 'pending',
      search = ''
    } = req.query;
    const skip = (page - 1) * limit;

    // Validate type parameter
    if (!['pending', 'investigating'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid type parameter. Must be 'pending' or 'investigating'"
      });
    }

    // Map frontend field names to backend aggregation field names
    const fieldMapping = {
      'reportCount': 'reportCount',
      'severity': 'post.severity',
      'reactionCount': 'post.reactionCount'
    };

    const actualSortField = fieldMapping[sortBy] || sortBy;

    // Build sort options
    const sortOptions = {};
    sortOptions[actualSortField] = order === 'desc' ? -1 : 1;

    // Search filter
    const searchFilter = search && search.trim() !== ''
      ? {
        $or: [
          { "postInfo.content": { $regex: search.trim(), $options: 'i' } },
          { "postInfo.user_id.fullName": { $regex: search.trim(), $options: 'i' } }
        ]
      }
      : {};

    // Aggregate pipeline
    const groupedReports = await UserReport.aggregate([
      // Match reports theo type (pending hoặc investigating)
      {
        $match: {
          status: type,
          reportedPost: { $exists: true, $ne: null }
        }
      },

      // Lookup post info
      {
        $lookup: {
          from: "posts",
          localField: "reportedPost",
          foreignField: "_id",
          as: "postInfo",
          pipeline: [
            {
              $lookup: {
                from: "users",
                localField: "user_id",
                foreignField: "_id",
                as: "user_id"
              }
            },
            {
              $unwind: { path: "$user_id", preserveNullAndEmptyArrays: true }
            },
            {
              $project: {
                _id: 1,
                content: 1,
                type: 1,
                severity: 1,
                is_deleted: 1,
                user_id: {
                  _id: 1,
                  fullName: 1,
                  avatar_url: 1,
                  email: 1,
                  username: 1
                },
                createdAt: 1
              }
            }
          ]
        }
      },
      { $unwind: { path: "$postInfo", preserveNullAndEmptyArrays: true } },

      // Lookup ads để check xem post có đang chạy quảng cáo không
      {
        $lookup: {
          from: "ads",
          let: { postId: "$reportedPost" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$post_id", "$$postId"] },
                status: { $in: ["active", "paused"] }
              }
            }
          ],
          as: "activeAds"
        }
      },

      // Loại bỏ những post đang có quảng cáo active
      {
        $match: {
          activeAds: { $size: 0 }
        }
      },

      // Lookup reporter info
      {
        $lookup: {
          from: "users",
          localField: "reportedBy",
          foreignField: "_id",
          as: "reporter",
          pipeline: [
            {
              $project: {
                _id: 1,
                fullName: 1,
                avatar_url: 1,
                email: 1
              }
            }
          ]
        }
      },
      { $unwind: { path: "$reporter", preserveNullAndEmptyArrays: true } },

      // Apply search filter
      ...(Object.keys(searchFilter).length > 0 ? [{ $match: searchFilter }] : []),

      // Group by post
      {
        $group: {
          _id: "$reportedPost",
          post: { $first: "$postInfo" },
          reports: {
            $push: {
              _id: "$_id",
              reportType: "$reportType",
              reason: "$reason",
              description: "$description",
              status: "$status",
              actionTaken: "$actionTaken",
              createdAt: "$createdAt",
              reporter: "$reporter"
            }
          },
          reportCount: { $sum: 1 },
          reportTypes: { $addToSet: "$reportType" }
        }
      },

      // Count report types
      {
        $addFields: {
          reportTypeCount: {
            $arrayToObject: {
              $map: {
                input: "$reportTypes",
                as: "type",
                in: {
                  k: "$$type",
                  v: {
                    $size: {
                      $filter: {
                        input: "$reports",
                        as: "report",
                        cond: { $eq: ["$$report.reportType", "$$type"] }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },

      // Sort
      { $sort: sortOptions },
      { $skip: skip },
      { $limit: parseInt(limit) }
    ]);

    // Get post IDs to fetch media
    const postIds = groupedReports.map(item => item._id);

    // Fetch media for all posts
    const postMedias = await postMediaModel
      .find({
        post_id: { $in: postIds }
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

    // Transform data with media
    const postReports = groupedReports.map(item => ({
      postId: item._id,
      post: {
        ...item.post,
        media: mediaMap.get(item._id.toString()) || []
      },
      reportCount: item.reportCount,
      reportTypes: item.reportTypes,
      reportTypeCount: item.reportTypeCount,
      reports: item.reports
    }));

    // Count total for pagination
    const totalCountPipeline = await UserReport.aggregate([
      {
        $match: {
          status: type,
          reportedPost: { $exists: true, $ne: null }
        }
      },
      {
        $lookup: {
          from: "posts",
          localField: "reportedPost",
          foreignField: "_id",
          as: "postInfo"
        }
      },
      { $unwind: { path: "$postInfo", preserveNullAndEmptyArrays: true } },
      ...(Object.keys(searchFilter).length > 0 ? [{ $match: searchFilter }] : []),
      {
        $group: {
          _id: "$reportedPost"
        }
      },
      {
        $count: "total"
      }
    ]);

    const totalReportedPosts = totalCountPipeline[0]?.total || 0;

    // Statistics
    const totalPendingPosts = await UserReport.aggregate([
      {
        $match: {
          status: "pending",
          reportedPost: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: "$reportedPost"
        }
      },
      {
        $count: "total"
      }
    ]);

    const totalInvestigatingPosts = await UserReport.aggregate([
      {
        $match: {
          status: "investigating",
          reportedPost: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: "$reportedPost"
        }
      },
      {
        $count: "total"
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        postReports,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalReportedPosts / limit),
          totalReportedPosts,
          totalPendingPosts: totalPendingPosts[0]?.total || 0,
          totalInvestigatingPosts: totalInvestigatingPosts[0]?.total || 0,
          limit: parseInt(limit)
        },
        statistics: {
          totalPendingReports: await UserReport.countDocuments({
            status: "pending",
            reportedPost: { $exists: true, $ne: null }
          }),
          totalReportedPosts
        }
      }
    });

  } catch (error) {
    console.error("Error in getAllPostReportsByStatus:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching post reports",
      error: error.message
    });
  }
};

const dismissAllPendingReportsOfPost = async (req, res) => {
  try {
    const { postId } = req.params;

    if (!Types.ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID"
      });
    }

    const post = await postModel.findById(postId);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found"
      });
    }

    // Update all pending reports
    const result = await UserReport.updateMany(
      {
        reportedPost: postId,
        status: { $in: ["pending", "investigating"] }
      },
      {
        $set: {
          status: "dismissed",
          resolvedAt: new Date()
        }
      }
    );

    res.status(200).json({
      success: true,
      message: `Dismissed ${result.modifiedCount} reports`,
      data: {
        dismissedCount: result.modifiedCount
      }
    });

  } catch (error) {
    console.error("Error in dismissAllPendingReportsOfPost:", error);
    res.status(500).json({
      success: false,
      message: "Error dismissing reports",
      error: error.message
    });
  }
};

const markPostAsInvestigating = async (req, res) => {
  try {
    const { postId } = req.params;

    if (!Types.ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post ID"
      });
    }

    // Update all pending reports to investigating
    const result = await UserReport.updateMany(
      {
        reportedPost: postId,
        status: "pending"
      },
      {
        $set: { status: "investigating" }
      }
    );

    res.status(200).json({
      success: true,
      message: `Marked ${result.modifiedCount} reports as investigating`,
      data: {
        updatedCount: result.modifiedCount
      }
    });

  } catch (error) {
    console.error("Error in markPostAsInvestigating:", error);
    res.status(500).json({
      success: false,
      message: "Error marking post as investigating",
      error: error.message
    });
  }
};

const getPostStatistics = async (req, res) => {
  try {
    // Tổng số posts trong hệ thống
    const totalPosts = await postModel.countDocuments();

    // Đếm posts có reports đang pending (chưa investigating)
    const totalPostsWithPendingReports = await UserReport.aggregate([
      {
        $match: {
          status: "pending",
          reportedPost: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: "$reportedPost"
        }
      },
      // Lookup ads để check xem post có đang chạy quảng cáo không
      {
        $lookup: {
          from: "ads",
          let: { postId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$post_id", "$$postId"] },
                status: { $in: ["active", "paused", "pending_review"] }
              }
            }
          ],
          as: "activeAds"
        }
      },
      // Loại bỏ những post đang có quảng cáo active
      {
        $match: {
          activeAds: { $size: 0 }
        }
      },
      {
        $count: "total"
      }
    ]);

    // Đếm posts có reports đang investigating
    const totalPostsInvestigating = await UserReport.aggregate([
      {
        $match: {
          status: "investigating",
          reportedPost: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: "$reportedPost"
        }
      },
      // Lookup ads để check xem post có đang chạy quảng cáo không
      {
        $lookup: {
          from: "ads",
          let: { postId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$post_id", "$$postId"] },
                status: { $in: ["active", "paused", "pending_review"] }
              }
            }
          ],
          as: "activeAds"
        }
      },
      {
        $match: {
          activeAds: { $size: 0 }
        }
      },
      {
        $count: "total"
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalPosts,
        totalPostsWithPendingReports: totalPostsWithPendingReports[0]?.total || 0,
        totalPostsInvestigating: totalPostsInvestigating[0]?.total || 0
      }
    });

  } catch (error) {
    console.error("Error in getPostStatistics:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching post statistics",
      error: error.message
    });
  }
};

const getAllResolvedPostReports = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = 'reportCount',
      order = 'desc',
      status
    } = req.query;
    const skip = (page - 1) * limit;

    // Build sort options
    const sortOptions = {};
    sortOptions[sortBy] = order === 'desc' ? -1 : 1;

    // Filter cho resolved reports (dismissed hoặc resolved)
    const reportStatusFilter = { $in: ["dismissed", "resolved"] };

    // Nếu có status cụ thể thì filter theo đó
    if (status && ['dismissed', 'resolved'].includes(status)) {
      reportStatusFilter.$in = [status];
    }

    // Aggregate pipeline
    const groupedReports = await UserReport.aggregate([
      // Chỉ lấy reports đã xử lý (dismissed/resolved)
      {
        $match: {
          status: reportStatusFilter,
          reportedPost: { $exists: true, $ne: null }
        }
      },

      // Lookup post info
      {
        $lookup: {
          from: "posts",
          localField: "reportedPost",
          foreignField: "_id",
          as: "postInfo",
          pipeline: [
            {
              $lookup: {
                from: "users",
                localField: "user_id",
                foreignField: "_id",
                as: "user_id"
              }
            },
            {
              $unwind: { path: "$user_id", preserveNullAndEmptyArrays: true }
            },
            {
              $project: {
                _id: 1,
                content: 1,
                type: 1,
                severity: 1,
                is_deleted: 1,
                user_id: {
                  _id: 1,
                  fullName: 1,
                  avatar_url: 1,
                  email: 1,
                  username: 1
                },
                createdAt: 1
              }
            }
          ]
        }
      },
      { $unwind: { path: "$postInfo", preserveNullAndEmptyArrays: true } },

      {
        $lookup: {
          from: "ads",
          let: { postId: "$reportedPost" },
          pipeline: [
            {
              $match: {
                $expr: { $eq: ["$post_id", "$$postId"] },
                status: { $in: ["active", "paused"] }
              }
            }
          ],
          as: "activeAds"
        }
      },

      // Loại bỏ những post đang có quảng cáo active
      {
        $match: {
          activeAds: { $size: 0 }
        }
      },

      // Lookup reporter info
      {
        $lookup: {
          from: "users",
          localField: "reportedBy",
          foreignField: "_id",
          as: "reporterInfo",
          pipeline: [
            {
              $project: {
                _id: 1,
                fullName: 1,
                avatar_url: 1,
                email: 1
              }
            }
          ]
        }
      },
      { $unwind: { path: "$reporterInfo", preserveNullAndEmptyArrays: true } },

      // Group by reportedPost
      {
        $group: {
          _id: "$reportedPost",
          postInfo: { $first: "$postInfo" },
          reportCount: { $sum: 1 },
          reports: {
            $push: {
              _id: "$_id",
              reportType: "$reportType",
              reason: "$reason",
              status: "$status",
              actionTaken: "$actionTaken",
              reporter: "$reporterInfo",
              createdAt: "$createdAt",
              resolvedAt: "$resolvedAt"
            }
          },
          latestReportDate: { $max: "$createdAt" },
          oldestReportDate: { $min: "$createdAt" },
          resolvedDate: { $max: "$resolvedAt" },
          reportTypes: { $addToSet: "$reportType" },
          reportTypeBreakdown: {
            $push: "$reportType"
          },
          // Đếm số lượng theo action taken
          actionBreakdown: {
            $push: "$actionTaken"
          },
          // Đếm số lượng theo status
          statusBreakdown: {
            $push: "$status"
          }
        }
      },

      // Tính số lượng từng loại report
      {
        $addFields: {
          reportTypeCount: {
            $arrayToObject: {
              $map: {
                input: { $setUnion: "$reportTypes" },
                as: "type",
                in: {
                  k: "$$type",
                  v: {
                    $size: {
                      $filter: {
                        input: "$reportTypeBreakdown",
                        as: "item",
                        cond: { $eq: ["$$item", "$$type"] }
                      }
                    }
                  }
                }
              }
            }
          },
          dismissedCount: {
            $size: {
              $filter: {
                input: "$statusBreakdown",
                as: "s",
                cond: { $eq: ["$$s", "dismissed"] }
              }
            }
          },
          resolvedCount: {
            $size: {
              $filter: {
                input: "$statusBreakdown",
                as: "s",
                cond: { $eq: ["$$s", "resolved"] }
              }
            }
          },
          contentRemovedCount: {
            $size: {
              $filter: {
                input: "$actionBreakdown",
                as: "a",
                cond: { $eq: ["$$a", "content_removed"] }
              }
            }
          }
        }
      },

      // Project final fields
      {
        $project: {
          _id: 0,
          postId: "$_id",
          post: "$postInfo",
          reportCount: 1,
          reports: 1,
          latestReportDate: 1,
          oldestReportDate: 1,
          resolvedDate: 1,
          reportTypes: 1,
          reportTypeCount: 1,
          dismissedCount: 1,
          resolvedCount: 1,
          contentRemovedCount: 1
        }
      },

      { $sort: sortOptions },

      // Pagination với metadata
      {
        $facet: {
          metadata: [
            { $count: "total" },
            {
              $addFields: {
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: { $ceil: { $divide: ["$total", parseInt(limit)] } }
              }
            }
          ],
          data: [
            { $skip: skip },
            { $limit: parseInt(limit) }
          ]
        }
      }
    ]);

    const result = groupedReports[0];
    const metadata = result.metadata[0] || { total: 0, page: 1, limit: 10, totalPages: 0 };
    const data = result.data;

    // Get post IDs to fetch media
    const postIds = data.map(item => item.postId);

    // Fetch media for all posts
    const postMedias = await postMediaModel
      .find({
        post_id: { $in: postIds }
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

    // Transform data with media
    const postReports = data.map(item => ({
      ...item,
      post: {
        ...item.post,
        media: mediaMap.get(item.postId.toString()) || []
      }
    }));

    // Tính tổng số reports đã xử lý
    const totalReportsCount = await UserReport.countDocuments({
      status: reportStatusFilter,
      reportedPost: { $exists: true, $ne: null }
    });

    // Tính số lượng dismissed và resolved
    const dismissedCount = await UserReport.countDocuments({
      status: "dismissed",
      reportedPost: { $exists: true, $ne: null }
    });
    const resolvedCount = await UserReport.countDocuments({
      status: "resolved",
      reportedPost: { $exists: true, $ne: null }
    });

    res.status(200).json({
      success: true,
      data: {
        postReports,
        pagination: {
          currentPage: metadata.page,
          totalPages: metadata.totalPages,
          totalPosts: metadata.total,
          limit: metadata.limit
        },
        statistics: {
          totalResolvedReports: totalReportsCount,
          totalDismissedReports: dismissedCount,
          totalResolvedWithAction: resolvedCount,
          totalPosts: metadata.total
        }
      }
    });

  } catch (error) {
    console.error("Error in getAllResolvedPostReports:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching resolved post reports",
      error: error.message
    });
  }
};


module.exports = {
  getAllPosts,
  getPostStats,
  postAction,
  markPostAsInvestigating,
  updatePostDeleteStatus,
  getAllPostReportsByStatus,
  dismissAllPendingReportsOfPost,
  getPostStatistics,
  getAllResolvedPostReports
};