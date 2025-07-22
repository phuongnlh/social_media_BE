// user_settings.model.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

const userSettingSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    key: { type: String, required: true },
    value: { type: String, required: true },
    privacy_level: {
      type: String,
      enum: ["public", "friends", "private", "custom"],
      default: "private",
    },
    custom_group: { type: Schema.Types.Mixed, default: null },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

userSettingSchema.index({ user_id: 1, key: 1 }, { unique: true });

module.exports = mongoose.model("UserSetting", userSettingSchema);
