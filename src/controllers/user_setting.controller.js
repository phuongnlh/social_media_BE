// const mongoose = require("mongoose");
// const defaultSettings = require("../utils/defaultSettings");

// // Định nghĩa schema cho UserSetting
// const userSettingSchema = new mongoose.Schema(
//   {
//     user_id: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: true,
//     },
//     key: {
//       type: String,
//       required: true,
//     },
//     value: {
//       type: mongoose.Schema.Types.Mixed,
//       required: true,
//     },
//     privacy_level: {
//       type: String,
//       enum: ["private", "friends", "public"],
//       default: "private",
//     },
//     custom_group: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "Group",
//       default: null,
//     },
//   },
//   { timestamps: true }
// );

// // Chỉ mục hỗn hợp để tìm kiếm nhanh hơn
// userSettingSchema.index({ user_id: 1, key: 1 }, { unique: true });

// const UserSetting = mongoose.model("UserSetting", userSettingSchema);

// // Lấy 1 setting theo key
// const getUserSettingByKey = async (req, res) => {
//   try {
//     const userId = req.params.userId;
//     const key = req.params.key;
//     const setting = await UserSetting.findOne({ user_id: userId, key });
//     if (!setting) {
//       return res.status(404).json({ error: "Không tìm thấy cài đặt" });
//     }
//     res.json(setting);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

// const getUserSettings = async (req, res) => {
//   try {
//     const userId = req.params.userId;
//     const userSettings = await UserSetting.find({ user_id: userId });
//     res.json(userSettings);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

// const updateUserSetting = async (req, res) => {
//   try {
//     const { key, value, privacy_level, custom_group } = req.body;
//     const userId = req.params.userId;

//     // Kiểm tra key có trong default không
//     if (!defaultSettings[key]) {
//       return res.status(400).json({ error: "Cài đặt không hợp lệ" });
//     }

//     // Tìm setting của user, nếu chưa có thì tạo mới từ default
//     let setting = await UserSetting.findOne({ user_id: userId, key });
//     if (!setting) {
//       setting = new UserSetting({
//         user_id: userId,
//         key,
//         value: defaultSettings[key].value,
//         privacy_level: defaultSettings[key].privacy_level || "private",
//         custom_group: null,
//       });
//     }

//     if (value !== undefined) setting.value = value;
//     if (privacy_level !== undefined) setting.privacy_level = privacy_level;
//     if (custom_group !== undefined) setting.custom_group = custom_group;

//     await setting.save();
//     res.json(setting);
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

// // Thêm vào user_setting.controller.js
// const initializeUserSettings = async (req, res) => {
//   try {
//     const userId = req.params.userId;

//     // Kiểm tra xem người dùng đã có cài đặt chưa
//     const existingSettings = await UserSetting.find({ user_id: userId });
//     if (existingSettings.length > 0) {
//       return res
//         .status(400)
//         .json({ error: "Cài đặt người dùng đã được khởi tạo" });
//     }

//     // Tạo cài đặt dựa trên mặc định
//     const settingsToCreate = Object.entries(defaultSettings).map(
//       ([key, config]) => ({
//         user_id: userId,
//         key,
//         value: config.value,
//         privacy_level: config.privacy_level,
//         custom_group: null,
//       })
//     );

//     await UserSetting.insertMany(settingsToCreate);

//     res.status(201).json({
//       message: "Cài đặt người dùng đã được khởi tạo thành công",
//       settings: settingsToCreate,
//     });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// };

// // Thêm vào module.exports
// module.exports = {
//   getUserSettings,
//   getUserSettingByKey,
//   updateUserSetting,
//   initializeUserSettings,
// };
