const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // người nhận
    from_user: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // người gửi
    type: String, // ví dụ: "friend_request", "like", "comment", "message"
    content: String,
    is_read: { type: Boolean, default: false },
    related_id: String, // ID liên quan (post_id, comment_id, etc.)
  },
  { timestamps: true }
);

module.exports = mongoose.model("Notification", notificationSchema);
