const UserReport = require("../models/userReport.model");
const Post = require("../models/post.model");
const User = require("../models/user.model");
const { validationResult } = require("express-validator");
const adsModel = require("../models/Payment_Ads/ads.model");
const { getSocketIO, getNotificationUserSocketMap } = require("../socket/io-instance");
const notificationService = require("../services/notification.service");

// Tạo báo cáo mới
const createReport = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: errors.array(),
      });
    }

    const { reportedPost, reportType, description, reason, evidence = [], reporterInfo = {} } = req.body;

    // Kiểm tra bài viết có tồn tại không
    const post = await Post.findById(reportedPost);
    if (!post) {
      return res.status(404).json({
        success: false,
        message: "Post not found",
      });
    }

    // Kiểm tra đã báo cáo bài viết này chưa
    const existingReport = await UserReport.findOne({
      reportedPost,
      reportedBy: req.user._id,
    });

    if (existingReport) {
      return res.status(400).json({
        success: false,
        message: "You have already reported this post",
      });
    }

    // Tạo báo cáo mới
    const report = new UserReport({
      reportedBy: req.user._id,
      reportedPost,
      reportedUser: post.user_id,
      reportType,
      description,
      reason,
      evidence,
      reporterInfo: {
        ...reporterInfo,
        ipAddress: req.ip,
        userAgent: req.get("User-Agent"),
      },
      metadata: {
        reportSource: req.get("User-Agent")?.includes("Mobile") ? "mobile" : "web",
        language: req.get("Accept-Language")?.split(",")[0] || "en",
      },
    });

    await report.save();

    const countReports = await UserReport.countDocuments({ reportedPost });

    if (countReports >= 5) {
      const existingAds = await adsModel.findOne({ post_id: reportedPost });
      if (!existingAds) {
        post.is_deleted = true;
        await post.save();
        try {
          const io = getSocketIO();
          const notificationsNamespace = io.of("/notifications");
          const notificationUserSocketMap = getNotificationUserSocketMap();
          await notificationService.createNotificationWithNamespace(
            notificationsNamespace,
            post.user_id,
            "system",
            "Your post has been removed due to multiple reports.",
            notificationUserSocketMap,
            {
              fromUser: null,
              relatedId: post._id,
            }
          );
        } catch (error) {
          console.error("Error sending notification:", error);
        }
      }
    }

    // Populate thông tin cần thiết
    await report.populate([
      { path: "reportedBy", select: "username avatar" },
      { path: "reportedPost", select: "content images createdAt" },
      { path: "reportedUser", select: "username avatar" },
    ]);

    res.status(201).json({
      success: true,
      message: "Report created successfully",
      data: report,
    });
  } catch (error) {
    console.error("Error creating report:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Lấy báo cáo của user hiện tại
const getUserReports = async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

    const filter = { reportedBy: req.user.id };
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [reports, total] = await Promise.all([
      UserReport.find(filter)
        .populate([
          { path: "reportedPost", select: "content images createdAt" },
          { path: "reportedUser", select: "username avatar" },
        ])
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      UserReport.countDocuments(filter),
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
    console.error("Error getting user reports:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Xóa báo cáo (chỉ người tạo mới được xóa và chỉ khi chưa được xử lý)
const deleteReport = async (req, res) => {
  try {
    const { id } = req.params;

    const report = await UserReport.findById(id);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: "Report not found",
      });
    }

    // Chỉ cho phép người tạo báo cáo xóa
    if (report.reportedBy.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own reports",
      });
    }

    // Chỉ cho phép xóa nếu báo cáo chưa được xử lý
    if (report.status !== "pending") {
      return res.status(400).json({
        success: false,
        message: "Cannot delete report that is being processed or resolved",
      });
    }

    await UserReport.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Report deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting report:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

module.exports = {
  createReport,
  getUserReports,
  deleteReport,
};
