const mongoose = require("mongoose");

const storySchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    storyText: { type: String, maxlength: 500 },
    imageUrl: { type: String },
    videoUrl: { type: String },
    backgroundColor: { type: String, default: "#6366f1" },
    textColor: { type: String, default: "#ffffff" },
    privacy: {
      type: String,
      enum: ["private", "friends", "public"],
      default: "public",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Story", storySchema);
