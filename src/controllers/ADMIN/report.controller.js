const UserReport = require("../../models/userReport.model");
const User = require("../../models/user.model");

// Lấy danh sách báo cáo (Admin)
const getReports = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      reportType,
      priority,
      assignedTo,
      search,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    // Build filter
    const filter = {};
    if (status) filter.status = status;
    if (reportType) filter.reportType = reportType;
    if (priority) filter.priority = priority;
    if (assignedTo) filter.assignedTo = assignedTo;

    // Build search
    let searchFilter = {};
    if (search) {
      searchFilter = {
        $or: [
          { reason: { $regex: search, $options: "i" } },
          { description: { $regex: search, $options: "i" } },
        ],
      };
    }

    const finalFilter = { ...filter, ...searchFilter };

    // Build sort
    const sort = {};
    sort[sortBy] = sortOrder === "desc" ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reports, total] = await Promise.all([
      UserReport.find(finalFilter)
        .populate([
          { path: "reportedBy", select: "username avatar_url email fullName" },
          { path: "reportedPost", select: "content images createdAt" },
          {
            path: "reportedUser",
            select: "username avatar_url email fullName",
          },
          { path: "assignedTo", select: "username avatar" },
          { path: "resolvedBy", select: "username avatar" },
        ])
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit)),
      UserReport.countDocuments(finalFilter),
    ]);

    res.json({
      success: true,
      data: {
        reports,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error("Error getting reports:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Cập nhật trạng thái báo cáo (Admin)
const updateReportStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, priority, actionTaken } = req.body;

    const report = await UserReport.findById(id);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    // Cập nhật các trường
    if (status) report.status = status;
    if (priority) report.priority = priority;
    if (actionTaken) report.actionTaken = actionTaken;

    await report.save();

    await report.populate([
      { path: "reportedBy", select: "username avatar" },
      { path: "reportedPost", select: "content images" },
      { path: "reportedUser", select: "username avatar" },
      { path: "assignedTo", select: "username avatar" },
    ]);

    res.json({
      success: true,
      message: "Report status updated successfully",
      data: report,
    });
  } catch (error) {
    console.error("Error updating report status:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Gán báo cáo cho admin (Admin)
const assignReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { adminId } = req.body;

    const report = await UserReport.findById(id);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    // Kiểm tra admin có tồn tại không
    const admin = await User.findById(adminId);
    if (!admin || admin.role !== "admin") {
      return res.status(400).json({
        success: false,
        message: "Invalid admin ID",
      });
    }

    await report.assignTo(adminId);

    await report.populate([
      { path: "assignedTo", select: "username avatar email" },
      { path: "reportedBy", select: "username avatar" },
      { path: "reportedPost", select: "content images" },
    ]);

    res.json({
      success: true,
      message: "Report assigned successfully",
      data: report,
    });
  } catch (error) {
    console.error("Error assigning report:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Thêm ghi chú admin
const addAdminNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { note } = req.body;

    if (!note || note.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Note is required",
      });
    }

    const report = await UserReport.findById(id);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    await report.addAdminNote(req.user.id, note.trim());

    await report.populate([
      { path: "adminNotes.admin", select: "username avatar" },
    ]);

    res.json({
      success: true,
      message: "Admin note added successfully",
      data: report,
    });
  } catch (error) {
    console.error("Error adding admin note:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Giải quyết báo cáo (Admin)
const resolveReport = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution, actionTaken = "none" } = req.body;

    if (!resolution || resolution.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Resolution is required",
      });
    }

    const report = await UserReport.findById(id);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    if (report.status === "resolved") {
      return res.status(400).json({
        success: false,
        message: "Report is already resolved",
      });
    }

    await report.resolve(req.user.id, resolution.trim(), actionTaken);

    await report.populate([
      { path: "resolvedBy", select: "username avatar" },
      { path: "reportedBy", select: "username avatar" },
      { path: "reportedPost", select: "content images" },
    ]);

    res.json({
      success: true,
      message: "Report resolved successfully",
      data: report,
    });
  } catch (error) {
    console.error("Error resolving report:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Lấy thống kê báo cáo (Admin)
const getReportStats = async (req, res) => {
  try {
    const { timeframe = "30d" } = req.query;

    const stats = await UserReport.getReportStats(timeframe);
    const topReportedPosts = await UserReport.getTopReportedPosts(10);

    // Thống kê theo loại báo cáo
    const reportTypeStats = await UserReport.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(
              Date.now() -
                parseInt(timeframe.replace("d", "")) * 24 * 60 * 60 * 1000
            ),
          },
        },
      },
      {
        $group: {
          _id: "$reportType",
          count: { $sum: 1 },
          resolved: {
            $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] },
          },
        },
      },
      { $sort: { count: -1 } },
    ]);

    // Thống kê theo trạng thái
    const statusStats = await UserReport.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(
              Date.now() -
                parseInt(timeframe.replace("d", "")) * 24 * 60 * 60 * 1000
            ),
          },
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    // Thống kê theo admin
    const adminStats = await UserReport.aggregate([
      {
        $match: {
          assignedTo: { $exists: true },
          createdAt: {
            $gte: new Date(
              Date.now() -
                parseInt(timeframe.replace("d", "")) * 24 * 60 * 60 * 1000
            ),
          },
        },
      },
      {
        $group: {
          _id: "$assignedTo",
          assigned: { $sum: 1 },
          resolved: {
            $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] },
          },
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "admin",
        },
      },
      {
        $project: {
          admin: { $arrayElemAt: ["$admin", 0] },
          assigned: 1,
          resolved: 1,
          resolutionRate: {
            $cond: [
              { $gt: ["$assigned", 0] },
              { $multiply: [{ $divide: ["$resolved", "$assigned"] }, 100] },
              0,
            ],
          },
        },
      },
      { $sort: { assigned: -1 } },
    ]);

    res.json({
      success: true,
      data: {
        overview: stats[0] || {
          totalReports: 0,
          pendingReports: 0,
          resolvedReports: 0,
          averageResolutionTime: 0,
        },
        reportTypeStats,
        statusStats,
        adminStats,
        topReportedPosts,
      },
    });
  } catch (error) {
    console.error("Error getting report stats:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Bulk operations (Admin only)
const bulkUpdateReports = async (req, res) => {
  try {
    const { reportIds, updates } = req.body;

    if (!reportIds || !Array.isArray(reportIds) || reportIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Report IDs are required",
      });
    }

    const allowedUpdates = ["status", "priority", "assignedTo"];
    const updateData = {};

    Object.keys(updates).forEach((key) => {
      if (allowedUpdates.includes(key)) {
        updateData[key] = updates[key];
      }
    });

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid updates provided",
      });
    }

    const result = await UserReport.updateMany(
      { _id: { $in: reportIds } },
      { $set: updateData }
    );

    res.json({
      success: true,
      message: `Updated ${result.modifiedCount} reports successfully`,
      data: {
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    console.error("Error bulk updating reports:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = {
  getReports,
  updateReportStatus,
  assignReport,
  addAdminNote,
  resolveReport,
  getReportStats,
  bulkUpdateReports,
};
