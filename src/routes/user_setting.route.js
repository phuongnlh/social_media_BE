const express = require('express');
const router = express.Router();
const userSettingController = require('../controllers/user_setting.controller');
const { isLogin } = require('../middlewares/auth');

// Bảo mật tất cả các route cài đặt
router.use(isLogin);

router.get('/:userId', userSettingController.getUserSettings);
router.get('/:userId/:key', userSettingController.getUserSettingByKey);
router.put('/:userId', userSettingController.updateUserSetting);
// router.post('/initialize/:userId', userSettingController.initializeUserSettings);
// router.post('/reset/:userId', userSettingController.PrivacySetting);

module.exports = router;