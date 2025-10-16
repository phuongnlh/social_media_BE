const mongoose = require("mongoose");
const adminSchema = new mongoose.Schema(
  {
    username: { type: String, minLength: 8, unique: true },
    hash: { type: String, required: true },
    salt: { type: String, required: true },
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
    },
    fullName: { type: String },
    avatar_url: {
      type: String,
      default: "https://minio.dailyvibe.online/dailyvibe/avatars/avatar.jpg",
    },
    isActive: { type: Boolean, default: true },
    isPrivate: { type: Boolean, default: false },
    EmailVerified: { type: Boolean, default: false },
    PhoneVerified: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false },
    is_deleted: { type: Boolean, default: false },
    twoFASecret: String,
    twoFAEnabled: { type: Boolean, default: false },
  },
  { timestamps: true }
);
const Admin = mongoose.model("Admin", adminSchema);
module.exports = Admin;
