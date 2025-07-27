const express = require("express");
const router = express.Router();
const friendController = require("../controllers/friend.controller");
const followController = require("../controllers/follow.controller");
const { isLogin } = require("../middlewares/auth");

router.post("/friend-request", isLogin, friendController.sendFriendRequest);
router.patch(
  "/friend-request/:friendshipId",
  isLogin,
  friendController.respondFriendRequest
);

router.post("/follow", isLogin, followController.followUser);
router.delete("/unfollow", isLogin, followController.unfollowUser);

router.get("/friends", isLogin, friendController.getFriendsList);
router.get(
  "/friend-requests/incoming",
  isLogin,
  friendController.getIncomingFriendRequests
);
router.delete("/friend-request/withdraw", isLogin, friendController.withdrawFriendRequest);
router.get("/followers", isLogin, followController.getFollowers);
router.get("/followings", isLogin, followController.getFollowings);

router.get("/unfriended-users", isLogin, friendController.getUnfriendedUsers);

module.exports = router;
