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
        "nudity",
        "terrorism",
        "self_harm",
        "scam",
        "impersonation",
        "other",
      ],
      required: true,
    },

    // Mô tả chi tiết về báo cáo
    description: {
      type: String,
      required: true,
      maxlength: 1000,
    },

    // Lý do báo cáo (ngắn gọn)
    reason: {
      type: String,
      required: true,
      maxlength: 200,
    },

    // Trạng thái xử lý
    status: {
      type: String,
      enum: ["pending", "investigating", "resolved", "dismissed", "escalated"],
      default: "pending",
    },

    // Mức độ ưu tiên
    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "medium",
    },

    // Bằng chứng đính kèm (URLs)
    evidence: [
      {
        type: {
          type: String,
          enum: ["image", "video", "screenshot", "link", "document"],
          required: true,
        },
        url: {
          type: String,
          required: true,
        },
        description: String,
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Admin xử lý
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Ghi chú của admin
    adminNotes: [
      {
        admin: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        note: {
          type: String,
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

    // Hành động đã thực hiện
    actionTaken: {
      type: String,
      enum: [
        "none",
        "warning_sent",
        "content_removed",
        "user_suspended",
        "user_banned",
        "content_hidden",
        "age_restricted",
        "education_sent",
      ],
      default: "none",
    },

    // Kết quả xử lý
    resolution: {
      type: String,
      maxlength: 500,
    },

    // Thời gian xử lý
    resolvedAt: Date,

    // Người xử lý
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Có thể khiếu nại hay không
    appealable: {
      type: Boolean,
      default: true,
    },

    // Báo cáo trước đó từ cùng user về cùng bài viết
    previousReports: {
      type: Number,
      default: 0,
    },

    // Thông tin IP và thiết bị của người báo cáo
    reporterInfo: {
      ipAddress: String,
      userAgent: String,
      location: {
        country: String,
        city: String,
      },
    },

    // Tự động phát hiện
    autoDetected: {
      type: Boolean,
      default: false,
    },

    // Điểm tin cậy từ AI
    confidenceScore: {
      type: Number,
      min: 0,
      max: 1,
    },

    // Tags từ AI
    aiTags: [String],

    // Báo cáo tương tự
    similarReports: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "UserReport",
      },
    ],

    // Metadata
    metadata: {
      reportSource: {
        type: String,
        enum: ["web", "mobile", "api", "auto_detection"],
        default: "web",
      },
      language: {
        type: String,
        default: "en",
      },
      timezone: String,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes để tối ưu query
userReportSchema.index({ reportedPost: 1, reportedBy: 1 }, { unique: true }); // Tránh spam report
userReportSchema.index({ status: 1, priority: -1, createdAt: -1 });
userReportSchema.index({ reportedUser: 1, createdAt: -1 });
userReportSchema.index({ reportType: 1, status: 1 });
userReportSchema.index({ assignedTo: 1, status: 1 });
userReportSchema.index({ createdAt: -1 });

// Virtual để lấy thời gian chờ xử lý
userReportSchema.virtual("pendingDuration").get(function () {
  if (this.status === "resolved" && this.resolvedAt) {
    return this.resolvedAt - this.createdAt;
  }
  return Date.now() - this.createdAt;
});

// Virtual để kiểm tra có quá hạn không (72 giờ)
userReportSchema.virtual("isOverdue").get(function () {
  if (this.status === "resolved") return false;
  const hoursLimit =
    this.priority === "urgent" ? 4 : this.priority === "high" ? 24 : 72;
  return Date.now() - this.createdAt > hoursLimit * 60 * 60 * 1000;
});

// Pre-save middleware
userReportSchema.pre("save", async function (next) {
  // Đếm báo cáo trước đó
  if (this.isNew) {
    const previousCount = await this.constructor.countDocuments({
      reportedPost: this.reportedPost,
      reportedBy: { $ne: this.reportedBy },
      createdAt: { $lt: this.createdAt },
    });
    this.previousReports = previousCount;

    // Tự động tăng priority nếu có nhiều báo cáo
    if (previousCount >= 5 && this.priority === "medium") {
      this.priority = "high";
    } else if (previousCount >= 10 && this.priority === "high") {
      this.priority = "urgent";
    }
  }

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
        averageResolutionTime: {
          $avg: {
            $cond: [
              { $eq: ["$status", "resolved"] },
              { $subtract: ["$resolvedAt", "$createdAt"] },
              null,
            ],
          },
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
    { $match: { status: { $in: ["pending", "investigating"] } } },
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

// Instance methods
userReportSchema.methods.addAdminNote = function (adminId, note) {
  this.adminNotes.push({
    admin: adminId,
    note: note,
    createdAt: new Date(),
  });
  return this.save();
};

userReportSchema.methods.assignTo = function (adminId) {
  this.assignedTo = adminId;
  if (this.status === "pending") {
    this.status = "investigating";
  }
  return this.save();
};

userReportSchema.methods.resolve = function (
  adminId,
  resolution,
  actionTaken = "none"
) {
  this.status = "resolved";
  this.resolvedBy = adminId;
  this.resolvedAt = new Date();
  this.resolution = resolution;
  this.actionTaken = actionTaken;
  return this.save();
};

const UserReport = mongoose.model("UserReport", userReportSchema);

module.exports = UserReport;
