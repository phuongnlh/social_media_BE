const Group = require("../../models/Group/group.model");
const GroupMember = require("../../models/Group/group_member.model");
const GroupRequest = require("../../models/Group/group_request.model");
const GroupPost = require("../../models/Group/group_post.model");
const Comment = require("../../models/Comment_Reaction/comment.model");
const CommentReaction = require("../../models/Comment_Reaction/comment_reactions.model");
const PostReaction = require("../../models/Comment_Reaction/post_reaction.model");
const PostMedia = require("../../models/postMedia.model");
const GroupReport = require("../../models/Group/groupReport.model");
const notificationService = require("../../services/notification.service");
const { Types } = require("mongoose");
const { getSocketIO, getUserSocketMap } = require("../../socket/io-instance");

const getAllGroupsWithStats = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      sortBy = 'created_at',
      order = 'desc',
      search = ''
    } = req.query;

    const skip = (page - 1) * limit;

    // Build filter object
    const filter = {};
    if (status) {
      filter.status = status;
    }

    if (search && search.trim() !== '') {
      filter.name = { $regex: search.trim(), $options: 'i' };
    }

    // Map frontend field names to backend field names
    const fieldMapping = {
      'membersCount': 'memberCount',
      'postsCount': 'postCount',
      'reportCount': 'reportCount',
      'warningCount': 'warningCount',
      'severity': 'severity',
      'status': 'status',
      'created_at': 'created_at'
    };

    const actualSortField = fieldMapping[sortBy] || sortBy;
    const sortOptions = {};
    sortOptions[actualSortField] = order === 'desc' ? -1 : 1;

    // Aggregate pipeline
    const groups = await Group.aggregate([
      { $match: filter },

      // Lookup creator info
      {
        $lookup: {
          from: "users",
          localField: "creator",
          foreignField: "_id",
          as: "creator",
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
      { $unwind: { path: "$creator", preserveNullAndEmptyArrays: true } },

      // Count members
      {
        $lookup: {
          from: "groupmembers",
          localField: "_id",
          foreignField: "group",
          pipeline: [
            {
              $match: {
                status: "approved",
                is_removed: false
              }
            }
          ],
          as: "members"
        }
      },
      {
        $addFields: {
          memberCount: { $size: "$members" }
        }
      },

      // Count posts
      {
        $lookup: {
          from: "groupposts",
          localField: "_id",
          foreignField: "group_id",
          pipeline: [
            {
              $match: {
                status: "approved"
              }
            }
          ],
          as: "posts"
        }
      },
      {
        $addFields: {
          postCount: { $size: "$posts" }
        }
      },

      // Count reports
      {
        $lookup: {
          from: "groupreports",
          localField: "_id",
          foreignField: "reportedGroup",
          as: "reports"
        }
      },
      {
        $addFields: {
          reportCount: { $size: "$reports" },
          pendingReportCount: {
            $size: {
              $filter: {
                input: "$reports",
                as: "report",
                cond: { $in: ["$$report.status", ["pending", "investigating"]] }
              }
            }
          }
        }
      },

      {
        $project: {
          members: 0,
          posts: 0,
          reports: 0
        }
      },

      { $sort: sortOptions },
      { $skip: skip },
      { $limit: parseInt(limit) }
    ]);

    const totalCount = await Group.countDocuments(filter);

    const totalDeletedGroups = await Group.countDocuments({ status: "deleted" });

    const totalActiveGroups = await Group.countDocuments({ status: { $ne: "deleted" } });

    const activeGroupIds = await Group.find({ status: { $ne: "deleted" } }).distinct("_id");
    const totalPosts = await GroupPost.countDocuments({
      group_id: { $in: activeGroupIds },
      status: "approved"
    });

    const totalMembers = await GroupMember.countDocuments({
      group: { $in: activeGroupIds },
      status: "approved",
      is_removed: false
    });

    res.status(200).json({
      success: true,
      data: {
        groups,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / limit),
          totalGroups: totalCount,
          limit: parseInt(limit)
        },
        statistics: {
          totalActiveGroups,
          totalDeletedGroups,
          totalPosts,
          totalMembers
        }
      }
    });

  } catch (error) {
    console.error("Error in getAllGroupsWithStats:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching groups",
      error: error.message
    });
  }
};

