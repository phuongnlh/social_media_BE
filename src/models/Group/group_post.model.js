const mongoose = require("mongoose");

const groupPostSchema = new mongoose.Schema({
  group_id: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  content: { type: String },
  status: { type: String, enum: ["approved", "pending", "rejected"], default: "approved" },
  approved_by: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  approved_at: { type: Date, default: null },
  is_deleted: { type: Boolean, default: false },
  deleted_at: { type: Date, default: null },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model("GroupPost", groupPostSchema);