const mongoose = require("mongoose");

const postMediaSchema = new mongoose.Schema({
  post_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Post",
    required: true,
  },
  media_id: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Media",
      required: true,
    },
  ],
});

postMediaSchema.index({ post_id: 1, media_id: 1 }, { unique: true });

module.exports = mongoose.model("PostMedia", postMediaSchema);
