const mongoose = require("mongoose");
const Ads = require("../../models/Payment_Ads/ads.model");
const Payment = require("../../models/Payment_Ads/payment.model");
const Post = require("../../models/post.model");
const postMedia = require("../../models/postMedia.model");
const Activity = require("../../models/Payment_Ads/activity-ads.model");

// Get All Ads
const getAllAds = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            status,
            search,
            user_id,
            start_date,
            end_date,
            min_views,
            max_views,
            sort_by = 'created_at',
            sort_order = 'desc'
        } = req.query;

        // Build filter
        const filter = {};

        // Filter by status
        if (status) {
            const statusArray = status.split(',');
            filter.status = { $in: statusArray };
        }

        // Filter by user_id
        if (user_id && mongoose.Types.ObjectId.isValid(user_id)) {
            filter.user_id = new mongoose.Types.ObjectId(user_id);
        }

        // Filter by date range
        if (start_date || end_date) {
            filter.created_at = {};
            if (start_date) {
                filter.created_at.$gte = new Date(start_date);
            }
            if (end_date) {
                const endDateTime = new Date(end_date);
                endDateTime.setHours(23, 59, 59, 999);
                filter.created_at.$lte = endDateTime;
            }
        }

        // Filter by views range
        if (min_views || max_views) {
            filter.current_views = {};
            if (min_views) {
                filter.current_views.$gte = parseInt(min_views);
            }
            if (max_views) {
                filter.current_views.$lte = parseInt(max_views);
            }
        }

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // Build sort object
        const sortObj = {};
        sortObj[sort_by] = sort_order === 'asc' ? 1 : -1;

        // Build aggregation pipeline - đơn giản hóa, không xử lý media ở đây
        const pipeline = [
            {
                $lookup: {
                    from: 'users',
                    localField: 'user_id',
                    foreignField: '_id',
                    as: 'user',
                    pipeline: [
                        { $project: { username: 1, email: 1, fullName: 1, avatar_url: 1 } }
                    ]
                }
            },
            {
                $lookup: {
                    from: 'posts',
                    localField: 'post_id',
                    foreignField: '_id',
                    as: 'post',
                    pipeline: [
                        { $project: { content: 1, type: 1, createdAt: 1, severity: 1 } }
                    ]
                }
            },
            {
                $addFields: {
                    user: { $arrayElemAt: ['$user', 0] },
                    post: { $arrayElemAt: ['$post', 0] },
                    progress_percentage: {
                        $cond: [
                            { $gt: ['$target_views', 0] },
                            { $multiply: [{ $divide: ['$current_views', '$target_views'] }, 100] },
                            0
                        ]
                    }
                }
            },
            // Lookup payment
            {
                $lookup: {
                    from: 'payments',
                    localField: '_id',
                    foreignField: 'ads_id',
                    as: 'payment',
                    pipeline: [
                        {
                            $match: { status: 'paid' }
                        },
                        {
                            $project: {
                                method: 1,
                                amount: 1,
                                currency: 1,
                                status: 1,
                                completed_at: 1
                            }
                        }
                    ]
                }
            },
            {
                $addFields: {
                    payment: { $arrayElemAt: ['$payment', 0] }
                }
            }
        ];

        // Add search filter if provided
        if (search && search.trim()) {
            pipeline.push({
                $match: {
                    $or: [
                        { campaign_name: { $regex: search.trim(), $options: 'i' } },
                        { 'user.username': { $regex: search.trim(), $options: 'i' } },
                        { 'user.email': { $regex: search.trim(), $options: 'i' } },
                        { 'user.fullName': { $regex: search.trim(), $options: 'i' } }
                    ]
                }
            });
        }

        // Add other filters
        if (Object.keys(filter).length > 0) {
            pipeline.unshift({ $match: filter });
        }

        // Execute aggregation with pagination
        const [result] = await Ads.aggregate([
            ...pipeline,
            {
                $facet: {
                    data: [
                        { $sort: sortObj },
                        { $skip: skip },
                        { $limit: limitNum },
                        {
                            $project: {
                                campaign_name: 1,
                                target_location: 1,
                                target_age: 1,
                                target_gender: 1,
                                target_views: 1,
                                current_views: 1,
                                total_interactions: 1,
                                progress_percentage: 1,
                                started_at: 1,
                                completed_at: 1,
                                deleted_at: 1,
                                status: 1,
                                created_at: 1,
                                updated_at: 1,
                                user: 1,
                                post: 1,
                                payment: 1
                            }
                        }
                    ],
                    metadata: [
                        { $count: 'total' }
                    ]
                }
            }
        ]);

        const ads = result.data;
        const totalDocs = result.metadata[0]?.total || 0;
        const totalPages = Math.ceil(totalDocs / limitNum);

        // Get post IDs to fetch media and reports
        const postIds = ads.map(ad => ad.post?._id).filter(Boolean);

        // Fetch media for all posts
        const postMedias = await postMedia
            .find({
                post_id: { $in: postIds }
            })
            .populate("media_id")
            .lean();

        // Fetch report counts for all posts
        const reportCounts = await mongoose.model('UserReport').aggregate([
            {
                $match: {
                    reportedPost: { $in: postIds }
                }
            },
            {
                $group: {
                    _id: '$reportedPost',
                    reportCount: { $sum: 1 },
                    pendingReportCount: {
                        $sum: {
                            $cond: [
                                { $in: ['$status', ['pending', 'investigating']] },
                                1,
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        // Map media by post_id
        const mediaMap = new Map();
        postMedias.forEach((pm) => {
            const media = (pm.media_id || []).map((m) => ({
                url: m.url,
                type: m.media_type,
            }));
            mediaMap.set(pm.post_id.toString(), media);
        });

        // Map report counts by post_id
        const reportMap = new Map();
        reportCounts.forEach((report) => {
            reportMap.set(report._id.toString(), {
                reportCount: report.reportCount,
                pendingReportCount: report.pendingReportCount
            });
        });

        // Attach media and report counts to ads posts
        const adsWithMedia = ads.map(ad => {
            if (ad.post && ad.post._id) {
                const postIdStr = ad.post._id.toString();
                ad.post.media = mediaMap.get(postIdStr) || [];

                const reportData = reportMap.get(postIdStr) || { reportCount: 0, pendingReportCount: 0 };
                ad.post.reportCount = reportData.reportCount;
                ad.post.pendingReportCount = reportData.pendingReportCount;
            }
            return ad;
        });

        const paginationData = {
            docs: adsWithMedia,
            totalDocs,
            limit: limitNum,
            totalPages,
            page: pageNum,
            pagingCounter: skip + 1,
            hasPrevPage: pageNum > 1,
            hasNextPage: pageNum < totalPages,
            prevPage: pageNum > 1 ? pageNum - 1 : null,
            nextPage: pageNum < totalPages ? pageNum + 1 : null
        };

        return res.status(200).json({
            success: true,
            message: "All ads retrieved successfully",
            data: paginationData
        });

    } catch (error) {
        console.error("Error getting all ads (admin):", error);
        return res.status(500).json({
            success: false,
            message: "Server error while retrieving ads",
            error: error.message
        });
    }
};

// Get Ad Statistics
const getAdStats = async (req, res) => {
    try {
        const [stats] = await Ads.aggregate([
            {
                $facet: {
                    totalAds: [{ $count: 'count' }],
                    activeAds: [
                        { $match: { status: 'active' } },
                        { $count: 'count' }
                    ],
                    completedAds: [
                        { $match: { status: 'completed' } },
                        { $count: 'count' }
                    ],
                    pendingReviewAds: [
                        { $match: { status: 'pending_review' } },
                        { $count: 'count' }
                    ],
                    totalViews: [
                        {
                            $group: {
                                _id: null,
                                total: { $sum: '$current_views' }
                            }
                        }
                    ],
                    totalInteractions: [
                        {
                            $group: {
                                _id: null,
                                total: { $sum: '$total_interactions' }
                            }
                        }
                    ]
                }
            }
        ]);

        // Calculate total revenue by currency
        const revenueResult = await Payment.aggregate([
            {
                $match: {
                    ads_id: { $exists: true, $ne: null },
                    status: 'paid'
                }
            },
            {
                $group: {
                    _id: '$currency',
                    total: { $sum: '$amount' }
                }
            }
        ]);

        // Transform revenue result to object
        const revenueByCart = {};
        revenueResult.forEach(item => {
            const currency = item._id ? item._id.toUpperCase() : 'USD';
            revenueByCart[currency] = item.total;
        });

        // Ensure both currencies exist
        const totalRevenue = {
            VND: revenueByCart.VND || 0,
            USD: revenueByCart.USD || 0
        };

        return res.status(200).json({
            success: true,
            message: "Ad statistics retrieved successfully",
            data: {
                totalAds: stats.totalAds[0]?.count || 0,
                activeAds: stats.activeAds[0]?.count || 0,
                completedAds: stats.completedAds[0]?.count || 0,
                pendingReviewAds: stats.pendingReviewAds[0]?.count || 0,
                totalRevenue,
                totalViews: stats.totalViews[0]?.total || 0,
                totalInteractions: stats.totalInteractions[0]?.total || 0
            }
        });

    } catch (error) {
        console.error("Error getting ad stats:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while retrieving ad statistics",
            error: error.message
        });
    }
};

// Get Ad Details
const getAdDetails = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid ad ID"
            });
        }

        const [ad] = await Ads.aggregate([
            {
                $match: { _id: new mongoose.Types.ObjectId(id) }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'user_id',
                    foreignField: '_id',
                    as: 'user',
                    pipeline: [
                        { $project: { username: 1, email: 1, fullName: 1, avatar_url: 1 } }
                    ]
                }
            },
            {
                $lookup: {
                    from: 'posts',
                    localField: 'post_id',
                    foreignField: '_id',
                    as: 'post',
                    pipeline: [
                        { $project: { content: 1, type: 1, media: 1, createdAt: 1 } }
                    ]
                }
            },
            {
                $lookup: {
                    from: 'payments',
                    localField: '_id',
                    foreignField: 'ads_id',
                    as: 'payment'
                }
            },
            {
                $addFields: {
                    user: { $arrayElemAt: ['$user', 0] },
                    post: { $arrayElemAt: ['$post', 0] },
                    payment: { $arrayElemAt: ['$payment', 0] },
                    progress_percentage: {
                        $cond: [
                            { $gt: ['$target_views', 0] },
                            { $multiply: [{ $divide: ['$current_views', '$target_views'] }, 100] },
                            0
                        ]
                    }
                }
            }
        ]);

        if (!ad) {
            return res.status(404).json({
                success: false,
                message: "Ad not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Ad details retrieved successfully",
            data: ad
        });

    } catch (error) {
        console.error("Error getting ad details:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while retrieving ad details",
            error: error.message
        });
    }
};

