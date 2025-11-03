const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: String,
  cover_url: String,
  privacy: { type: String, enum: ["Public", "Private"], default: "Public" },
  post_approval: { type: Boolean, default: false },
  creator: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  created_at: { type: Date, default: Date.now },

  warningCount: {
    type: Number,
    default: 0
  },

  warnings: [
    {
      reason: String,
      issuedAt: { type: Date, default: Date.now },
      violationType: {
        type: String,
        enum: [
          "spam",
          "harassment",
          "inappropriate_content",
          "fake_information",
          "hate_speech",
          "violence",
          "scam",
          "other"
        ]
      },
      adminNote: { type: String, required: true },
    }
  ],

  // Mức độ nghiêm trọng
  severity: {
    type: String,
    enum: ["low", "medium", "high", "critical"],
    default: "low"
  },

  status: {
    type: String,
    enum: ["active", "investigating", "deleted"],
    default: "active"
  },

});

groupSchema.index({ status: 1 });
groupSchema.index({ warningCount: 1 });
groupSchema.index({ creator: 1 });


module.exports = mongoose.model("Group", groupSchema);