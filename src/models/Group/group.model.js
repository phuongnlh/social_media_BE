const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: String,
  cover_url: String,
  privacy: { type: String, enum: ["Public", "Private"], default: "Public" },
  post_approval: { type: Boolean, default: false },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  created_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Group", groupSchema);