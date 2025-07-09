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
postReactionSchema.index({ user_id: 1, post_id: 1 }, { unique: true });

module.exports = mongoose.model("PostReaction", postReactionSchema);
