const mongoose = require("mongoose");
const validator = require("validator");
const userSchema = new mongoose.Schema(
  {
    id: { type: mongoose.Schema.ObjectId },
    username: { type: String, minLength: 8, unique: true },
    hash: { type: String, required: true },
    salt: { type: String, required: true },
    email: {
      type: String,
      required: [true, "Email is required"],
      lowercase: true,
      validate: {
        validator: validator.isEmail,
        message: "Please provide a valid email address",
      },
    },
    phone: { type: String },
    fullName: { type: String },
    bio: { type: String },
    dateOfBirth: { type: Date },
    location: { type: String },
    gender: { type: String, enum: ["male", "female", "other"] },
    avatar_url: {
      type: String,
      default: "https://minio.dailyvibe.online/dailyvibe/avatars/avatar.jpg",
    },
    cover_photo_url: { type: String },
    isActive: { type: Boolean, default: true },
    isPrivate: { type: Boolean, default: false },
    EmailVerified: { type: Boolean, default: false },
    PhoneVerified: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false },
    is_deleted: { type: Boolean, default: false },
    twoFASecret: String,
    twoFAEnabled: { type: Boolean, default: false },
    role: { type: String, enum: ["user", "admin"], default: "user" },
  },
  { timestamps: true }
);
userSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { is_deleted: false } });
const User = mongoose.model("User", userSchema);
module.exports = User;
