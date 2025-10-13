const User = require("../../models/user.model");
const Post = require("../../models/post.model");
const { signToken } = require("../../utils/jwt_utils");

const getAllUsers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      search = "",
      sortBy = "createdAt",
      sortOrder = "desc",
      status = "all", // all, active, inactive, blocked, deleted
      verified = "all", // all, verified, unverified
      twoFA = "all", // all, enabled, disabled
    } = req.query;

    // Validate and sanitize inputs
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit))); // Max 100 per page
    const skip = (pageNum - 1) * limitNum;

    // Build filter query
    const filter = {};

    // Search filter (email, fullName, username)
    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: "i" } },
        { fullName: { $regex: search, $options: "i" } },
        { username: { $regex: search, $options: "i" } },
      ];
    }

    // Status filter
    switch (status) {
      case "active":
        filter.isActive = true;
        filter.isBlocked = false;
        filter.is_deleted = false;
        break;
      case "inactive":
        filter.isActive = false;
        break;
      case "blocked":
        filter.isBlocked = true;
        break;
      case "deleted":
        filter.is_deleted = true;
        break;
      default:
        // For 'all', don't add status filters
        break;
    }

    // Email verification filter
    switch (verified) {
      case "verified":
        filter.EmailVerified = true;
        break;
      case "unverified":
        filter.EmailVerified = false;
        break;
      default:
        // For 'all', don't add verification filter
        break;
    }

    // Two-Factor Authentication filter
    switch (twoFA) {
      case "enabled":
        filter.twoFAEnabled = true;
        break;
      case "disabled":
        filter.twoFAEnabled = false;
        break;
      default:
        // For 'all', don't add 2FA filter
        break;
    }

    // Build sort object
    const validSortFields = ["createdAt", "updatedAt", "email", "fullName", "username", "isActive", "EmailVerified"];
    const sortField = validSortFields.includes(sortBy) ? sortBy : "createdAt";
    const sortDirection = sortOrder === "asc" ? 1 : -1;
    const sort = { [sortField]: sortDirection };

    // Execute queries in parallel
    const [users, totalCount] = await Promise.all([
      User.aggregate([
        // Match the filter criteria
        { $match: filter },

        // Lookup posts count for each user
        {
          $lookup: {
            from: "posts",
            localField: "_id",
            foreignField: "user_id",
            as: "posts",
          },
        },

        // Add posts count field + status field
        {
          $addFields: {
            postsCount: {
              $size: {
                $filter: {
                  input: "$posts",
                  cond: { $ne: ["$$this.is_deleted", true] },
                },
              },
            },
            status: {
              $switch: {
                branches: [
                  {
                    case: { $eq: ["$is_deleted", true] },
                    then: "deleted",
                  },
                  {
                    case: { $eq: ["$isBlocked", true] },
                    then: "blocked",
                  },
                  {
                    case: { $eq: ["$isActive", true] },
                    then: "active",
                  },
                  {
                    case: { $eq: ["$isActive", false] },
                    then: "inactive",
                  },
                ],
                default: "unknown",
              },
            },
          },
        },

        // Remove sensitive fields and posts array
        {
          $project: {
            hash: 0,
            salt: 0,
            twoFASecret: 0,
            posts: 0,
          },
        },

        // Sort, Skip, Limit
        { $sort: sort },
        { $skip: skip },
        { $limit: limitNum },
      ]),
      User.countDocuments(filter),
    ]);

    // Calculate pagination info
    const totalPages = Math.ceil(totalCount / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    // Get statistics
    const stats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          blockedUsers: {
            $sum: { $cond: [{ $eq: ["$isBlocked", true] }, 1, 0] },
          },
          verifiedUsers: {
            $sum: { $cond: [{ $eq: ["$EmailVerified", true] }, 1, 0] },
          },
        },
      },
    ]);

    const now = new Date(); // thời gian hiện tại

    // Lấy năm và tháng hiện tại
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-11

    // Tạo ngày 1 của tháng hiện tại
    const firstDayOfMonth = new Date(year, month, 1);

    const newUsersThisPeriod = await User.countDocuments({
      createdAt: { $gte: firstDayOfMonth },
    });

    const userStats = stats[0] || {
      totalUsers: 0,
      blockedUsers: 0,
      verifiedUsers: 0,
    };

    // Format response
    res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      data: {
        users,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalCount,
          limit: limitNum,
          hasNextPage,
          hasPrevPage,
        },
        filters: {
          search,
          sortBy: sortField,
          sortOrder,
          status,
          verified,
          twoFA,
        },
        statistics: {
          ...userStats,
          newUsersThisPeriod,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching users",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get user by ID with detailed information
const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate userId format
    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format",
      });
    }

    const user = await User.findById(userId)
      .select("-hash -salt -twoFASecret") // Exclude sensitive fields
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Get additional user statistics
    const [friendsCount, postsCount] = await Promise.all([
      // Friends count
      require("../../models/friendship.model")
        .countDocuments({
          $or: [
            { userId: userId, status: "accepted" },
            { friendId: userId, status: "accepted" },
          ],
        })
        .catch(() => 0),

      // Posts count (excluding deleted posts)
      Post.countDocuments({
        user_id: userId,
        is_deleted: { $ne: true },
      }).catch(() => 0),
    ]);

    res.status(200).json({
      success: true,
      message: "User details fetched successfully",
      data: {
        user,
        statistics: {
          friendsCount,
          postsCount,
          joinedDate: user.createdAt,
          lastActiveDate: user.updatedAt,
        },
      },
    });
  } catch (error) {
    console.error("Error fetching user details:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching user details",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Update user status (block/unblock, activate/deactivate)
const updateUserStatus = async (req, res) => {
  try {
    const { userId } = req.params;
    const { action, reason } = req.body; // action: 'block', 'unblock', 'activate', 'deactivate', 'delete'

    // Validate inputs
    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format",
      });
    }

    const validActions = ["block", "unblock", "activate", "deactivate", "delete"];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        message: "Invalid action. Must be one of: " + validActions.join(", "),
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Apply the action
    let updateData = {};
    let actionMessage = "";

    switch (action) {
      case "block":
        updateData = { isBlocked: true, isActive: false };
        actionMessage = "User blocked successfully";
        break;
      case "unblock":
        updateData = { isBlocked: false, isActive: true };
        actionMessage = "User unblocked successfully";
        break;
      case "activate":
        updateData = { isActive: true, isBlocked: false };
        actionMessage = "User activated successfully";
        break;
      case "deactivate":
        updateData = { isActive: false };
        actionMessage = "User deactivated successfully";
        break;
      case "delete":
        updateData = { is_deleted: true, isActive: false };
        actionMessage = "User deleted successfully";
        break;
    }

    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      select: "-hash -salt -twoFASecret",
    });

    // Log admin action
    console.log(`Admin action: ${action} user ${userId}. Reason: ${reason || "No reason provided"}`);

    res.status(200).json({
      success: true,
      message: actionMessage,
      data: {
        user: updatedUser,
        action,
        reason: reason || null,
        timestamp: new Date(),
      },
    });
  } catch (error) {
    console.error("Error updating user status:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while updating user status",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get platform statistics
const getPlatformStatistics = async (req, res) => {
  try {
    const { period = "30d" } = req.query; // 7d, 30d, 90d, 1y

    // Calculate date range
    const now = new Date();
    let startDate;

    switch (period) {
      case "7d":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "1y":
        startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get comprehensive statistics
    const [userStats, newUsersThisPeriod, userGrowth] = await Promise.all([
      // Overall user statistics
      User.aggregate([
        {
          $group: {
            _id: null,
            totalUsers: { $sum: 1 },
            activeUsers: {
              $sum: {
                $cond: [
                  {
                    $and: [{ $eq: ["$isActive", true] }, { $eq: ["$isBlocked", false] }],
                  },
                  1,
                  0,
                ],
              },
            },
            blockedUsers: {
              $sum: { $cond: [{ $eq: ["$isBlocked", true] }, 1, 0] },
            },
            deletedUsers: {
              $sum: { $cond: [{ $eq: ["$is_deleted", true] }, 1, 0] },
            },
            verifiedUsers: {
              $sum: { $cond: [{ $eq: ["$EmailVerified", true] }, 1, 0] },
            },
            twoFAEnabled: {
              $sum: { $cond: [{ $eq: ["$twoFAEnabled", true] }, 1, 0] },
            },
            phoneVerified: {
              $sum: { $cond: [{ $eq: ["$PhoneVerified", true] }, 1, 0] },
            },
          },
        },
      ]),
      // New users in the selected period
      User.countDocuments({ createdAt: { $gte: startDate } }),
      // Daily user growth for the period
      User.aggregate([
        { $match: { createdAt: { $gte: startDate } } },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
              day: { $dayOfMonth: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
      ]),
    ]);

    // Get posts and interactions count (if models exist)
    let postsCount = 0;
    let commentsCount = 0;
    let likesCount = 0;

    try {
      // Count total posts (excluding deleted ones)
      postsCount = await Post.countDocuments({ is_deleted: { $ne: true } });

      // Try to get comments and likes if models exist
      try {
        const Comment = require("../models/comment.model");
        commentsCount = await Comment.countDocuments();
      } catch (err) {
        // Comment model might not exist
      }

      try {
        const Like = require("../models/like.model");
        likesCount = await Like.countDocuments();
      } catch (err) {
        // Like model might not exist
      }
    } catch (err) {
      // Post model might not exist, keep counts at 0
    }

    const stats = userStats[0] || {
      totalUsers: 0,
      activeUsers: 0,
      blockedUsers: 0,
      deletedUsers: 0,
      verifiedUsers: 0,
      twoFAEnabled: 0,
      phoneVerified: 0,
    };

    res.status(200).json({
      success: true,
      message: "Platform statistics fetched successfully",
      data: {
        period,
        users: {
          ...stats,
          newUsersThisPeriod,
          growthRate: stats.totalUsers > 0 ? ((newUsersThisPeriod / stats.totalUsers) * 100).toFixed(2) + "%" : "0%",
        },
        content: {
          totalPosts: postsCount,
          totalComments: commentsCount,
          totalLikes: likesCount,
        },
        userGrowth: userGrowth.map((item) => ({
          date: `${item._id.year}-${String(item._id.month).padStart(2, "0")}-${String(item._id.day).padStart(2, "0")}`,
          count: item.count,
        })),
        generatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("Error fetching platform statistics:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching statistics",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

// Get top users by posts count
const getTopPosters = async (req, res) => {
  try {
    const { limit = 10, period = "all" } = req.query;
    const limitNum = Math.min(50, Math.max(1, parseInt(limit))); // Max 50

    // Calculate date range if period is specified
    let dateFilter = {};
    if (period !== "all") {
      const now = new Date();
      let startDate;

      switch (period) {
        case "7d":
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "30d":
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case "90d":
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case "1y":
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          break;
      }

      if (startDate) {
        dateFilter.createdAt = { $gte: startDate };
      }
    }

    const topPosters = await Post.aggregate([
      // Filter posts
      {
        $match: {
          is_deleted: { $ne: true },
          ...dateFilter,
        },
      },

      // Group by user and count posts
      {
        $group: {
          _id: "$user_id",
          postsCount: { $sum: 1 },
          latestPostDate: { $max: "$createdAt" },
        },
      },

      // Lookup user details
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user",
          pipeline: [
            {
              $project: {
                username: 1,
                fullName: 1,
                email: 1,
                avatar_url: 1,
                isActive: 1,
                isBlocked: 1,
                createdAt: 1,
              },
            },
          ],
        },
      },

      // Unwind user array
      { $unwind: "$user" },

      // Sort by posts count
      { $sort: { postsCount: -1 } },

      // Limit results
      { $limit: limitNum },

      // Project final structure
      {
        $project: {
          user: 1,
          postsCount: 1,
          latestPostDate: 1,
          rank: { $add: [{ $indexOfArray: [[], null] }, 1] },
        },
      },
    ]);

    // Add rank manually since $indexOfArray doesn't work as expected
    const rankedPosters = topPosters.map((poster, index) => ({
      ...poster,
      rank: index + 1,
    }));

    res.status(200).json({
      success: true,
      message: "Top posters fetched successfully",
      data: {
        period,
        limit: limitNum,
        topPosters: rankedPosters,
        generatedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("Error fetching top posters:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching top posters",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = {
  getAllUsers,
  getUserById,
  updateUserStatus,
  getPlatformStatistics,
  getTopPosters,
};
