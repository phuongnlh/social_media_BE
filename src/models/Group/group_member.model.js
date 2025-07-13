const mongoose = require("mongoose");

const groupMemberSchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  role: { type: String, enum: ["admin", "member"], default: "member" },
  status: { type: String, enum: ["pending", "approved"], default: "approved" },
  joined_at: { type: Date, default: Date.now },
});

groupMemberSchema.index({ group: 1, user: 1 }, { unique: true });

module.exports = mongoose.model("GroupMember", groupMemberSchema);