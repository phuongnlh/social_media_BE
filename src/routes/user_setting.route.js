const express = require('express');
const router = express.Router();
const userSettingController = require('../controllers/user_setting.controller');

router.get('/:userId', userSettingController.getUserSettings);
router.get('/:userId/:key', userSettingController.getUserSettingByKey);
router.put('/:userId', userSettingController.updateUserSetting);

module.exports = router;