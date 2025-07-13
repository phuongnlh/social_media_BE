const mongoose = require("mongoose");

const postReactionSchema = new mongoose.Schema(
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
    type: {
      type: String,
      enum: ["like", "love", "haha", "wow", "sad", "angry"],
      required: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
postReactionSchema.index({ user_id: 1, post_id: 1 }, { unique: true, partialFilterExpression: { post_id: { $exists: true } } });
postReactionSchema.index({ user_id: 1, postgr_id: 1 }, { unique: true, partialFilterExpression: { postgr_id: { $exists: true } } });

module.exports = mongoose.model("PostReaction", postReactionSchema);