// Delete Ad (soft delete)
const deleteAd = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid ad ID"
            });
        }

        const ad = await Ads.findById(id).populate("user_id", "fullName username avatar_url email");

        if (!ad) {
            return res.status(404).json({
                success: false,
                message: "Ad not found"
            });
        }

        // Lưu thông tin trước khi cập nhật
        const campaignName = ad.campaign_name;
        const userId = ad.user_id._id;
        const currentViews = ad.current_views;
        const targetViews = ad.target_views;
        const postId = ad.post_id;

        // Cập nhật status
        ad.status = 'deleted';
        ad.deleted_at = new Date();
        await ad.save();

        // 1. Tạo activity log
        await Activity.create({
            user_id: userId,
            ads_id: id,
            type: 'campaign_deleted',
            metadata: {
                campaign_name: campaignName,
                views_count: currentViews,
                progress_percent: targetViews > 0 ? Math.round((currentViews / targetViews) * 100) : 0,
                reason: 'Deleted by admin - Policy violation'
            }
        });

        // 2. Resolve tất cả reports của post này (nếu có)
        if (postId) {
            await mongoose.model('UserReport').updateMany(
                {
                    reportedPost: postId,
                    status: { $in: ["pending", "investigating"] }
                },
                {
                    $set: {
                        status: "resolved",
                        actionTaken: "ad_removed",
                        resolvedAt: new Date()
                    }
                }
            );
        }

        // 3. Gửi thông báo cho user
        try {
            const { getSocketIO, getNotificationUserSocketMap } = require("../../socket/io-instance");
            const notificationService = require("../../services/notification.service");

            const io = getSocketIO();
            const notificationsNamespace = io.of("/notifications");
            const notificationUserSocketMap = getNotificationUserSocketMap();

            const notificationMessage =
                `🚨 ADVERTISING CAMPAIGN DELETED BY ADMIN\n` +
                `Your advertising campaign "${campaignName}" has been removed by administrator for violating our advertising policies.\n\n` +
                `Campaign Progress: ${currentViews}/${targetViews} views (${targetViews > 0 ? Math.round((currentViews / targetViews) * 100) : 0}%)\n\n` +
                `Common policy violations include:\n` +
                `• Misleading or false advertising content\n` +
                `• Inappropriate or offensive material\n` +
                `• Prohibited products or services\n` +
                `• Violation of community guidelines\n\n` +
                `Please review our advertising policies before creating new campaigns.\n` +
                `Repeated violations may result in account restrictions.`;

            await notificationService.createNotificationWithNamespace(
                notificationsNamespace,
                userId,
                "system",
                notificationMessage,
                notificationUserSocketMap,
                {
                    relatedId: id,
                    type: "ad_deleted",
                    severity: "warning",
                    campaignName: campaignName
                }
            );
        } catch (notifyErr) {
            console.error("Failed to send notification:", notifyErr);
        }

        return res.status(200).json({
            success: true,
            message: "Ad deleted successfully",
            data: ad
        });

    } catch (error) {
        console.error("Error deleting ad:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while deleting ad",
            error: error.message
        });
    }
};

