const mongoose = require("mongoose");

const groupPostReportSchema = new mongoose.Schema({
  group_post_id: { type: mongoose.Schema.Types.ObjectId, ref: "GroupPost", required: true },
  group_id: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
  reporter_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  reason: { 
    type: String, 
    enum: ["spam", "harassment", "inappropriate_content", "violence", "hate_speech", "misinformation", "other"],
    required: true 
  },
  description: { type: String }, // Mô tả chi tiết (optional)
  status: { 
    type: String, 
    enum: ["pending", "reviewed", "dismissed"], 
    default: "pending" 
  },
  reviewed_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  reviewed_at: { type: Date, default: null },
  created_at: { type: Date, default: Date.now }
});

// Index để tránh duplicate report từ cùng 1 user cho cùng 1 post
groupPostReportSchema.index({ group_post_id: 1, reporter_id: 1 }, { unique: true });
groupPostReportSchema.index({ group_id: 1, status: 1 });
groupPostReportSchema.index({ group_post_id: 1 });

module.exports = mongoose.model("GroupPostReport", groupPostReportSchema);