const express = require("express");
const router = express.Router();
const {upload} = require("../utils/upload_utils");
const passport = require("passport");
const postController = require("../controllers/post.controller");
const { isLogin } = require("../middlewares/auth");

//* Post reactions
router.post("/reaction", isLogin, postController.reactToPost);
router.delete("/reaction", isLogin, postController.removeReaction);
router.get("/reactions/:post_id", postController.getReactionsOfPost);
router.post("/user-reactions", isLogin, postController.getUserReactionsForPosts);

router.get("/trash", isLogin, postController.getTrashedPosts);
router.post("/share", isLogin, postController.sharePost);
router.post("/", isLogin, upload.array("media", 10), postController.createPost);
router.get("/", isLogin, postController.getAllPostsbyUser);

router.get("/:id", isLogin, postController.getPostById);
router.put("/:id", isLogin, postController.updatePost);
router.delete("/:id", isLogin, postController.softDeletePost);
router.patch("/:id/restore", isLogin, postController.restorePost);

module.exports = router;
