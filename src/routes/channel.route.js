const express = require("express");
const router = express.Router();
const { isLogin } = require("../middlewares/auth");
const channelController = require("../controllers/channel.controller");

// Get all channels
router.get("/all", isLogin, channelController.getChannelChatList);

// Channel Management Routes
router.post("/private", isLogin, channelController.createPrivateChannel);
router.post("/group", isLogin, channelController.createGroupChannel);
router.get("/online-status", isLogin, channelController.getUserOnlineStatus);
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
// Unread Count Management (put specific routes first)
router.get("/unread/all", isLogin, channelController.getAllChannelsUnreadCount);

// Get messages in a channel
router.get(
  "/:channelId/messages",
  isLogin,
  channelController.getChannelMessages
);

// More specific unread routes
router.get(
  "/:channelId/unread",
  isLogin,
  channelController.getChannelUnreadCount
);
router.post(
  "/:channelId/mark-read",
  isLogin,
  channelController.markChannelAsRead
);

router.put("/:channelId/mute", isLogin, channelController.muteGroupChat);
router.put("/:channelId/delete", isLogin, channelController.deleteChat);
router.put("/:channelId/restore", isLogin, channelController.restoreChat);
router.get(
  "/get-channel/:userId",
  isLogin,
  channelController.getChannelByUserId
);

module.exports = router;
