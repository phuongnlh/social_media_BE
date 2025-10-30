const mongoose = require("mongoose");

const groupReportSchema = new mongoose.Schema(
  {
    // Người báo cáo
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Nhóm bị báo cáo
    reportedGroup: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },

    // Loại báo cáo
    reportType: {
      type: String,
      enum: [
        "spam",
        "harassment",
        "inappropriate_content",
        "fake_information",
        "hate_speech",
        "violence",
        "scam",
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
      enum: ["pending", "resolved", "dismissed"],
      default: "pending",
    },

    // Hành động đã thực hiện
    actionTaken: {
      type: String,
      enum: [
        "none",
        "warning_sent",
        "group_deleted",
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
groupReportSchema.index(
  { reportedGroup: 1, reportedBy: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: { $in: "pending" }
    }
  }
); // Một người dùng chỉ có thể báo cáo cùng một nhóm một lần khi báo cáo đang chờ xử lý
groupReportSchema.index({ status: 1, createdAt: -1 });
groupReportSchema.index({ reportedGroup: 1, createdAt: -1 });
groupReportSchema.index({ assignedTo: 1, status: 1 });

// Pre-save middleware
groupReportSchema.pre("save", function (next) {
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
groupReportSchema.statics.getReportStats = async function (timeframe = "30d") {
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

groupReportSchema.statics.getTopReportedGroups = async function (limit = 10) {
  return await this.aggregate([
    { $match: { status: { $in: ["pending", "investigating"] } } },
    {
      $group: {
        _id: "$reportedGroup",
        reportCount: { $sum: 1 },
        reportTypes: { $addToSet: "$reportType" },
        latestReport: { $max: "$createdAt" },
      },
    },
    { $sort: { reportCount: -1, latestReport: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: "groups",
        localField: "_id",
        foreignField: "_id",
        as: "groupDetails",
      },
    },
  ]);
};

// Instance methods
groupReportSchema.methods.addAdminNote = function (adminId, note) {
  this.adminNotes.push({
    admin: adminId,
    note: note,
    createdAt: new Date(),
  });
  return this.save();
};

groupReportSchema.methods.assignTo = function (adminId) {
  this.assignedTo = adminId;
  if (this.status === "pending") {
    this.status = "investigating";
  }
  return this.save();
};

groupReportSchema.methods.resolve = function (
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

const GroupReport = mongoose.model("GroupReport", groupReportSchema);

module.exports = GroupReport;