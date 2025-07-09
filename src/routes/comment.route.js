const express = require("express");
const router = express.Router();
const passport = require("passport");
const interactController = require("../controllers/comment.controller");
const { isLogin } = require("../middlewares/auth");

// Reactions of Comment
router.post("/reaction", isLogin, interactController.reactToComment);
router.delete("/reaction", isLogin, interactController.removeCommentReaction);
router.get("/reactions/:comment_id", interactController.getReactionsOfComment);
router.post("/user-reactions", isLogin, interactController.getUserReactionsForComments);

// Comments of Post
router.put("/restore/:comment_id", isLogin, interactController.restoreComment);
router.post("/", isLogin, interactController.createComment);
router.get("/:post_id", interactController.getCommentsOfPost);
router.put("/:comment_id", isLogin, interactController.editComment);
router.delete("/:comment_id", isLogin, interactController.softDeleteComment);

module.exports = router;
