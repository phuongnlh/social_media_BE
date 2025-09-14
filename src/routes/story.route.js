const express = require("express");
const router = express.Router();
const { upload } = require("../utils/upload_utils");
const { isLogin } = require("../middlewares/auth");
const { getStories, createStory } = require("../controllers/story.controller");

router.post(
  "/",
  isLogin,
  upload.fields([
    { name: "image", maxCount: 1 },
    { name: "video", maxCount: 1 },
  ]),
  createStory
);
router.get("/", isLogin, getStories);

module.exports = router;
