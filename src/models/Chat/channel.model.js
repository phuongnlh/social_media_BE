const mongoose = require("mongoose");

const MemberSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: "User",
  },
  role: {
    type: String,
    enum: ["admin", "member"],
    default: "member",
  },
  joinedAt: {
    type: Date,
    default: Date.now,
  },
  isMuted: {
    type: Boolean,
    default: false,
  },
  is_deleted: {
    type: Boolean,
    default: false,
  },
  deletedAt: { type: Date },
});

const ChannelSchema = new mongoose.Schema(
  {
    channelId: {
      type: String,
      required: true,
      unique: true,
    },
    type: {
      type: String,
      enum: ["private", "group"],
      required: true,
    },
    name: {
      type: String, // chỉ dùng cho group
    },
    avatar: {
      type: String, // chỉ dùng cho group
    },
    members: {
      type: [MemberSchema],
      default: [],
    },
    createdBy: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Channel", ChannelSchema);