const getAllGroupReportsByStatus = async (req, res) => {
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
      'warningCount': 'group.warningCount',
      'reportCount': 'reportCount',
      'severity': 'group.severity'
    };

    const actualSortField = fieldMapping[sortBy] || sortBy;

    // Build sort options
    const sortOptions = {};
    sortOptions[actualSortField] = order === 'desc' ? -1 : 1;

    // Xác định filter cho group status dựa trên type
    const groupStatusFilter = type === 'pending'
      ? { "groupInfo.status": { $ne: "investigating" } }  // Pending: loại bỏ investigating
      : { "groupInfo.status": "investigating" };           // Investigating: chỉ lấy investigating

    // Search filter
    const searchFilter = search && search.trim() !== '' 
      ? { "groupInfo.name": { $regex: search.trim(), $options: 'i' } }
      : {};

    // Aggregate pipeline
    const groupedReports = await GroupReport.aggregate([
      // Chỉ lấy reports pending/investigating
      {
        $match: {
          status: { $in: ["pending", "investigating"] }
        }
      },

      // Lookup group info
      {
        $lookup: {
          from: "groups",
          localField: "reportedGroup",
          foreignField: "_id",
          as: "groupInfo",
          pipeline: [
            {
              $project: {
                _id: 1,
                name: 1,
                description: 1,
                cover_url: 1,
                privacy: 1,
                creator: 1,
                severity: 1,
                status: 1,
                warningCount: 1,
                created_at: 1
              }
            }
          ]
        }
      },
      { $unwind: { path: "$groupInfo", preserveNullAndEmptyArrays: true } },

      // Filter theo type
      {
        $match: groupStatusFilter
      },

      // Search filter
      ...(Object.keys(searchFilter).length > 0 ? [{ $match: searchFilter }] : []),

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

      {
        $group: {
          _id: "$reportedGroup",
          groupInfo: { $first: "$groupInfo" },
          reportCount: { $sum: 1 },
          reports: {
            $push: {
              _id: "$_id",
              reportType: "$reportType",
              reason: "$reason",
              status: "$status",
              reporter: "$reporterInfo",
              createdAt: "$createdAt",
              assignedTo: "$assignedTo"
            }
          },
          latestReportDate: { $max: "$createdAt" },
          oldestReportDate: { $min: "$createdAt" },
          reportTypes: { $addToSet: "$reportType" },
          reportTypeBreakdown: {
            $push: "$reportType"
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
          }
        }
      },

      {
        $lookup: {
          from: "users",
          localField: "groupInfo.creator",
          foreignField: "_id",
          as: "creatorInfo",
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
      { $unwind: { path: "$creatorInfo", preserveNullAndEmptyArrays: true } },

      {
        $addFields: {
          "groupInfo.creator": "$creatorInfo"
        }
      },

      {
        $project: {
          _id: 0,
          groupId: "$_id",
          group: "$groupInfo",
          reportCount: 1,
          reports: 1,
          latestReportDate: 1,
          oldestReportDate: 1,
          reportTypes: 1,
          reportTypeCount: 1,
        }
      },

      { $sort: sortOptions },

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

    // Tính tổng số reports theo type
    const totalReportsCount = await GroupReport.aggregate([
      {
        $match: {
          status: { $in: ["pending", "investigating"] }
        }
      },
      {
        $lookup: {
          from: "groups",
          localField: "reportedGroup",
          foreignField: "_id",
          as: "groupInfo"
        }
      },
      { $unwind: "$groupInfo" },
      {
        $match: groupStatusFilter
      },
      // Search filter
      ...(Object.keys(searchFilter).length > 0 ? [{ $match: searchFilter }] : []),
      {
        $count: "total"
      }
    ]);

    const totalReports = totalReportsCount[0]?.total || 0;

    const labels = type === 'pending'
      ? {
        totalReportsKey: 'totalPendingReports',
        totalGroupsKey: 'totalPendingGroups'
      }
      : {
        totalReportsKey: 'totalInvestigatingReports',
        totalGroupsKey: 'totalInvestigatingGroups'
      };

    res.status(200).json({
      success: true,
      data: {
        type,
        groupReports: data,
        pagination: {
          currentPage: metadata.page,
          totalPages: metadata.totalPages,
          [labels.totalGroupsKey]: metadata.total,
          limit: metadata.limit
        },
        statistics: {
          [labels.totalReportsKey]: totalReports,
          [labels.totalGroupsKey]: metadata.total
        }
      }
    });

  } catch (error) {
    console.error("Error in getAllGroupReportsByStatus:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching group reports",
      error: error.message
    });
  }
};

const getGroupStatistics = async (req, res) => {
  try {
    // Tổng số group
    const totalGroups = await Group.countDocuments({ status: { $ne: "deleted" } });

    // Tổng số group đang có status investigating
    const totalGroupInvestigating = await Group.countDocuments({ status: "investigating" });

    // Tổng số group có report pending (không bao gồm group có status investigating)
    const groupsWithPendingReports = await GroupReport.aggregate([
      {
        $match: {
          status: { $in: ["pending", "investigating"] }
        }
      },
      // Lookup group info để check status
      {
        $lookup: {
          from: "groups",
          localField: "reportedGroup",
          foreignField: "_id",
          as: "groupInfo"
        }
      },
      { $unwind: "$groupInfo" },
      // Loại bỏ các group có status là investigating
      {
        $match: {
          "groupInfo.status": { $ne: "investigating" }
        }
      },
      // Group by reportedGroup để đếm số group unique
      {
        $group: {
          _id: "$reportedGroup"
        }
      },
      // Đếm tổng số group
      {
        $count: "total"
      }
    ]);

    const totalGroupWithPendingReports = groupsWithPendingReports[0]?.total || 0;

    res.status(200).json({
      success: true,
      data: {
        totalGroups,
        totalGroupWithPendingReports,
        totalGroupInvestigating,
      }
    });

  } catch (error) {
    console.error("Error in getGroupStatistics:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching group statistics",
      error: error.message
    });
  }
};

