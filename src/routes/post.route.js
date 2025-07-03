const express = require("express");
const router = express.Router();
const upload = require("../utils/upload_utils");
const passport = require("passport");
const postController = require("../controllers/post.controller");
const { isLogin } = require("../middlewares/auth");

router.post("/", isLogin, upload.array("media", 10), postController.createPost);
router.get("/", isLogin, postController.getAllPostsbyUser);
router.get("/:id", postController.getPostById);
router.put("/:id", isLogin, postController.updatePost);
router.delete("/:id", isLogin, postController.softDeletePost);
router.patch("/:id/restore", isLogin, postController.restorePost);
router.get("/trash", isLogin, postController.getTrashedPosts);

module.exports = router;
