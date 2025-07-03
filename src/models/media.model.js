const mongoose = require("mongoose");

const mediaSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    url: { type: String, required: true },
    media_type: { type: String, enum: ["image", "video"], required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Media", mediaSchema);
