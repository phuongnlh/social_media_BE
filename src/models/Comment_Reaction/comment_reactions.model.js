const mongoose = require("mongoose");

const commentReactionSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    comment_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Comment",
      required: true,
    },
    type: {
      type: String,
      enum: ["like", "love", "haha", "wow", "sad", "angry"],
      required: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
commentReactionSchema.index({ user_id: 1, comment_id: 1 }, { unique: true });
module.exports = mongoose.model("CommentReaction", commentReactionSchema);
