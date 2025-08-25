const express = require("express");
const router = express.Router();
const passport = require("passport");
const { upload } = require("../utils/upload_utils");
const interactController = require("../controllers/comment.controller");
const { isLogin } = require("../middlewares/auth");

// Reactions of Comment
router.post("/reaction", isLogin, interactController.reactToComment);
router.delete("/reaction", isLogin, interactController.removeCommentReaction);
router.get("/reactions/:comment_id", interactController.getReactionsOfComment);
router.post("/user-reactions", isLogin, interactController.getUserReactionsForComments);


// Comments of Post
router.put("/restore/:comment_id", isLogin, interactController.restoreComment);
router.get("/count/:postgr_id", isLogin, interactController.getGroupPostCommentCount);
router.get("/group-post/:postgr_id", interactController.getCommentsOfPost);
router.post("/", isLogin, upload.array("media", 1), interactController.createComment);
router.get("/:post_id", interactController.getCommentsOfPost);
router.put("/:comment_id", isLogin, interactController.editComment);
router.delete("/:comment_id", isLogin, interactController.softDeleteComment);
// Count comments of a post
router.get("/count/:post_id", isLogin, interactController.countCommentsOfPost);

module.exports = router;
