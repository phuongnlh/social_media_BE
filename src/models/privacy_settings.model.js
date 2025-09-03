const mongoose = require("mongoose");
const { Schema } = mongoose;

const privacySettingSchema = new Schema(
  {
    user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    profile_visibility: {
      type: String,
      enum: ["public", "friends", "private"],
      default: "public"
    },
    message_permission: {
      type: String,
      enum: ["everyone", "friends", "nobody"],
      default: "everyone"
    },
    online_status: {
      type: Boolean,
      default: true
    },
    read_receipts: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
  }
);

// Ensure each user has only one privacy settings document
privacySettingSchema.index({ user_id: 1 }, { unique: true });

module.exports = mongoose.model("PrivacySetting", privacySettingSchema);