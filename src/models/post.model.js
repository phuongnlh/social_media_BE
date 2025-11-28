const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: { type: String },
    type: {
      type: String,
      enum: ["Public", "Private", "Friends"],
      default: "Public",
    },
    is_deleted: { type: Boolean, default: false },
    deleted_at: { type: Date, default: null },
    shared_post_id: {
      // Share pót
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      default: null,
    },
    moderation_status: { type: String, default: "normal" },
    moderation_details: { type: Object, default: {} },
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "low"
    },
    viewCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Post", postSchema);