const dismissAllPendingReportsOfGroup = async (req, res) => {
  try {
    const { groupId } = req.params;

    if (!Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid group ID"
      });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found"
      });
    }

    // Lấy tất cả pending reports
    const reports = await GroupReport.find({
      reportedGroup: groupId,
      status: "pending"
    });

    if (reports.length === 0) {
      return res.status(200).json({
        success: true,
        message: "No pending reports to dismiss",
        data: {
          dismissedCount: 0,
          groupStatus: group.status
        }
      });
    }

    // Cập nhật tất cả reports thành dismissed
    await GroupReport.updateMany(
      { _id: { $in: reports.map(r => r._id) } },
      {
        $set: {
          status: "dismissed",
          resolvedAt: new Date()
        }
      }
    );

    // Reset group status nếu đang investigating
    if (group.status === "investigating") {
      group.status = "active";
    }
    group.severity = "low";
    await group.save();

    // Gửi thông báo cho creator
    try {
      const io = getSocketIO();
      const notificationsNamespace = io.of("/notifications");
      const { getNotificationUserSocketMap } = require("../../socket/io-instance");
      const notificationUserSocketMap = getNotificationUserSocketMap();

      await notificationService.createNotificationWithNamespace(
        notificationsNamespace,
        group.creator,
        "system",
        `All reports against your group "${group.name}" have been reviewed and dismissed. Your group is in good standing.`,
        notificationUserSocketMap,
        {
          relatedId: groupId,
          type: "group_reports_dismissed"
        }
      );
    } catch (notifyErr) {
      console.error("Failed to send notification:", notifyErr);
    }

    res.status(200).json({
      success: true,
      message: `Successfully dismissed ${reports.length} report(s)`,
      data: {
        dismissedCount: reports.length,
        groupStatus: group.status
      }
    });

  } catch (error) {
    console.error("Error in dismissAllPendingReportsOfGroup:", error);
    res.status(500).json({
      success: false,
      message: "Error dismissing reports",
      error: error.message
    });
  }
};

