const mongoose = require("mongoose");

const groupRequestSchema = new mongoose.Schema({
  group_id: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
  requested_at: { type: Date, default: Date.now },
  handled_at: { type: Date }
});

groupRequestSchema.index({ group_id: 1, user_id: 1 }, { unique: true });

module.exports = mongoose.model("GroupRequest", groupRequestSchema);