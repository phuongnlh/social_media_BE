const express = require("express");
const router = express.Router();
const { isLogin } = require("../middlewares/auth");
const channelController = require("../controllers/channel.controller");

// Channel Management Routes
router.post("/private", isLogin, channelController.createPrivateChannel);
router.post("/group", isLogin, channelController.createGroupChannel);
router.get("/", isLogin, channelController.getUserChannels);
router.get("/:channelId", isLogin, channelController.getChannelDetails);

// Group Channel Management
router.put("/:channelId/name", isLogin, channelController.updateGroupName);
router.put("/:channelId/avatar", isLogin, channelController.updateGroupAvatar);
router.post("/:channelId/members", isLogin, channelController.addMemberToGroup);
router.delete(
  "/:channelId/members/:memberId",
  isLogin,
  channelController.removeMemberFromGroup
);
router.post("/:channelId/leave", isLogin, channelController.leaveGroupChannel);
router.put(
  "/:channelId/members/:memberId/role",
  isLogin,
  channelController.changeMemberRole
);
router.delete("/:channelId", isLogin, channelController.deleteGroupChannel);

module.exports = router;
