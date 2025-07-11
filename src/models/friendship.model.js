const mongoose = require("mongoose");

const friendshipSchema = new mongoose.Schema(
  {
    user_id_1: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    }, // sender
    user_id_2: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    }, // receiver
    status: {
      type: String,
      enum: ["pending", "accepted", "declined", "blocked"],
      required: true,
      default: "pending",
    },
    requested_at: { type: Date, default: Date.now },
    accepted_at: { type: Date },
  },
  {
    timestamps: true,
  }
);

friendshipSchema.index({ user_id_1: 1, user_id_2: 1 }, { unique: true });

module.exports = mongoose.model("Friendship", friendshipSchema);
