const SystemSettings = require("../models/systemSettings.model");
const { validationResult } = require("express-validator");

class SystemSettingsController {
  // Lấy tất cả settings hoặc theo category
  static async getSettings(req, res) {
    try {
      const { category } = req.query;

      let settings;
      if (category) {
        settings = await SystemSettings.getByCategory(category);
      } else {
        settings = await SystemSettings.getAllSettings();
      }

      // Group settings by category for easier frontend handling
      const groupedSettings = settings.reduce((acc, setting) => {
        if (!acc[setting.category]) {
          acc[setting.category] = {};
        }
        acc[setting.category][setting.key] = {
          value: setting.value,
          dataType: setting.dataType,
          description: setting.description,
          isEditable: setting.isEditable,
          validation: setting.validation,
          lastModifiedAt: setting.lastModifiedAt,
          lastModifiedBy: setting.lastModifiedBy,
        };
        return acc;
      }, {});

      res.json({
        success: true,
        data: category ? groupedSettings[category] : groupedSettings,
        message: "Settings retrieved successfully",
      });
    } catch (error) {
      console.error("Get settings error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve settings",
        error: error.message,
      });
    }
  }

  // Cập nhật multiple settings
  static async updateSettings(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation errors",
          errors: errors.array(),
        });
      }

      const { settings } = req.body;
      const userId = req.user.id;
      const updatedSettings = [];
      const failedUpdates = [];

      // Process each setting update
      for (const [category, categorySettings] of Object.entries(settings)) {
        for (const [key, value] of Object.entries(categorySettings)) {
          try {
            const updatedSetting = await SystemSettings.updateSetting(
              category,
              key,
              value,
              userId
            );
            updatedSettings.push({
              category,
              key,
              value: updatedSetting.value,
              success: true,
            });
          } catch (error) {
            failedUpdates.push({
              category,
              key,
              error: error.message,
              success: false,
            });
          }
        }
      }

      // Determine response status
      const hasFailures = failedUpdates.length > 0;
      const hasSuccesses = updatedSettings.length > 0;

      let status = 200;
      let message = "All settings updated successfully";

      if (hasFailures && !hasSuccesses) {
        status = 400;
        message = "Failed to update settings";
      } else if (hasFailures && hasSuccesses) {
        status = 207; // Multi-status
        message = "Some settings updated successfully";
      }

      res.status(status).json({
        success: !hasFailures,
        message,
        data: {
          updated: updatedSettings,
          failed: failedUpdates,
          summary: {
            total: updatedSettings.length + failedUpdates.length,
            successful: updatedSettings.length,
            failed: failedUpdates.length,
          },
        },
      });
    } catch (error) {
      console.error("Update settings error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update settings",
        error: error.message,
      });
    }
  }

  // Cập nhật single setting
  static async updateSingleSetting(req, res) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: "Validation errors",
          errors: errors.array(),
        });
      }

      const { category, key } = req.params;
      const { value } = req.body;
      const userId = req.user.id;

      const updatedSetting = await SystemSettings.updateSetting(
        category,
        key,
        value,
        userId
      );

      res.json({
        success: true,
        data: {
          category,
          key,
          value: updatedSetting.value,
          lastModifiedAt: updatedSetting.lastModifiedAt,
        },
        message: "Setting updated successfully",
      });
    } catch (error) {
      console.error("Update single setting error:", error);
      const status = error.message.includes("not found")
        ? 404
        : error.message.includes("not editable")
        ? 403
        : 500;

      res.status(status).json({
        success: false,
        message: error.message,
        error: error.message,
      });
    }
  }

  // Reset settings về default
  static async resetSettings(req, res) {
    try {
      const { category, keys } = req.body;
      const userId = req.user.id;
      const resetSettings = [];
      const failedResets = [];

      let settingsToReset;
      if (category && keys) {
        // Reset specific keys in a category
        settingsToReset = await SystemSettings.find({
          category,
          key: { $in: keys },
        });
      } else if (category) {
        // Reset entire category
        settingsToReset = await SystemSettings.find({ category });
      } else {
        // Reset all settings
        settingsToReset = await SystemSettings.find({});
      }

      for (const setting of settingsToReset) {
        try {
          await setting.resetToDefault(userId);
          resetSettings.push({
            category: setting.category,
            key: setting.key,
            value: setting.value,
            success: true,
          });
        } catch (error) {
          failedResets.push({
            category: setting.category,
            key: setting.key,
            error: error.message,
            success: false,
          });
        }
      }

      res.json({
        success: failedResets.length === 0,
        message:
          failedResets.length === 0
            ? "Settings reset successfully"
            : "Some settings failed to reset",
        data: {
          reset: resetSettings,
          failed: failedResets,
          summary: {
            total: resetSettings.length + failedResets.length,
            successful: resetSettings.length,
            failed: failedResets.length,
          },
        },
      });
    } catch (error) {
      console.error("Reset settings error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to reset settings",
        error: error.message,
      });
    }
  }

  // Lấy system info (không thể edit)
  static async getSystemInfo(req, res) {
    try {
      // Collect system information
      const systemInfo = {
        server: {
          status: "online",
          uptime: process.uptime(),
          nodeVersion: process.version,
          platform: process.platform,
          memory: process.memoryUsage(),
          env: process.env.NODE_ENV || "development",
        },
        database: {
          status: "connected", // You might want to actually check DB connection
          host: process.env.DB_HOST || "localhost",
        },
        api: {
          version: process.env.API_VERSION || "v1",
          rateLimit: await SystemSettings.getSettingValue("api", "rateLimit"),
        },
        features: {
          userRegistration: await SystemSettings.getSettingValue(
            "features",
            "userRegistration"
          ),
          liveStreaming: await SystemSettings.getSettingValue(
            "features",
            "liveStreaming"
          ),
          marketplace: await SystemSettings.getSettingValue(
            "features",
            "marketplaceFeature"
          ),
        },
        security: {
          twoFactorAuth: await SystemSettings.getSettingValue(
            "security",
            "twoFactorAuth"
          ),
          sessionTimeout: await SystemSettings.getSettingValue(
            "security",
            "sessionTimeout"
          ),
        },
      };

      res.json({
        success: true,
        data: systemInfo,
        message: "System information retrieved successfully",
      });
    } catch (error) {
      console.error("Get system info error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to retrieve system information",
        error: error.message,
      });
    }
  }

  // Validate setting value before update
  static async validateSetting(req, res) {
    try {
      const { category, key } = req.params;
      const { value } = req.body;

      const setting = await SystemSettings.findOne({ category, key });
      if (!setting) {
        return res.status(404).json({
          success: false,
          message: "Setting not found",
        });
      }

      try {
        SystemSettings.validateValue(setting, value);
        res.json({
          success: true,
          message: "Value is valid",
          data: { valid: true },
        });
      } catch (error) {
        res.status(400).json({
          success: false,
          message: error.message,
          data: { valid: false },
        });
      }
    } catch (error) {
      console.error("Validate setting error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to validate setting",
        error: error.message,
      });
    }
  }
}

module.exports = SystemSettingsController;
