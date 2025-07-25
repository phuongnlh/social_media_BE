const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    post_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
    },
    parent_comment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },
    content: {
      type: String,
    },
    media: {
      url: { type: String, required: false },
      media_type: { type: String, enum: ["image", "video"], required: false }
    },
    isDeleted: { type: Boolean, default: false },
    deleted_at: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Comment", commentSchema);
