const mongoose = require("mongoose");

const storyReactionSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    story_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Story",
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
storyReactionSchema.index({ user_id: 1, story_id: 1 }, { unique: true });
module.exports = mongoose.model("storyReaction", storyReactionSchema);
