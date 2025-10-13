const postModel = require("../../models/post.model");
const User = require("../../models/user.model");
const storyModel = require("../../models/Story/story.model");
const Comment = require("../../models/Comment_Reaction/comment.model");
const postMediaModel = require("../../models/postMedia.model");
const commentModel = require("../../models/Comment_Reaction/comment.model");
const post_reactionModel = require("../../models/Comment_Reaction/post_reaction.model");
const getAnalytics = async (req, res) => {
  const totalUsers = await User.countDocuments({ role: "user" });
  const totalPosts = await postModel.countDocuments();
  const totalComments = await Comment.countDocuments();
  const totalViews = await postModel.aggregate([
    {
      $group: {
        _id: null,
        totalViews: { $sum: "$viewCount" },
      },
    },
  ]);

  res.status(200).json({
    totalUsers,
    totalPosts,
    totalComments,
    totalViews: totalViews[0]?.totalViews || 0,
  });
};

const getPostStats = async (req, res) => {
  try {
    // 1. Đếm text posts (post không có media)
    const textPostsCount = await postModel.aggregate([
      {
        $lookup: {
          from: "postmedias",
          localField: "_id",
          foreignField: "post_id",
          as: "media",
        },
      },
      {
        $match: { "media.0": { $exists: false }, is_deleted: false },
      },
      {
        $count: "count",
      },
    ]);

    // 2. Đếm image posts
    const imagePostsCount = await postMediaModel.aggregate([
      {
        $lookup: {
          from: "media", // bảng chứa file thực tế
          localField: "media_id",
          foreignField: "_id",
          as: "media",
        },
      },
      { $unwind: "$media" },
      { $match: { "media.media_type": "image" } },
      {
        $group: { _id: "$post_id" }, // gom để tránh đếm trùng
      },
      { $count: "count" },
    ]);

    // 3. Đếm video posts
    const videoPostsCount = await postMediaModel.aggregate([
      {
        $lookup: {
          from: "media",
          localField: "media_id",
          foreignField: "_id",
          as: "media",
        },
      },
      { $unwind: "$media" },
      { $match: { "media.media_type": "video" } },
      {
        $group: { _id: "$post_id" },
      },
      { $count: "count" },
    ]);

    // 4. Đếm stories
    const storiesCount = await storyModel.countDocuments();

    // Chuẩn hóa về mảng dữ liệu
    const data = [
      {
        name: "Text Posts",
        value: textPostsCount[0]?.count || 0,
        color: "#8B5CF6",
      },
      {
        name: "Images",
        value: imagePostsCount[0]?.count || 0,
        color: "#06B6D4",
      },
      {
        name: "Videos",
        value: videoPostsCount[0]?.count || 0,
        color: "#10B981",
      },
      {
        name: "Stories",
        value: storiesCount,
        color: "#F59E0B",
      },
    ];

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getUserGrowth = async (req, res) => {
  try {
    const now = new Date();

    // Lấy 6 tháng gần nhất (kể cả tháng hiện tại)
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
      return {
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        label: d.toLocaleString("en-US", { month: "short" }),
      };
    });

    // Lấy user theo createdAt
    const users = await User.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(months[0].year, months[0].month - 1, 1),
            $lte: now,
          },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
          },
          newUsers: { $sum: 1 },
        },
      },
    ]);

    // Map lại dữ liệu
    let total = 0;
    const result = months.map((m) => {
      const found = users.find(
        (u) => u._id.year === m.year && u._id.month === m.month
      );
      const newUsers = found ? found.newUsers : 0;
      total += newUsers;
      return {
        month: m.label,
        users: total,
        newUsers,
      };
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getDailyInteractions = async (req, res) => {
  try {
    // Tính khoảng thời gian 7 ngày gần nhất
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 6); // lùi 6 ngày

    // Reactions (đếm tất cả, không lọc type)
    const reactions = await post_reactionModel.aggregate([
      {
        $match: {
          createdAt: { $gte: startOfWeek, $lte: now },
        },
      },
      {
        $group: {
          _id: { $dayOfWeek: "$createdAt" }, // 1=Sun, 2=Mon, ...
          count: { $sum: 1 },
        },
      },
    ]);

    // Comments
    const comments = await commentModel.aggregate([
      {
        $match: {
          is_deleted: false,
          createdAt: { $gte: startOfWeek, $lte: now },
        },
      },
      {
        $group: {
          _id: { $dayOfWeek: "$createdAt" },
          count: { $sum: 1 },
        },
      },
    ]);

    // Shares (post có shared_post_id)
    const shares = await postModel.aggregate([
      {
        $match: {
          shared_post_id: { $ne: null },
          createdAt: { $gte: startOfWeek, $lte: now },
        },
      },
      {
        $group: {
          _id: { $dayOfWeek: "$createdAt" },
          count: { $sum: 1 },
        },
      },
    ]);

    // Map dữ liệu ra đủ 7 ngày
    const daysMap = {
      1: "Sun",
      2: "Mon",
      3: "Tue",
      4: "Wed",
      5: "Thu",
      6: "Fri",
      7: "Sat",
    };

    const result = [];
    for (let i = 1; i <= 7; i++) {
      result.push({
        day: daysMap[i],
        reactions: reactions.find((x) => x._id === i)?.count || 0,
        comments: comments.find((x) => x._id === i)?.count || 0,
        shares: shares.find((x) => x._id === i)?.count || 0,
      });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};



module.exports = {
  getAnalytics,
  getPostStats,
  getUserGrowth,
  getDailyInteractions,
};
