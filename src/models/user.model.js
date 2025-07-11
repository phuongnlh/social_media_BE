const mongoose = require("mongoose");
const autoIncrement = require("mongoose-sequence")(mongoose);
const validator = require("validator");
const userSchema = new mongoose.Schema(
  {
    id: { type: mongoose.Schema.ObjectId },
    username: { type: String, required: true, minLength: 8, unique: true },
    hash: { type: String, required: true },
    salt: { type: String, required: true },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
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
    avatar_url: { type: String },
    cover_photo_url: { type: String },
    isActive: { type: Boolean, default: true },
    isPrivate: { type: Boolean, default: false },
    EmailVerified: { type: Boolean, default: false },
    PhoneVerified: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
module.exports = User;
