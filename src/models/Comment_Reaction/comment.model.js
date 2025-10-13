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
      required: false,
    },
    postgr_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "GroupPost",
      required: false,
    },
    parent_comment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    },
    level: { type: Number, default: 0, index: true },
    root_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
      index: true,
    }, // id comment level 0
    thread_parent_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
      index: true,
    }, // id comment level 1 (đầu nhánh)
    reply_to_comment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      default: null,
    }, // trả lời cụ thể ai
    ancestors: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comment" }], // [root, level1]

    content: {
      type: String,
    },
    media: {
      url: { type: String, required: false },
      media_type: { type: String, enum: ["image", "video"], required: false },
    },
    is_deleted: { type: Boolean, default: false },
    deleted_at: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Comment", commentSchema);
