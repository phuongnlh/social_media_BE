const mongoose = require("mongoose");

const groupMemberSchema = new mongoose.Schema({
  group: { type: mongoose.Schema.Types.ObjectId, ref: "Group", required: true },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  role: { type: String, enum: ["admin", "member"], default: "member" },
  status: { type: String, enum: ["banned", "approved"], default: "approved" },
  joined_at: { type: Date, default: Date.now },
  banned_at: { type: Date, default: null },     // Thời điểm bị ban,
  ban_reason: { type: String, default: null }, // Lý do bị ban
  restrict_post_until: { type: Date, default: null }, // hạn chế đăng bài đến thời điểm này
  restrict_reason: { type: String, default: null }, // Lí do hạn chế đăng bài
  count_violations: { type: Number, default: 0 }, // Đếm số lần vi phạm quy tắc nhóm
  is_removed: { type: Boolean, default: false }, // true nếu đã bị ban (nếu tự rời thì xóa document)

});

groupMemberSchema.index({ group: 1, user: 1 }, { unique: true });

module.exports = mongoose.model("GroupMember", groupMemberSchema);