// Get All Ads Reports by Status (pending/investigating)
const getAllAdsReportsByStatus = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            status = "pending",
            reportType = "",
            sortBy = "latestReportDate",
            sortOrder = "desc",
            search = "",
        } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Build report status filter
        const reportStatusFilter = status === "investigating"
            ? { $in: ["investigating"] }
            : { $in: ["pending"] };

        // Build match conditions for reports
        const reportMatchConditions = {
            status: reportStatusFilter,
            reportedPost: { $exists: true, $ne: null }
        };

        // Add report type filter if provided
        if (reportType && reportType !== "") {
            reportMatchConditions.reportType = reportType;
        }

        // Build sort options
        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1;

        // Aggregation pipeline
        const groupedReports = await mongoose.model('UserReport').aggregate([
            // Match reports by status and type
            { $match: reportMatchConditions },

            // Lookup post info
            {
                $lookup: {
                    from: "posts",
                    localField: "reportedPost",
                    foreignField: "_id",
                    as: "postInfo",
                    pipeline: [
                        {
                            $lookup: {
                                from: "users",
                                localField: "user_id",
                                foreignField: "_id",
                                as: "user_id"
                            }
                        },
                        {
                            $unwind: { path: "$user_id", preserveNullAndEmptyArrays: true }
                        },
                        {
                            $project: {
                                _id: 1,
                                content: 1,
                                type: 1,
                                severity: 1,
                                is_deleted: 1,
                                user_id: {
                                    _id: 1,
                                    fullName: 1,
                                    avatar_url: 1,
                                    email: 1,
                                    username: 1
                                },
                                createdAt: 1
                            }
                        }
                    ]
                }
            },
            { $unwind: { path: "$postInfo", preserveNullAndEmptyArrays: true } },

            // Lookup ads - CHỈ LẤY posts CÓ quảng cáo active/paused
            {
                $lookup: {
                    from: "ads",
                    let: { postId: "$reportedPost" },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ["$post_id", "$$postId"] },
                                status: { $in: ["active", "paused"] }
                            }
                        }
                    ],
                    as: "activeAds"
                }
            },

            // CHỈ GIỮ LẠI những post CÓ quảng cáo active
            {
                $match: {
                    $expr: { $gt: [{ $size: "$activeAds" }, 0] }
                }
            },

            // Lookup reporter info
            {
                $lookup: {
                    from: "users",
                    localField: "reportedBy",
                    foreignField: "_id",
                    as: "reporterInfo",
                    pipeline: [
                        {
                            $project: {
                                _id: 1,
                                fullName: 1,
                                avatar_url: 1,
                                email: 1
                            }
                        }
                    ]
                }
            },
            { $unwind: { path: "$reporterInfo", preserveNullAndEmptyArrays: true } },

            // Apply search filter if provided
            ...(search && search.trim() ? [
                {
                    $match: {
                        $or: [
                            { "postInfo.content": { $regex: search.trim(), $options: "i" } },
                            { "postInfo.user_id.fullName": { $regex: search.trim(), $options: "i" } },
                            { "postInfo.user_id.username": { $regex: search.trim(), $options: "i" } },
                            { "reporterInfo.fullName": { $regex: search.trim(), $options: "i" } },
                            { reason: { $regex: search.trim(), $options: "i" } }
                        ]
                    }
                }
            ] : []),

            // Group by reportedPost
            {
                $group: {
                    _id: "$reportedPost",
                    postInfo: { $first: "$postInfo" },
                    ads: { $first: "$activeAds" },
                    reportCount: { $sum: 1 },
                    reports: {
                        $push: {
                            _id: "$_id",
                            reportType: "$reportType",
                            reason: "$reason",
                            status: "$status",
                            actionTaken: "$actionTaken",
                            reporter: "$reporterInfo",
                            createdAt: "$createdAt"
                        }
                    },
                    latestReportDate: { $max: "$createdAt" },
                    oldestReportDate: { $min: "$createdAt" },
                    reportTypes: { $addToSet: "$reportType" }
                }
            },

            // Add report type count
            {
                $addFields: {
                    reportTypeCount: {
                        $arrayToObject: {
                            $map: {
                                input: "$reportTypes",
                                as: "type",
                                in: {
                                    k: "$$type",
                                    v: {
                                        $size: {
                                            $filter: {
                                                input: "$reports",
                                                as: "report",
                                                cond: { $eq: ["$$report.reportType", "$$type"] }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },

            // Project final fields
            {
                $project: {
                    _id: 0,
                    postId: "$_id",
                    post: "$postInfo",
                    ads: 1,
                    reportCount: 1,
                    reports: 1,
                    latestReportDate: 1,
                    oldestReportDate: 1,
                    reportTypes: 1,
                    reportTypeCount: 1
                }
            },

            { $sort: sortOptions },

            // Pagination with metadata
            {
                $facet: {
                    metadata: [
                        { $count: "total" },
                        {
                            $addFields: {
                                page: parseInt(page),
                                limit: parseInt(limit),
                                totalPages: { $ceil: { $divide: ["$total", parseInt(limit)] } }
                            }
                        }
                    ],
                    data: [
                        { $skip: skip },
                        { $limit: parseInt(limit) }
                    ]
                }
            }
        ]);

        const result = groupedReports[0];
        const metadata = result.metadata[0] || { total: 0, page: 1, limit: 10, totalPages: 0 };
        const data = result.data;

        // Get post IDs to fetch media
        const postIds = data.map(item => item.postId);

        // Fetch media for all posts
        const postMedias = await postMedia
            .find({
                post_id: { $in: postIds }
            })
            .populate("media_id")
            .lean();

        // Map media by post_id
        const mediaMap = new Map();
        postMedias.forEach((pm) => {
            const media = (pm.media_id || []).map((m) => ({
                url: m.url,
                thumbnail: m.thumbnail_url || m.url,
                type: m.media_type,
                duration: m.duration || null,
            }));
            mediaMap.set(pm.post_id.toString(), media);
        });

        // Transform data with media
        const postReports = data.map(item => ({
            ...item,
            post: {
                ...item.post,
                media: mediaMap.get(item.postId.toString()) || []
            }
        }));

        // Calculate total counts
        const totalReportsCount = await mongoose.model('UserReport').countDocuments({
            status: reportStatusFilter,
            reportedPost: { $exists: true, $ne: null }
        });

        res.status(200).json({
            success: true,
            data: {
                postReports,
                pagination: {
                    currentPage: metadata.page,
                    totalPages: metadata.totalPages,
                    totalPosts: metadata.total,
                    limit: metadata.limit
                },
                statistics: {
                    totalReports: totalReportsCount,
                    totalPosts: metadata.total
                }
            }
        });

    } catch (error) {
        console.error("Error in getAllAdsReportsByStatus:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching ads reports by status",
            error: error.message
        });
    }
};

// Get All Resolved Ads Reports (dismissed/resolved)
const getAllResolvedAdsReports = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            status = "all",
            reportType = "",
            sortBy = "resolvedDate",
            sortOrder = "desc",
            search = "",
            actionTaken = ""
        } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Build report status filter
        let reportStatusFilter;
        if (status === "dismissed") {
            reportStatusFilter = { $in: ["dismissed"] };
        } else if (status === "resolved") {
            reportStatusFilter = { $in: ["resolved"] };
        } else {
            reportStatusFilter = { $in: ["dismissed", "resolved"] };
        }

        // Build match conditions for reports
        const reportMatchConditions = {
            status: reportStatusFilter,
            reportedPost: { $exists: true, $ne: null }
        };

        // Add report type filter if provided
        if (reportType && reportType !== "") {
            reportMatchConditions.reportType = reportType;
        }

        // Add action taken filter if provided
        if (actionTaken && actionTaken !== "") {
            reportMatchConditions.actionTaken = actionTaken;
        }

        // Build sort options
        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === "asc" ? 1 : -1;

        // Aggregation pipeline
        const groupedReports = await mongoose.model('UserReport').aggregate([
            // Match reports by status
            { $match: reportMatchConditions },

            // Lookup post info
            {
                $lookup: {
                    from: "posts",
                    localField: "reportedPost",
                    foreignField: "_id",
                    as: "postInfo",
                    pipeline: [
                        {
                            $lookup: {
                                from: "users",
                                localField: "user_id",
                                foreignField: "_id",
                                as: "user_id"
                            }
                        },
                        {
                            $unwind: { path: "$user_id", preserveNullAndEmptyArrays: true }
                        },
                        {
                            $project: {
                                _id: 1,
                                content: 1,
                                type: 1,
                                severity: 1,
                                is_deleted: 1,
                                user_id: {
                                    _id: 1,
                                    fullName: 1,
                                    avatar_url: 1,
                                    email: 1,
                                    username: 1
                                },
                                createdAt: 1
                            }
                        }
                    ]
                }
            },
            { $unwind: { path: "$postInfo", preserveNullAndEmptyArrays: true } },

            // Lookup ads - CHỈ LẤY posts CÓ quảng cáo active/paused
            {
                $lookup: {
                    from: "ads",
                    let: { postId: "$reportedPost" },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ["$post_id", "$$postId"] },
                            }
                        }
                    ],
                    as: "activeAds"
                }
            },

            // CHỈ GIỮ LẠI những post CÓ quảng cáo active
            {
                $match: {
                    $expr: { $gt: [{ $size: "$activeAds" }, 0] }
                }
            },

            // Lookup reporter info
            {
                $lookup: {
                    from: "users",
                    localField: "reportedBy",
                    foreignField: "_id",
                    as: "reporterInfo",
                    pipeline: [
                        {
                            $project: {
                                _id: 1,
                                fullName: 1,
                                avatar_url: 1,
                                email: 1
                            }
                        }
                    ]
                }
            },
            { $unwind: { path: "$reporterInfo", preserveNullAndEmptyArrays: true } },

            // Group by reportedPost
            {
                $group: {
                    _id: "$reportedPost",
                    postInfo: { $first: "$postInfo" },
                    ads: { $first: "$activeAds" },
                    reportCount: { $sum: 1 },
                    reports: {
                        $push: {
                            _id: "$_id",
                            reportType: "$reportType",
                            reason: "$reason",
                            status: "$status",
                            actionTaken: "$actionTaken",
                            reporter: "$reporterInfo",
                            createdAt: "$createdAt",
                            resolvedAt: "$resolvedAt"
                        }
                    },
                    latestReportDate: { $max: "$createdAt" },
                    oldestReportDate: { $min: "$createdAt" },
                    resolvedDate: { $max: "$resolvedAt" },
                    reportTypes: { $addToSet: "$reportType" },
                    reportTypeBreakdown: {
                        $push: "$reportType"
                    },
                    actionBreakdown: {
                        $push: "$actionTaken"
                    },
                    statusBreakdown: {
                        $push: "$status"
                    }
                }
            },

            // Calculate counts
            {
                $addFields: {
                    reportTypeCount: {
                        $arrayToObject: {
                            $map: {
                                input: { $setUnion: "$reportTypes" },
                                as: "type",
                                in: {
                                    k: "$$type",
                                    v: {
                                        $size: {
                                            $filter: {
                                                input: "$reportTypeBreakdown",
                                                as: "item",
                                                cond: { $eq: ["$$item", "$$type"] }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    dismissedCount: {
                        $size: {
                            $filter: {
                                input: "$statusBreakdown",
                                as: "s",
                                cond: { $eq: ["$$s", "dismissed"] }
                            }
                        }
                    },
                    resolvedCount: {
                        $size: {
                            $filter: {
                                input: "$statusBreakdown",
                                as: "s",
                                cond: { $eq: ["$$s", "resolved"] }
                            }
                        }
                    },
                    contentRemovedCount: {
                        $size: {
                            $filter: {
                                input: "$actionBreakdown",
                                as: "a",
                                cond: { $eq: ["$$a", "content_removed"] }
                            }
                        }
                    }
                }
            },

            // Project final fields
            {
                $project: {
                    _id: 0,
                    postId: "$_id",
                    post: "$postInfo",
                    ads: 1,
                    reportCount: 1,
                    reports: 1,
                    latestReportDate: 1,
                    oldestReportDate: 1,
                    resolvedDate: 1,
                    reportTypes: 1,
                    reportTypeCount: 1,
                    dismissedCount: 1,
                    resolvedCount: 1,
                    contentRemovedCount: 1
                }
            },

            { $sort: sortOptions },

            // Pagination with metadata
            {
                $facet: {
                    metadata: [
                        { $count: "total" },
                        {
                            $addFields: {
                                page: parseInt(page),
                                limit: parseInt(limit),
                                totalPages: { $ceil: { $divide: ["$total", parseInt(limit)] } }
                            }
                        }
                    ],
                    data: [
                        { $skip: skip },
                        { $limit: parseInt(limit) }
                    ]
                }
            }
        ]);

        const result = groupedReports[0];
        const metadata = result.metadata[0] || { total: 0, page: 1, limit: 10, totalPages: 0 };
        const data = result.data;

        // Get post IDs to fetch media
        const postIds = data.map(item => item.postId);

        // Fetch media for all posts
        const postMedias = await postMedia
            .find({
                post_id: { $in: postIds }
            })
            .populate("media_id")
            .lean();

        // Map media by post_id
        const mediaMap = new Map();
        postMedias.forEach((pm) => {
            const media = (pm.media_id || []).map((m) => ({
                url: m.url,
                thumbnail: m.thumbnail_url || m.url,
                type: m.media_type,
                duration: m.duration || null,
            }));
            mediaMap.set(pm.post_id.toString(), media);
        });

        // Transform data with media
        const postReports = data.map(item => ({
            ...item,
            post: {
                ...item.post,
                media: mediaMap.get(item.postId.toString()) || []
            }
        }));

        // Calculate total counts
        const totalReportsCount = await mongoose.model('UserReport').countDocuments({
            status: reportStatusFilter,
            reportedPost: { $exists: true, $ne: null }
        });

        const dismissedCount = await mongoose.model('UserReport').countDocuments({
            status: "dismissed",
            reportedPost: { $exists: true, $ne: null }
        });

        const resolvedCount = await mongoose.model('UserReport').countDocuments({
            status: "resolved",
            reportedPost: { $exists: true, $ne: null }
        });

        res.status(200).json({
            success: true,
            data: {
                postReports,
                pagination: {
                    currentPage: metadata.page,
                    totalPages: metadata.totalPages,
                    totalPosts: metadata.total,
                    limit: metadata.limit
                },
                statistics: {
                    totalResolvedReports: totalReportsCount,
                    totalDismissedReports: dismissedCount,
                    totalResolvedWithAction: resolvedCount,
                    totalPosts: metadata.total
                }
            }
        });

    } catch (error) {
        console.error("Error in getAllResolvedAdsReports:", error);
        res.status(500).json({
            success: false,
            message: "Error fetching resolved ads reports",
            error: error.message
        });
    }
};

// Dismiss all pending reports of an ad's post
const dismissAllPendingReportsOfAd = async (req, res) => {
    try {
        const { postId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(postId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid post ID"
            });
        }

        // Update all pending or investigating reports
        const result = await mongoose.model('UserReport').updateMany(
            {
                reportedPost: new mongoose.Types.ObjectId(postId),
                status: { $in: ["pending", "investigating"] }
            },
            {
                $set: {
                    status: "dismissed",
                    resolvedAt: new Date()
                }
            }
        );

        res.status(200).json({
            success: true,
            message: `Dismissed ${result.modifiedCount} reports for the ad post`,
            data: {
                dismissedCount: result.modifiedCount
            }
        });

    } catch (error) {
        console.error("Error in dismissAllPendingReportsOfAd:", error);
        res.status(500).json({
            success: false,
            message: "Error dismissing reports for the ad post",
            error: error.message
        });
    }
};

// Mark all pending reports of an ad's post as investigating
const markAdAsInvestigating = async (req, res) => {
    try {
        const { postId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(postId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid post ID"
            });
        }

        // Update all pending reports to investigating
        const result = await mongoose.model('UserReport').updateMany(
            {
                reportedPost: new mongoose.Types.ObjectId(postId),
                status: "pending"
            },
            {
                $set: { status: "investigating" }
            }
        );

        res.status(200).json({
            success: true,
            message: `Marked ${result.modifiedCount} reports as investigating for the ad post`,
            data: {
                updatedCount: result.modifiedCount
            }
        });

    } catch (error) {
        console.error("Error in markAdAsInvestigating:", error);
        res.status(500).json({
            success: false,
            message: "Error marking reports as investigating for the ad post",
            error: error.message
        });
    }
};

const getAdsReportsStats = async (req, res) => {
    try {
        // 1. Đếm tổng số ads hiện có
        const totalAds = await Ads.countDocuments();

        // 2. Lấy danh sách post_id từ tất cả ads active/paused
        const activeAds = await Ads.find({
            status: { $in: ["active", "paused"] }
        }).select("post_id").lean();

        const activeAdPostIds = activeAds.map(ad => ad.post_id);

        // 3. Đếm số lượng post (có ads) đang có reports pending
        const pendingReportsCount = await mongoose.model('UserReport').aggregate([
            {
                $match: {
                    reportedPost: { $in: activeAdPostIds },
                    status: "pending"
                }
            },
            {
                $group: {
                    _id: "$reportedPost"
                }
            },
            {
                $count: "total"
            }
        ]);

        // 4. Đếm số lượng post (có ads) đang có reports investigating
        const investigatingReportsCount = await mongoose.model('UserReport').aggregate([
            {
                $match: {
                    reportedPost: { $in: activeAdPostIds },
                    status: "investigating"
                }
            },
            {
                $group: {
                    _id: "$reportedPost"
                }
            },
            {
                $count: "total"
            }
        ]);

        return res.status(200).json({
            success: true,
            message: "Ads reports statistics retrieved successfully",
            data: {
                totalAds: totalAds,
                totalPending: pendingReportsCount[0]?.total || 0,
                totalInvestigating: investigatingReportsCount[0]?.total || 0
            }
        });

    } catch (error) {
        console.error("Error getting ads reports stats:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while retrieving ads reports statistics",
            error: error.message
        });
    }
};

module.exports = {
    getAllAds,
    getAdStats,
    getAdDetails,
    deleteAd,
    getAllAdsReportsByStatus,
    getAllResolvedAdsReports,
    dismissAllPendingReportsOfAd,
    markAdAsInvestigating,
    getAdsReportsStats
};