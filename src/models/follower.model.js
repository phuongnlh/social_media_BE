const mongoose = require("mongoose");

const followerSchema = new mongoose.Schema({
  follower_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  following_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  created_at: { type: Date, default: Date.now },
});

followerSchema.index({ follower_id: 1, following_id: 1 }, { unique: true });

module.exports = mongoose.model("Follower", followerSchema);
