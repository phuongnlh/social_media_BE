const friendshipModel = require("../models/friendship.model");
const storyModel = require("../models/Story/story.model");
const storyReactionModel = require("../models/Story/storyReaction.model");
const storyViewModel = require("../models/Story/storyView.model");
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
      imageUrl: req.files?.image ? req.files.image[0].path : null,
      videoUrl: req.files?.video ? req.files.video[0].path : null,
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
    const userId = req.user._id;
    // lấy thời gian 24h trước
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const friendships = await friendshipModel
      .find({
        $or: [{ user_id_1: userId }, { user_id_2: userId }],
        status: "accepted",
      })
      .lean();

    const friendIds = friendships.map((f) =>
      f.user_id_1.toString() === userId.toString() ? f.user_id_2 : f.user_id_1
    );
    friendIds.push(userId);
    // query story tạo trong vòng 24h
    const stories = await storyModel
      .find({ createdAt: { $gte: cutoff }, userId: { $in: friendIds } })
      .sort({ createdAt: 1 })
      .populate("userId", "fullName avatar_url");

    // gom nhóm theo userId
    const grouped = stories.reduce((acc, story) => {
      const userId = story.userId._id.toString();
      if (!acc[userId]) {
        acc[userId] = {
          user: {
            _id: story.userId._id,
            fullName: story.userId.fullName,
            avatar_url: story.userId.avatar_url,
          },
          stories: [],
        };
      }
      acc[userId].stories.push(story);
      return acc;
    }, {});

    res.status(200).json({ success: true, data: Object.values(grouped) });
  } catch (error) {
    res.status(500).json({ success: false, error: "Server error" });
  }
};

const getStoryById = async (req, res) => {
  try {
    const storyId = req.params.id;

    const story = await storyModel.findById(storyId).populate("userId");
    if (!story) {
      return res.status(404).json({ success: false, error: "Story not found" });
    }

    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const stories = await storyModel
      .find({ userId: story.userId._id, createdAt: { $gte: cutoff } })
      .sort({ createdAt: 1 })
      .populate("userId", "fullName avatar_url");

    const grouped = stories.reduce((acc, story) => {
      const userId = story.userId._id.toString();
      if (!acc[userId]) {
        acc[userId] = {
          user: {
            _id: story.userId._id,
            fullName: story.userId.fullName,
            avatar_url: story.userId.avatar_url,
          },
          stories: [],
        };
      }
      acc[userId].stories.push(story);
      return acc;
    }, {});
    res.status(200).json({ success: true, data: Object.values(grouped) });
  } catch (error) {
    res.status(500).json({ success: false, error: "Server error" });
  }
};

const reactStory = async (req, res) => {
  try {
    const story_id = req.params.id;
    let { type } = req.body;
    const user_id = req.user._id;

    const existingReaction = await storyReactionModel.findOne({
      user_id,
      story_id,
    });
    if (existingReaction) {
      // Nếu đã react rồi, cập nhật lại type
      existingReaction.type = type;
      await existingReaction.save();
      return res.status(200).json({ success: true, story: existingReaction });
    }

    if (!type) type = "like"; // Mặc định là "like" nếu không có type

    const reaction = await storyReactionModel.create({
      user_id,
      story_id,
      type,
    });
    res.status(201).json({ success: true, story: reaction });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

const viewStory = async (req, res) => {
  try {
    const story_id = req.params.id;
    const user_id = req.user._id;

    // Kiểm tra nếu đã xem rồi thì không thêm nữa
    const existingView = await storyViewModel.findOne({ user_id, story_id });
    if (existingView) {
      return res.status(200).json({ success: true });
    }
    const views = await storyViewModel.create({
      user_id,
      story_id,
    });
    res.status(201).json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};
const getViews = async (req, res) => {
  try {
    const storyId = req.params.id;

    // Lấy tất cả view và populate user
    const views = await storyViewModel
      .find({ story_id: storyId })
      .populate("user_id", "fullName avatar_url");

    // Thêm reaction cho từng view
    const viewsWithReactions = await Promise.all(
      views.map(async (view) => {
        const reaction = await storyReactionModel.findOne({
          user_id: view.user_id._id,
          story_id: storyId,
        });
        // Không mutate trực tiếp view, tốt nhất tạo object mới
        return {
          ...view.toObject(),
          reaction: reaction ? reaction.type : null,
        };
      })
    );

    res.status(200).json({ success: true, data: viewsWithReactions });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: "Server error" });
  }
};

const deleteStory = async (req, res) => {
  try {
    const storyId = req.params.id;
    const userId = req.user._id;
    const story = await storyModel.findOneAndDelete({ _id: storyId, userId });

    if (!story) {
      return res.status(404).json({ success: false, error: "Story not found" });
    }

    res
      .status(200)
      .json({ success: true, message: "Story deleted successfully" });
  } catch (error) {
    res.status(500).json({ success: false, error: "Server error" });
  }
};

module.exports = {
  createStory,
  getStories,
  getStoryById,
  reactStory,
  deleteStory,
  viewStory,
  getViews,
};
