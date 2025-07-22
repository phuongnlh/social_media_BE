const defaultSettings = require("../utils/defaultSettings");
// Lấy 1 setting theo key
const getUserSettingByKey = async (req, res) => {
  try {
    const userId = req.params.userId;
    const key = req.params.key;
    const setting = await UserSetting.findOne({ user_id: userId, key });
    if (!setting) {
      return res.status(404).json({ error: 'Không tìm thấy cài đặt' });
    }
    res.json(setting);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};


const UserSetting = require("../models/user_settings.model");


const getUserSettings = async (req, res) => {
  try {
    const userId = req.params.userId;
    const userSettings = await UserSetting.find({ user_id: userId });
    res.json(userSettings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updateUserSetting = async (req, res) => {
  try {
    const { key, value, privacy_level, custom_group } = req.body;
    const userId = req.params.userId;

    // Kiểm tra key có trong default không
    if (!defaultSettings[key]) {
      return res.status(400).json({ error: "Cài đặt không hợp lệ" });
    }

    // Tìm setting của user, nếu chưa có thì tạo mới từ default
    let setting = await UserSetting.findOne({ user_id: userId, key });
    if (!setting) {
      setting = new UserSetting({
        user_id: userId,
        key,
        value: defaultSettings[key].value,
        privacy_level: defaultSettings[key].privacy_level || 'private',
        custom_group: null,
      });
    }

    if (value !== undefined) setting.value = value;
    if (privacy_level !== undefined) setting.privacy_level = privacy_level;
    if (custom_group !== undefined) setting.custom_group = custom_group;

    await setting.save();
    res.json(setting);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getUserSettings,
  getUserSettingByKey,
  updateUserSetting,
};
