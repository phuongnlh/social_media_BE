const storyModel = require("../models/story.model");

const createStory = async (req, res) => {
  try {
    const userId = req.user._id;
    const { storyText, backgroundColor, textColor, privacy } = req.body;

    const newStory = new storyModel({
      userId,
      storyText,
      backgroundColor,
      textColor,
      privacy,
      imageUrl: req.files?.image
        ? req.files.image[0].path
        : null,
      videoUrl: req.files?.video
        ? req.files.video[0].path
        : null,
    });

    await newStory.save();
    res.status(201).json({ success: true, story: newStory });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

const getStories = async (req, res) => {
  try {
    const stories = await storyModel
      .find()
      .sort({ createdAt: -1 })
      .populate("userId", "fullName avatar_url");
    res.json(stories);
  } catch (error) {
    res.status(500).json({ success: false, error: "Server error" });
  }
};

module.exports = { createStory, getStories };
