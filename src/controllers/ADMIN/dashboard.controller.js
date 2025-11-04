const postModel = require("../../models/post.model");
const User = require("../../models/user.model");
const storyModel = require("../../models/Story/story.model");
const Comment = require("../../models/Comment_Reaction/comment.model");
const postMediaModel = require("../../models/postMedia.model");
const commentModel = require("../../models/Comment_Reaction/comment.model");
const post_reactionModel = require("../../models/Comment_Reaction/post_reaction.model");
const Payment = require("../../models/Payment_Ads/payment.model");
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
      const found = users.find((u) => u._id.year === m.year && u._id.month === m.month);
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
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - 6); // Lùi 6 ngày (7 ngày tính cả hôm nay)

    // --- Helper để format ngày (yyyy-mm-dd) ---
    const formatDate = (date) => {
      return date.toISOString().split("T")[0];
    };

    // --- Aggregate chung cho từng model ---
    const aggregateByDate = async (Model, match = {}) => {
      return await Model.aggregate([
        {
          $match: {
            ...match,
            createdAt: { $gte: startOfWeek, $lte: now },
          },
        },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
            },
            count: { $sum: 1 },
          },
        },
      ]);
    };

    // Reactions
    const reactions = await aggregateByDate(post_reactionModel);
    // Comments
    const comments = await aggregateByDate(commentModel, { is_deleted: false });
    // Shares
    const shares = await aggregateByDate(postModel, { shared_post_id: { $ne: null } });

    // --- Sinh danh sách 7 ngày gần nhất (từ hôm nay lùi về trước) ---
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      days.push(d);
    }

    // --- Map dữ liệu ra kết quả ---
    const result = days.map((d) => {
      const dateStr = formatDate(d);
      const dayLabel = d.toLocaleDateString("en-US", { weekday: "short" }); // Mon, Tue, Wed...

      return {
        day: dayLabel,
        reactions: reactions.find((x) => x._id === dateStr)?.count || 0,
        comments: comments.find((x) => x._id === dateStr)?.count || 0,
        shares: shares.find((x) => x._id === dateStr)?.count || 0,
      };
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};

const getPaymentAnalytics = async (req, res) => {
  try {
    const { period = '30' } = req.query; // 7, 30, 90 days
    const days = parseInt(period);
    
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(now.getDate() - (days - 1));
    startDate.setHours(0, 0, 0, 0);

    // Helper để format ngày
    const formatDate = (date) => {
      return date.toISOString().split("T")[0];
    };

    // Helper để convert amount về đơn vị chuẩn
    const convertAmount = (amount, currency) => {
      if (currency === 'USD') {
        return amount / 100;
      }
      return amount;
    };

    // Aggregate payments: chỉ lấy status = 'paid'
    const payments = await Payment.aggregate([
      {
        $match: {
          created_at: { $gte: startDate, $lte: now },
          status: "paid",
        },
      },
      {
        $group: {
          _id: {
            date: {
              $dateToString: { format: "%Y-%m-%d", date: "$created_at" },
            },
            currency: "$currency",
          },
          totalAmount: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
    ]);

    // Sinh danh sách ngày theo period
    const daysList = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(now.getDate() - i);
      daysList.push(d);
    }

    // Map dữ liệu ra kết quả
    const result = daysList.map((d) => {
      const dateStr = formatDate(d);
      const dayLabel = d.toLocaleDateString("en-US", { 
        month: "short", 
        day: "numeric" 
      });

      const dayData = payments.filter((p) => p._id.date === dateStr);

      let vndRevenue = 0;
      let usdRevenue = 0;
      let totalTransactions = 0;

      dayData.forEach((item) => {
        const currency = item._id.currency || 'VND';
        const convertedAmount = convertAmount(item.totalAmount, currency);

        if (currency === 'USD') {
          usdRevenue += convertedAmount;
        } else {
          vndRevenue += convertedAmount;
        }
        totalTransactions += item.count;
      });

      return {
        day: dayLabel,
        date: dateStr,
        vnd: Math.round(vndRevenue),
        usd: parseFloat(usdRevenue.toFixed(2)),
        transactions: totalTransactions,
      };
    });

    res.json(result);
  } catch (err) {
    console.error("Payment Analytics Error:", err);
    res.status(500).json({ error: err.message });
  }
};

const getPaymentSummary = async (req, res) => {
  try {
    const { period = "30" } = req.query; // 7, 30, 90 (days)
    
    const days = parseInt(period);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Helper để convert amount
    const convertAmount = (amount, currency) => {
      if (currency === 'USD') {
        return amount / 100;
      }
      return amount;
    };

    // Aggregate theo status
    const summary = await Payment.aggregate([
      {
        $match: {
          created_at: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            status: "$status",
            currency: "$currency",
          },
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);

    // Tính tổng
    const total = summary.reduce((acc, item) => acc + item.count, 0);
    
    let vndRevenue = 0;
    let usdRevenue = 0;
    let paidCount = 0;

    summary.forEach((item) => {
      if (item._id.status === 'paid') {
        const currency = item._id.currency || 'VND';
        const convertedAmount = convertAmount(item.totalAmount, currency);
        
        if (currency === 'USD') {
          usdRevenue += convertedAmount;
        } else {
          vndRevenue += convertedAmount;
        }
        paidCount += item.count;
      }
    });

    const successRate = total > 0 
      ? ((paidCount / total) * 100).toFixed(1)
      : 0;

    res.json({
      total,
      paidCount,
      successRate: `${successRate}%`,
      revenue: {
        vnd: Math.round(vndRevenue),
        usd: parseFloat(usdRevenue.toFixed(2)),
        vndFormatted: new Intl.NumberFormat('vi-VN').format(vndRevenue) + ' đ',
        usdFormatted: '$' + new Intl.NumberFormat('en-US', { minimumFractionDigits: 2 }).format(usdRevenue),
      },
      breakdown: summary.map(item => ({
        status: item._id.status,
        currency: item._id.currency || 'VND',
        count: item.count,
        amount: item.totalAmount,
      })),
    });
  } catch (err) {
    console.error("Payment Summary Error:", err);
    res.status(500).json({ error: err.message });
  }
};

const getPaymentMethodStats = async (req, res) => {
  try {
    
    const convertAmount = (amount, currency) => {
      if (currency === 'USD') {
        return amount / 100;
      }
      return amount;
    };

    const methodStats = await Payment.aggregate([
      {
        $match: {
          status: "paid",
        },
      },
      {
        $group: {
          _id: {
            method: "$method",
            currency: "$currency",
          },
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
        },
      },
    ]);

    // Group lại theo method
    const methodMap = {};

    methodStats.forEach((item) => {
      const method = item._id.method;
      const currency = item._id.currency || 'VND';
      const convertedAmount = convertAmount(item.totalAmount, currency);

      if (!methodMap[method]) {
        methodMap[method] = {
          method,
          count: 0,
          vnd: 0,
          usd: 0,
          color: getMethodColor(method),
        };
      }

      if (currency === 'USD') {
        methodMap[method].usd += convertedAmount;
      } else {
        methodMap[method].vnd += convertedAmount;
      }
      methodMap[method].count += item.count;
    });

    const result = Object.values(methodMap).map(item => ({
      ...item,
      vnd: Math.round(item.vnd),
      usd: parseFloat(item.usd.toFixed(2)),
    }));

    res.json(result);
  } catch (err) {
    console.error("Payment Method Stats Error:", err);
    res.status(500).json({ error: err.message });
  }
};

// Helper: Màu sắc cho từng phương thức
function getMethodColor(method) {
  const colors = {
    stripe: "#635BFF",
    momo: "#D82D8B",
    mock: "#6B7280",
  };
  return colors[method] || "#3B82F6";
}

module.exports = {
  getAnalytics,
  getPostStats,
  getUserGrowth,
  getDailyInteractions,
  getPaymentAnalytics,
  getPaymentSummary,
  getPaymentMethodStats,
};
