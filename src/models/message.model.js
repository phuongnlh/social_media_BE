const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    channelId: { type: String, required: true }, // ID của channel (private hoặc group)

    content: { type: String }, // văn bản (có thể null nếu chỉ gửi ảnh/video)

    media: [
      {
        url: { type: String }, // link Cloudinary
        type: { type: String, enum: ["image", "video"], default: "image" },
      },
    ],

    // // Tracking read status for each member in channel
    readBy: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        readAt: { type: Date, default: Date.now },
      },
    ],

    // Message type for system messages
    messageType: {
      type: String,
      enum: ["user", "system"],
      default: "user",
    },

    // For system messages (member added, removed, etc.)
    systemMessageData: {
      action: { type: String }, // "member_added", "member_removed", "group_renamed", etc.
      targetUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      oldValue: { type: String },
      newValue: { type: String },
    },
  },
  { timestamps: true }
);

// Index for better query performance
messageSchema.index({ channelId: 1, createdAt: -1 });
messageSchema.index({ from: 1 });

module.exports = mongoose.model("Message", messageSchema);