const markGroupAsInvestigating = async (req, res) => {
  try {
    const { groupId } = req.params;
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found"
      });
    }

    if (group.status === "investigating") {
      return res.status(200).json({
        success: true,
        message: "Group is already under investigation",
        data: { group }
      });
    }

    group.status = "investigating";
    await group.save();

    res.status(200).json({
      success: true,
      message: "Group marked as investigating successfully",
      data: { group }
    });

  } catch (error) {
    console.error("Error in markGroupAsInvestigating:", error);
    res.status(500).json({
      success: false,
      message: "Error marking group as investigating",
      error: error.message
    });
  }
};

const getAllResolvedGroupReports = async (req, res) => {
  try {
    const { page = 1, limit = 10, sortBy = 'reportCount', order = 'desc', status } = req.query;
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
    const groupedReports = await GroupReport.aggregate([
      // Chỉ lấy reports đã xử lý (dismissed/resolved)
      {
        $match: {
          status: reportStatusFilter
        }
      },

      // Lookup group info
      {
        $lookup: {
          from: "groups",
          localField: "reportedGroup",
          foreignField: "_id",
          as: "groupInfo",
          pipeline: [
            {
              $project: {
                _id: 1,
                name: 1,
                description: 1,
                cover_url: 1,
                privacy: 1,
                creator: 1,
                severity: 1,
                status: 1,
                warningCount: 1,
                created_at: 1
              }
            }
          ]
        }
      },
      { $unwind: { path: "$groupInfo", preserveNullAndEmptyArrays: true } },

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

      // Group by reportedGroup
      {
        $group: {
          _id: "$reportedGroup",
          groupInfo: { $first: "$groupInfo" },
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
              resolvedAt: "$resolvedAt",
              assignedTo: "$assignedTo"
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
          warningCount: {
            $size: {
              $filter: {
                input: "$actionBreakdown",
                as: "a",
                cond: { $eq: ["$$a", "warning_sent"] }
              }
            }
          }
        }
      },

      // Lookup creator info
      {
        $lookup: {
          from: "users",
          localField: "groupInfo.creator",
          foreignField: "_id",
          as: "creatorInfo",
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
      { $unwind: { path: "$creatorInfo", preserveNullAndEmptyArrays: true } },

      {
        $addFields: {
          "groupInfo.creator": "$creatorInfo"
        }
      },

      // Project final fields
      {
        $project: {
          _id: 0,
          groupId: "$_id",
          group: "$groupInfo",
          reportCount: 1,
          reports: 1,
          latestReportDate: 1,
          oldestReportDate: 1,
          resolvedDate: 1,
          reportTypes: 1,
          reportTypeCount: 1,
          dismissedCount: 1,
          resolvedCount: 1,
          warningCount: 1
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

    // Tính tổng số reports đã xử lý
    const totalReportsCount = await GroupReport.countDocuments({
      status: reportStatusFilter
    });

    // Tính số lượng dismissed và resolved
    const dismissedCount = await GroupReport.countDocuments({ status: "dismissed" });
    const resolvedCount = await GroupReport.countDocuments({ status: "resolved" });

    res.status(200).json({
      success: true,
      data: {
        groupReports: data,
        pagination: {
          currentPage: metadata.page,
          totalPages: metadata.totalPages,
          totalGroups: metadata.total,
          limit: metadata.limit
        },
        statistics: {
          totalResolvedReports: totalReportsCount,
          totalDismissedReports: dismissedCount,
          totalResolvedWithAction: resolvedCount,
          totalGroups: metadata.total
        }
      }
    });

  } catch (error) {
    console.error("Error in getAllResolvedGroupReports:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching resolved group reports",
      error: error.message
    });
  }
};

const sendWarningToGroup = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { reason, adminNote, violationType } = req.body;

    // Validate input
    if (!adminNote || adminNote.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Admin note is required"
      });
    }

    if (!Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid group ID"
      });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found"
      });
    }

    // Lấy tất cả pending reports
    const reports = await GroupReport.find({
      reportedGroup: groupId,
      status: "pending"
    });

    if (reports.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No pending reports to resolve"
      });
    }

    // ========== KIỂM TRA NẾU ĐÃ ĐỦ 5 WARNINGS → XÓA GROUP ==========
    const willDeleteGroup = group.warningCount >= 5;

    if (willDeleteGroup) {
      // Cập nhật reports thành resolved
      await GroupReport.updateMany(
        { _id: { $in: reports.map(r => r._id) } },
        {
          $set: {
            status: "resolved",
            actionTaken: "group_deleted",
            resolvedAt: new Date()
          }
        }
      );

      // Lưu thông tin group trước khi xóa (để gửi notification)
      const groupName = group.name;
      const creatorId = group.creator;

      // Gửi thông báo TRƯỚC KHI XÓA
      try {
        const io = getSocketIO();
        const notificationsNamespace = io.of("/notifications");
        const { getNotificationUserSocketMap } = require("../../socket/io-instance");
        const notificationUserSocketMap = getNotificationUserSocketMap();

        const deletionMessage =
          `🚨 GROUP DELETED - MAXIMUM WARNINGS REACHED\n` +
          `Group: "${groupName}"\n` +
          `Violation Type: ${violationType}\n` +
          (reason ? `Reason: ${reason}\n` : '') +
          `\n` +
          `Your group has been permanently deleted due to reaching the maximum warning limit (5/5).\n` +
          `This action cannot be undone.\n` +
          `Please review our community guidelines before creating new groups.`;

        await notificationService.createNotificationWithNamespace(
          notificationsNamespace,
          creatorId,
          "system",
          deletionMessage,
          notificationUserSocketMap,
          {
            relatedId: groupId,
            type: "group_deleted",
            severity: "critical",
            violationType: violationType,
            warningCount: 6 // Lần thứ 6
          }
        );
      } catch (notifyErr) {
        console.error("Failed to send deletion notification:", notifyErr);
      }

      // XÓA GROUP
      await deleteGroupInternal(groupId);

      return res.status(200).json({
        success: true,
        message: "Group deleted due to maximum warnings reached",
        data: {
          action: "group_deleted",
          warningCount: 6,
          severity: "critical",
          resolvedReports: reports.length,
          groupName: groupName
        }
      });
    }

    // ========== NẾU CHƯA ĐỦ 5 → GỬI WARNING BÌNH THƯỜNG ==========

    // Cập nhật tất cả reports thành resolved với actionTaken
    await GroupReport.updateMany(
      { _id: { $in: reports.map(r => r._id) } },
      {
        $set: {
          status: "resolved",
          actionTaken: "warning_sent",
          resolvedAt: new Date()
        }
      }
    );

    // Thêm warning vào group
    group.warningCount += 1;
    group.warnings.push({
      reason: reason || `Violation detected based on ${reports.length} report(s)`,
      issuedAt: new Date(),
      violationType: violationType,
      adminNote: adminNote
    });

    // Reset investigating status
    if (group.status === "investigating") {
      group.status = "active";
    }

    await group.save();

    // Gửi thông báo warning cho creator
    try {
      const io = getSocketIO();
      const notificationsNamespace = io.of("/notifications");
      const { getNotificationUserSocketMap } = require("../../socket/io-instance");
      const notificationUserSocketMap = getNotificationUserSocketMap();

      let warningMessage = `⚠️ GROUP WARNING (${group.warningCount}/5)\n`;
      warningMessage += `Group: "${group.name}"\n`;
      warningMessage += `Violation Type: ${violationType}\n`;

      if (reason) {
        warningMessage += `Reason: ${reason}\n`;
      }

      warningMessage += `\n`;

      if (group.warningCount >= 5) {
        warningMessage += "🚨 CRITICAL: Your group is at risk of deletion!\n";
        warningMessage += "Please take immediate action to comply with community guidelines.\n";
        warningMessage += "If group is deleted, can't be restored.";
      } else if (group.warningCount >= 3) {
        warningMessage += "⚠️ WARNING: Your group has received multiple warnings.\n";
        warningMessage += "Please review community guidelines immediately to avoid deletion.";
      } else {
        warningMessage += "Please ensure your group follows community guidelines to avoid further warnings.";
      }

      await notificationService.createNotificationWithNamespace(
        notificationsNamespace,
        group.creator,
        "system",
        warningMessage,
        notificationUserSocketMap,
        {
          relatedId: groupId,
          type: "group_warning",
          severity: group.severity,
          violationType: violationType,
          warningCount: group.warningCount
        }
      );
    } catch (notifyErr) {
      console.error("Failed to send notification:", notifyErr);
    }

    res.status(200).json({
      success: true,
      message: "Warning sent successfully",
      data: {
        warningCount: group.warningCount,
        severity: group.severity,
        resolvedReports: reports.length,
        group: {
          _id: group._id,
          name: group.name,
          status: group.status,
          warningCount: group.warningCount,
          severity: group.severity
        }
      }
    });

  } catch (error) {
    console.error("Error in sendWarningToGroup:", error);
    res.status(500).json({
      success: false,
      message: "Error sending warning",
      error: error.message
    });
  }
};

