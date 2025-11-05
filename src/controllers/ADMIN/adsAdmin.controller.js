const mongoose = require("mongoose");
const Ads = require("../../models/Payment_Ads/ads.model");

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

        // Build aggregation pipeline
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
                        { $project: { content: 1, type: 1, createdAt: 1 } }
                    ]
                }
            },
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

        const paginationData = {
            docs: ads,
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

module.exports = {
    getAllAds
};