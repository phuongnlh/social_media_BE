const mongoose = require("mongoose");

const userReportSchema = new mongoose.Schema(
  {
    // Người báo cáo
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Bài viết bị báo cáo
    reportedPost: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
    },

    // Người viết bài bị báo cáo
    reportedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Loại báo cáo
    reportType: {
      type: String,
      enum: [
        "spam",
        "harassment",
        "inappropriate_content",
        "fake_news",
        "copyright",
        "violence",
        "hate_speech",
        "self_harm",
        "scam",
        "impersonation",
        "other",
      ],
      required: true,
    },

    // Lý do báo cáo
    reason: {
      type: String,
      required: true,
      maxlength: 500,
    },

    // Trạng thái xử lý
    status: {
      type: String,
      enum: ["pending", "investigating", "resolved", "dismissed"],
      default: "pending",
    },

    // Hành động đã thực hiện
    actionTaken: {
      type: String,
      enum: [
        "none",
        "content_removed",
        "user_banned",
      ],
      default: "none",
    },

    resolvedAt: Date,
  },
  {
    timestamps: true,
  }
);

// Indexes
userReportSchema.index(
  { reportedPost: 1, reportedBy: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: ["pending"] }
    }
  }
); // Một người chỉ có thể báo cáo cùng một bài viết một lần khi báo cáo đang chờ xử lý
userReportSchema.index({ status: 1, createdAt: -1 });
userReportSchema.index({ reportedPost: 1, createdAt: -1 });
userReportSchema.index({ reportedUser: 1, createdAt: -1 });

// Pre-save middleware
userReportSchema.pre("save", function (next) {
  // Set resolvedAt khi status thay đổi thành resolved
  if (
    this.isModified("status") &&
    this.status === "resolved" &&
    !this.resolvedAt
  ) {
    this.resolvedAt = new Date();
  }
  next();
});

// Static methods
userReportSchema.statics.getReportStats = async function (timeframe = "30d") {
  const days = parseInt(timeframe.replace("d", ""));
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return await this.aggregate([
    { $match: { createdAt: { $gte: startDate } } },
    {
      $group: {
        _id: null,
        totalReports: { $sum: 1 },
        pendingReports: {
          $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] },
        },
        resolvedReports: {
          $sum: { $cond: [{ $eq: ["$status", "resolved"] }, 1, 0] },
        },
        reportsByType: {
          $push: "$reportType",
        },
      },
    },
  ]);
};

userReportSchema.statics.getTopReportedPosts = async function (limit = 10) {
  return await this.aggregate([
    { $match: { status: "pending" } },
    {
      $group: {
        _id: "$reportedPost",
        reportCount: { $sum: 1 },
        reportTypes: { $addToSet: "$reportType" },
        latestReport: { $max: "$createdAt" },
      },
    },
    { $sort: { reportCount: -1, latestReport: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: "posts",
        localField: "_id",
        foreignField: "_id",
        as: "postDetails",
      },
    },
  ]);
};

const UserReport = mongoose.model("UserReport", userReportSchema);

module.exports = UserReport;