const getAllPostsInGroupForAdmin = async (req, res) => {
  try {
    const { group_id } = req.params;

    // Lấy params phân trang từ query
    const approvedPage = parseInt(req.query.approvedPage) || 1;
    const approvedLimit = parseInt(req.query.approvedLimit) || 10;
    const pendingPage = parseInt(req.query.pendingPage) || 1;
    const pendingLimit = parseInt(req.query.pendingLimit) || 10;

    const approvedSkip = (approvedPage - 1) * approvedLimit;
    const pendingSkip = (pendingPage - 1) * pendingLimit;

    // Đếm tổng số bài viết
    const totalApproved = await GroupPost.countDocuments({
      group_id,
      is_deleted: false,
      status: "approved",
    });

    const totalPending = await GroupPost.countDocuments({
      group_id,
      is_deleted: false,
      status: "pending",
    });

    // Lấy bài viết đã duyệt (approved) với phân trang
    const approvedPosts = await GroupPost.find({
      group_id,
      is_deleted: false,
      status: "approved",
    })
      .sort({ created_at: -1 })
      .skip(approvedSkip)
      .limit(approvedLimit)
      .populate("user_id", "username fullName avatar_url")
      .lean();

    // Lấy bài viết đang chờ duyệt (pending) với phân trang
    const pendingPosts = await GroupPost.find({
      group_id,
      is_deleted: false,
      status: "pending",
    })
      .sort({ created_at: -1 })
      .skip(pendingSkip)
      .limit(pendingLimit)
      .populate("user_id", "username fullName avatar_url")
      .lean();

    // Hàm helper để populate media cho từng post
    const populatePostMedia = async (post) => {
      const postMedia = await PostMedia.findOne({
        postgr_id: post._id,
      }).populate("media_id");

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
    };

    // Populate media cho approved posts
    const populatedApprovedPosts = await Promise.all(
      approvedPosts.map(populatePostMedia)
    );

    // Populate media cho pending posts
    const populatedPendingPosts = await Promise.all(
      pendingPosts.map(populatePostMedia)
    );

    // Trả về dữ liệu với 2 object riêng biệt và thông tin phân trang
    res.json({
      approvedPosts: {
        data: populatedApprovedPosts,
        pagination: {
          currentPage: approvedPage,
          limit: approvedLimit,
          total: totalApproved,
          totalPages: Math.ceil(totalApproved / approvedLimit),
          hasNextPage: approvedPage < Math.ceil(totalApproved / approvedLimit),
          hasPrevPage: approvedPage > 1,
        },
      },
      pendingPosts: {
        data: populatedPendingPosts,
        pagination: {
          currentPage: pendingPage,
          limit: pendingLimit,
          total: totalPending,
          totalPages: Math.ceil(totalPending / pendingLimit),
          hasNextPage: pendingPage < Math.ceil(totalPending / pendingLimit),
          hasPrevPage: pendingPage > 1,
        },
      },
      statistics: {
        totalApproved,
        totalPending,
        total: totalApproved + totalPending,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const deleteGroupForSevereViolation = async (req, res) => {
  try {
    const { groupId } = req.params;
    const { reason, adminNote, violationType } = req.body;

    // Validate input
    if (!adminNote || adminNote.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Admin note is required"
      });
    }

    if (!violationType || violationType.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Violation type is required"
      });
    }

    if (!Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid group ID"
      });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({
        success: false,
        message: "Group not found"
      });
    }

    // Lấy tất cả pending reports
    const reports = await GroupReport.find({
      reportedGroup: groupId,
      status: "pending"
    });

    // Cập nhật tất cả reports thành resolved với actionTaken là "group_deleted"
    await GroupReport.updateMany(
      { _id: { $in: reports.map(r => r._id) } },
      {
        $set: {
          status: "resolved",
          actionTaken: "group_deleted",
          resolvedAt: new Date()
        }
      }
    );

    // Gửi thông báo trước khi xóa group
    try {
      const io = getSocketIO();
      const notificationsNamespace = io.of("/notifications");
      const { getNotificationUserSocketMap } = require("../../socket/io-instance");
      const notificationUserSocketMap = getNotificationUserSocketMap();

      const deletionMessage =
        `🚨 GROUP DELETED - SEVERE VIOLATION\n` +
        `Group: "${group.name}"\n` +
        `Violation Type: ${violationType}\n` +
        (reason ? `Reason: ${reason}\n` : '') +
        `\n` +
        `Your group has been permanently deleted due to a severe violation of community guidelines.\n` +
        `This action cannot be undone.\n` +
        `Please review our community guidelines before creating new groups.`;

      await notificationService.createNotificationWithNamespace(
        notificationsNamespace,
        group.creator,
        "system",
        deletionMessage,
        notificationUserSocketMap,
        {
          relatedId: groupId,
          type: "group_deleted",
          severity: "critical",
          violationType: violationType
        }
      );
    } catch (notifyErr) {
      console.error("Failed to send deletion notification:", notifyErr);
    }

    // Xóa group và tất cả dữ liệu liên quan
    await deleteGroupInternal(groupId);

    res.status(200).json({
      success: true,
      message: "Group deleted due to severe violation",
      data: {
        action: "group_deleted",
        severity: "critical",
        resolvedReports: reports.length,
        groupName: group.name
      }
    });
  } catch (error) {
    console.error("Error in deleteGroupForSevereViolation:", error);
    res.status(500).json({
      success: false,
      message: "Error deleting group for severe violation",
      error: error.message
    });
  }
};

