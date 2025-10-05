const express = require("express");
const router = express.Router();
const { upload } = require("../utils/upload_utils");
const { isLogin } = require("../middlewares/auth");
const Story = require("../controllers/story.controller");

router.post("/:id/reactions", isLogin, Story.reactStory);
router.post("/:id/views", isLogin, Story.viewStory);
router.get("/:id/views", isLogin, Story.getViews);
router.get("/:id", isLogin, Story.getStoryById);
router.delete("/:id", isLogin, Story.deleteStory);
router.get("/", isLogin, Story.getStories);
router.post(
  "/",
  isLogin,
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "video", maxCount: 1 },
  ]),
  Story.createStory
);

module.exports = router;
