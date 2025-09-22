const mongoose = require("mongoose");

const storyViewSchema = new mongoose.Schema(
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
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
storyViewSchema.index({ user_id: 1, story_id: 1 }, { unique: true });
module.exports = mongoose.model("storyView", storyViewSchema);
