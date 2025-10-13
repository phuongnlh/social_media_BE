const { body, param, query } = require("express-validator");
export const validateListQuery = [
  query("page")
    .optional()
    .isInt({ min: 1 })
    .withMessage("Page must be a positive integer"),

  query("limit")
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage("Limit must be between 1 and 100"),

  query("status")
    .optional()
    .isIn(["pending", "investigating", "resolved", "dismissed", "escalated"])
    .withMessage("Invalid status filter"),

  query("reportType")
    .optional()
    .isIn([
      "spam",
      "harassment",
      "inappropriate_content",
      "fake_news",
      "copyright",
      "violence",
      "hate_speech",
      "nudity",
      "terrorism",
      "self_harm",
      "scam",
      "impersonation",
      "other",
    ])
    .withMessage("Invalid report type filter"),

  query("priority")
    .optional()
    .isIn(["low", "medium", "high", "urgent"])
    .withMessage("Invalid priority filter"),

  query("assignedTo")
    .optional()
    .isMongoId()
    .withMessage("Invalid admin ID format"),

  query("sortBy")
    .optional()
    .isIn(["createdAt", "updatedAt", "priority", "status"])
    .withMessage("Invalid sort field"),

  query("sortOrder")
    .optional()
    .isIn(["asc", "desc"])
    .withMessage("Invalid sort order"),

  query("timeframe")
    .optional()
    .matches(/^\d+d$/)
    .withMessage("Invalid timeframe format (use format like '30d')"),
];

// Validation middleware cho tạo báo cáo
export const validateCreateReport = [
  body("reportedPost").isMongoId().withMessage("Invalid post ID format"),

  body("reportType")
    .isIn([
      "spam",
      "harassment",
      "inappropriate_content",
      "fake_news",
      "copyright",
      "violence",
      "hate_speech",
      "nudity",
      "terrorism",
      "self_harm",
      "scam",
      "impersonation",
      "other",
    ])
    .withMessage("Invalid report type"),

  body("description")
    .isLength({ min: 10, max: 1000 })
    .withMessage("Description must be between 10 and 1000 characters"),

  body("reason")
    .isLength({ min: 5, max: 200 })
    .withMessage("Reason must be between 5 and 200 characters"),

  body("evidence")
    .optional()
    .isArray()
    .withMessage("Evidence must be an array"),

  body("evidence.*.type")
    .optional()
    .isIn(["image", "video", "screenshot", "link", "document"])
    .withMessage("Invalid evidence type"),

  body("evidence.*.url").optional().isURL().withMessage("Invalid evidence URL"),
];

// Validation cho cập nhật trạng thái
export const validateUpdateStatus = [
  param("id").isMongoId().withMessage("Invalid report ID format"),

  body("status")
    .optional()
    .isIn(["pending", "investigating", "resolved", "dismissed", "escalated"])
    .withMessage("Invalid status"),

  body("priority")
    .optional()
    .isIn(["low", "medium", "high", "urgent"])
    .withMessage("Invalid priority"),

  body("actionTaken")
    .optional()
    .isIn([
      "none",
      "warning_sent",
      "content_removed",
      "user_suspended",
      "user_banned",
      "content_hidden",
      "age_restricted",
      "education_sent",
    ])
    .withMessage("Invalid action taken"),
];

// Validation cho gán admin
export const validateAssignReport = [
  param("id").isMongoId().withMessage("Invalid report ID format"),

  body("adminId").isMongoId().withMessage("Invalid admin ID format"),
];

// Validation cho thêm ghi chú
export const validateAddNote = [
  param("id").isMongoId().withMessage("Invalid report ID format"),

  body("note")
    .isLength({ min: 1, max: 500 })
    .withMessage("Note must be between 1 and 500 characters"),
];

// Validation cho giải quyết báo cáo
export const validateResolveReport = [
  param("id").isMongoId().withMessage("Invalid report ID format"),

  body("resolution")
    .isLength({ min: 10, max: 500 })
    .withMessage("Resolution must be between 10 and 500 characters"),

  body("actionTaken")
    .optional()
    .isIn([
      "none",
      "warning_sent",
      "content_removed",
      "user_suspended",
      "user_banned",
      "content_hidden",
      "age_restricted",
      "education_sent",
    ])
    .withMessage("Invalid action taken"),
];

// Validation cho bulk update
export const validateBulkUpdate = [
  body("reportIds")
    .isArray({ min: 1 })
    .withMessage("Report IDs must be a non-empty array"),

  body("reportIds.*").isMongoId().withMessage("Invalid report ID format"),

  body("updates").isObject().withMessage("Updates must be an object"),

  body("updates.status")
    .optional()
    .isIn(["pending", "investigating", "resolved", "dismissed", "escalated"])
    .withMessage("Invalid status"),

  body("updates.priority")
    .optional()
    .isIn(["low", "medium", "high", "urgent"])
    .withMessage("Invalid priority"),

  body("updates.assignedTo")
    .optional()
    .isMongoId()
    .withMessage("Invalid admin ID format"),
];
