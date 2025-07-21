const mongoose = require("mongoose");

const postMediaSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["post", "post_group"],
    default: "post",
    required: true,
  },
  post_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Post",
  },
  postgr_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "GroupPost"
  },

  media_id: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Media",
      required: true,
    },
  ],
});

postMediaSchema.index({ post_id: 1, postgr_id: 1, media_id: 1 }, { unique: true });

module.exports = mongoose.model("PostMedia", postMediaSchema);
