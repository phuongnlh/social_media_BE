const express = require("express");
const router = express.Router();
const friendController = require("../controllers/friend.controller");
const { getFriendshipStatus } = require("../controllers/friend.controller");
const { isLogin } = require("../middlewares/auth");

router.post("/friend-request", isLogin, friendController.sendFriendRequest);
router.post("/unfriend", isLogin, friendController.cancelFriendRequest);
router.patch(
  "/friend-request/:friendshipId",
  isLogin,
  friendController.respondFriendRequest
);

router.get("/friends/search", isLogin, friendController.searchFriends);
router.get("/friends/search/my-friends", isLogin, friendController.searchMyFriends);
router.get("/friends/:userId", isLogin, friendController.getFriendsList);
router.get(
  "/friend-requests/incoming",
  isLogin,
  friendController.getIncomingFriendRequests
);
router.delete(
  "/friend-request/withdraw",
  isLogin,
  friendController.withdrawFriendRequest
);

router.get("/friends/count/:userId", isLogin, friendController.countFriends);

router.get("/unfriended-users", isLogin, friendController.getUnfriendedUsers);
router.get("/friendship/status/:profileUserId", isLogin, friendController.getFriendshipStatus);

module.exports = router;