//Helpers
const deleteGroupInternal = async (groupId) => {
  try {
    // 1. Lấy tất cả post IDs của group
    const groupPosts = await GroupPost.find({ group_id: groupId }).select("_id");
    const postIds = groupPosts.map((post) => post._id);

    // 2. Lấy tất cả comment IDs từ các group posts
    const comments = await Comment.find({
      postgr_id: { $in: postIds },
    }).select("_id");
    const commentIds = comments.map((comment) => comment._id);

    // 3. Xóa tất cả dữ liệu liên quan theo thứ tự đúng
    await Promise.all([
      // 3a. Xóa comment reactions trước
      CommentReaction.deleteMany({
        comment_id: { $in: commentIds },
      }),

      // 3b. Xóa post reactions
      PostReaction.deleteMany({
        postgr_id: { $in: postIds },
      }),

      // 3c. Xóa media của posts
      PostMedia.deleteMany({
        postgr_id: { $in: postIds },
      }),
    ]);

    // 4. Xóa comments (sau khi đã xóa reactions)
    await Comment.deleteMany({
      postgr_id: { $in: postIds },
    });

    // 5. Xóa group posts (sau khi đã xóa comments và reactions)
    await GroupPost.deleteMany({ group_id: groupId });

    // 6. Xóa members, requests, reports của group
    await Promise.all([
      GroupMember.deleteMany({ group: groupId }),
      GroupRequest.deleteMany({ group_id: groupId }),
      GroupReport.deleteMany({ reportedGroup: groupId }),
    ]);

    // 7. Cuối cùng xóa group
    await Group.findByIdAndDelete(groupId);

    return true;
  } catch (error) {
    console.error("Error in deleteGroupInternal:", error);
    throw error;
  }
};



module.exports = {
  getAllGroupsWithStats,
  getAllGroupReportsByStatus,
  getGroupStatistics,
  dismissAllPendingReportsOfGroup,
  sendWarningToGroup,
  markGroupAsInvestigating,
  getAllResolvedGroupReports,
  getAllPostsInGroupForAdmin,
  deleteGroupForSevereViolation,
};