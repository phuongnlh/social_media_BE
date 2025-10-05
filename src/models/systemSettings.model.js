const mongoose = require("mongoose");
const { Schema } = mongoose;

const systemSettingsSchema = new Schema(
  {
    category: {
      type: String,
      required: true,
      enum: [
        "general",
        "security",
        "email",
        "content",
        "api",
        "features",
        "system",
      ],
      index: true,
    },
    key: {
      type: String,
      required: true,
      index: true,
    },
    value: {
      type: Schema.Types.Mixed, // Có thể là string, number, boolean, object
      required: true,
    },
    dataType: {
      type: String,
      enum: ["string", "number", "boolean", "object", "array"],
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    isEditable: {
      type: Boolean,
      default: true, // Một số settings có thể không cho phép edit qua UI
    },
    defaultValue: {
      type: Schema.Types.Mixed,
      required: true,
    },
    validation: {
      min: Number,
      max: Number,
      pattern: String, // Regex pattern for string validation
      required: Boolean,
      options: [String], // For enum values
    },
    lastModifiedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    lastModifiedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

// Compound index để đảm bảo unique combination
systemSettingsSchema.index({ category: 1, key: 1 }, { unique: true });

// Static methods để lấy settings theo category
systemSettingsSchema.statics.getByCategory = function (category) {
  return this.find({ category }).sort({ key: 1 });
};

systemSettingsSchema.statics.getAllSettings = function () {
  return this.find({}).sort({ category: 1, key: 1 });
};

systemSettingsSchema.statics.getSettingValue = function (category, key) {
  return this.findOne({ category, key }).then((setting) =>
    setting ? setting.value : null
  );
};

systemSettingsSchema.statics.updateSetting = async function (
  category,
  key,
  value,
  userId
) {
  const setting = await this.findOne({ category, key });
  if (!setting) {
    throw new Error(`Setting ${category}.${key} not found`);
  }

  if (!setting.isEditable) {
    throw new Error(`Setting ${category}.${key} is not editable`);
  }

  // Validate value based on dataType and validation rules
  this.validateValue(setting, value);

  setting.value = value;
  setting.lastModifiedBy = userId;
  setting.lastModifiedAt = new Date();

  return setting.save();
};

systemSettingsSchema.statics.validateValue = function (setting, value) {
  const { dataType, validation } = setting;

  // Type validation
  switch (dataType) {
    case "string":
      if (typeof value !== "string") {
        throw new Error(`Value must be a string`);
      }
      if (validation?.pattern && !new RegExp(validation.pattern).test(value)) {
        throw new Error(`Value does not match required pattern`);
      }
      if (validation?.options && !validation.options.includes(value)) {
        throw new Error(
          `Value must be one of: ${validation.options.join(", ")}`
        );
      }
      break;
    case "number":
      if (typeof value !== "number") {
        throw new Error(`Value must be a number`);
      }
      if (validation?.min !== undefined && value < validation.min) {
        throw new Error(`Value must be at least ${validation.min}`);
      }
      if (validation?.max !== undefined && value > validation.max) {
        throw new Error(`Value must be at most ${validation.max}`);
      }
      break;
    case "boolean":
      if (typeof value !== "boolean") {
        throw new Error(`Value must be a boolean`);
      }
      break;
    case "array":
      if (!Array.isArray(value)) {
        throw new Error(`Value must be an array`);
      }
      break;
    case "object":
      if (typeof value !== "object" || Array.isArray(value)) {
        throw new Error(`Value must be an object`);
      }
      break;
  }
};

// Method để reset về default value
systemSettingsSchema.methods.resetToDefault = function (userId) {
  this.value = this.defaultValue;
  this.lastModifiedBy = userId;
  this.lastModifiedAt = new Date();
  return this.save();
};

module.exports = mongoose.model("SystemSettings", systemSettingsSchema);
