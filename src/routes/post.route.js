const express = require("express");
const router = express.Router();
const passport = require("passport");
const postController = require("../controllers/post.controller");
const { isLogin } = require("../middlewares/auth");
const { attachLocation } = require("../middlewares/location");

//* Post reactions
router.post("/reaction", isLogin, postController.reactToPost);
router.get("/reactions/:post_id", postController.getReactionsOfPost);
router.post(
  "/user-reactions",
  isLogin,
  postController.getUserReactionsForPosts
);
router.get("/search", isLogin, postController.searchPost);

router.get("/trash", isLogin, postController.getTrashedPosts);
router.post("/share", isLogin, postController.sharePost);
router.post("/", isLogin, postController.createPost);
router.get("/", isLogin, postController.getAllPostsbyUser);
router.get("/user/:userId", isLogin, postController.getAllPostsbyUserId);
router.get(
  "/recommend",
  isLogin,
  attachLocation,
  postController.getRecommendPost
);
router.get("/:id", isLogin, postController.getPostById);
router.put("/:id", isLogin, postController.updatePost);
router.delete("/:id", isLogin, postController.softDeletePost);
router.patch("/:id/restore", isLogin, postController.restorePost);

router.patch("/:id/view", postController.increaseViewCount);

module.exports = router;
