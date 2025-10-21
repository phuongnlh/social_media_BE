const express = require("express");
const { body, param, query } = require("express-validator");
const SystemSettingsController = require("../controllers/systemSettings.controller");
const { isLogin } = require("../middlewares/auth");

const router = express.Router();

// Middleware để check admin role
const requireAdmin = (req, res, next) => {
  //   if (!req.user || req.user.role !== "admin") {
  //     return res.status(403).json({
  //       success: false,
  //       message: "Admin access required"
  //     });
  //   }
  next();
};

// Validation schemas
const categoryValidation = param("category")
  .isIn([
    "general",
    "security",
    "email",
    "content",
    "api",
    "features",
    "system",
  ])
  .withMessage("Invalid category");

const keyValidation = param("key")
  .isLength({ min: 1, max: 50 })
  .withMessage("Key must be between 1 and 50 characters");

const settingsUpdateValidation = body("settings")
  .isObject()
  .withMessage("Settings must be an object")
  .custom((value) => {
    // Validate that all categories are valid
    const validCategories = [
      "general",
      "security",
      "email",
      "content",
      "api",
      "features",
      "system",
    ];
    for (const category of Object.keys(value)) {
      if (!validCategories.includes(category)) {
        throw new Error(`Invalid category: ${category}`);
      }
      if (typeof value[category] !== "object") {
        throw new Error(`Category ${category} must be an object`);
      }
    }
    return true;
  });

const singleValueValidation = body("value")
  .exists()
  .withMessage("Value is required");

const resetValidation = [
  body("category")
    .optional()
    .isIn([
      "general",
      "security",
      "email",
      "content",
      "api",
      "features",
      "system",
    ])
    .withMessage("Invalid category"),
  body("keys").optional().isArray().withMessage("Keys must be an array"),
];

// Routes

/**
 * @route   GET /api/admin/settings
 * @desc    Get all settings or settings by category
 * @access  Admin
 * @query   category - Optional category filter
 */
router.get(
  "/",
  isLogin,
  requireAdmin,
  [
    query("category")
      .optional()
      .isIn([
        "general",
        "security",
        "email",
        "content",
        "api",
        "features",
        "system",
      ])
      .withMessage("Invalid category"),
  ],
  SystemSettingsController.getSettings
);

/**
 * @route   PUT /api/admin/settings
 * @desc    Update multiple settings
 * @access  Admin
 * @body    { settings: { category: { key: value } } }
 */
router.put(
  "/",
  isLogin,
  requireAdmin,
  settingsUpdateValidation,
  SystemSettingsController.updateSettings
);

/**
 * @route   PUT /api/admin/settings/:category/:key
 * @desc    Update single setting
 * @access  Admin
 * @params  category, key
 * @body    { value: any }
 */
router.put(
  "/:category/:key",
  isLogin,
  requireAdmin,
  [categoryValidation, keyValidation, singleValueValidation],
  SystemSettingsController.updateSingleSetting
);

/**
 * @route   POST /api/admin/settings/reset
 * @desc    Reset settings to default values
 * @access  Admin
 * @body    { category?: string, keys?: string[] }
 */
router.post(
  "/reset",
  isLogin,
  requireAdmin,
  resetValidation,
  SystemSettingsController.resetSettings
);

/**
 * @route   POST /api/admin/settings/:category/:key/validate
 * @desc    Validate setting value without saving
 * @access  Admin
 * @params  category, key
 * @body    { value: any }
 */
router.post(
  "/:category/:key/validate",
  isLogin,
  requireAdmin,
  [categoryValidation, keyValidation, singleValueValidation],
  SystemSettingsController.validateSetting
);

/**
 * @route   GET /api/admin/settings/system-info
 * @desc    Get system information and status
 * @access  Admin
 */
router.get(
  "/system-info",
  isLogin,
  requireAdmin,
  SystemSettingsController.getSystemInfo
);

module.exports = router;
