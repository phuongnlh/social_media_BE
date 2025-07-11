const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    to: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    content: { type: String }, // văn bản (có thể null nếu chỉ gửi ảnh/video)

    media: [
      {
        url: { type: String }, // link Cloudinary
        type: { type: String, enum: ["image", "video"], default: "image" },
      },
    ],

    is_read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", messageSchema);
