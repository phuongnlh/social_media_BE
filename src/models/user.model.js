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
    avatar_url: {
      type: String,
      default:
        "https://imgs.search.brave.com/6HR4tEy66w7lxVW5WMr6xlX1gvARH2B5R5QD74X1viQ/rs:fit:500:0:1:0/g:ce/aHR0cHM6Ly9tZWRp/YS5pc3RvY2twaG90/by5jb20vaWQvMTQ5/NTA4ODA0My92ZWN0/b3IvdXNlci1wcm9m/aWxlLWljb24tYXZh/dGFyLW9yLXBlcnNv/bi1pY29uLXByb2Zp/bGUtcGljdHVyZS1w/b3J0cmFpdC1zeW1i/b2wtZGVmYXVsdC1w/b3J0cmFpdC5qcGc_/cz02MTJ4NjEyJnc9/MCZrPTIwJmM9ZGhW/MnAxSndtbG9CVE9h/R0F0YUEzQVcxS1Nu/anNkTXQ3LVVfM0Va/RWxaMD0",
    },
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
