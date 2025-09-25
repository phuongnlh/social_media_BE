const mongoose = require("mongoose");
const Ads = require("../models/Payment_Ads/ads.model");
const Post = require("../models/post.model");
const Payment = require("../models/Payment_Ads/payment.model");
const Comment = require("../models/Comment_Reaction/comment.model");
const Reaction = require("../models/Comment_Reaction/post_reaction.model");

// Create Ads
const createAds = async (req, res) => {
    try {
        const user_id = req.user._id;
        const {
            post_id,
            campaign_name,
            target_location,
            target_age,
            target_gender,
            target_views
        } = req.body;

        if (
            !post_id || !campaign_name || !target_location || !target_age || !target_gender || !target_views) {
            return res.status(400).json({
                success: false,
                message: "All fields are required (post_id, campaign_name, target_location, target_age, target_gender, target_views)"
            });
        }

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(post_id)) {
            return res.status(400).json({ success: false, message: "Invalid post_id" });
        }

        const post = await Post.findById(post_id);
        if (!post) return res.status(404).json({ success: false, message: "Post not found" });
        if (post.user_id.toString() !== user_id.toString()) {
            return res.status(403).json({ success: false, message: "You don't have permission to create ads for this post" });
        }

        // Calculate total interactions (comments + reactions)    
        const [commentCount, reactionCount] = await Promise.all([
            Comment.countDocuments({ post_id: post_id }),
            Reaction.countDocuments({ post_id: post_id })
        ]);

        const totalInteractions = commentCount + reactionCount;

        // Validate target_views
        const targetViewsNum = parseInt(target_views);
        if (isNaN(targetViewsNum) || targetViewsNum < 1) {
            return res.status(400).json({ success: false, message: "target_views must be a positive number" });
        }

        // Validate target_age object
        if (!target_age || typeof target_age !== 'object' || !target_age.min || !target_age.max) {
            return res.status(400).json({ success: false, message: "target_age must be an object with min and max properties" });
        }

        const minAge = parseInt(target_age.min);
        const maxAge = parseInt(target_age.max);

        if (isNaN(minAge) || isNaN(maxAge) || minAge < 0 || maxAge < 0 || minAge > maxAge) {
            return res.status(400).json({ success: false, message: "Invalid age range. Min age must be less than or equal to max age" });
        }

        // Validate target_gender array
        if (!Array.isArray(target_gender) || target_gender.length === 0) {
            return res.status(400).json({ success: false, message: "Target gender must be a non-empty array" });
        }

        const validGenders = ['male', 'female', 'other'];
        const validatedGenders = target_gender.filter(gender => validGenders.includes(gender));

        if (validatedGenders.length === 0) {
            return res.status(400).json({ success: false, message: "At least one valid gender is required (male, female, other)" });
        }

        // Remove duplicates
        const uniqueGenders = [...new Set(validatedGenders)];

        // Validate target_location is an array
        if (!Array.isArray(target_location) || target_location.length === 0) {
            return res.status(400).json({ success: false, message: "Target location must be a non-empty array" });
        }

        // Validate each location in the array
        const validatedLocations = target_location.map(location => String(location).trim()).filter(loc => loc.length > 0);
        if (validatedLocations.length === 0) {
            return res.status(400).json({ success: false, message: "At least one valid location is required" });
        }

        const newAds = new Ads({
            user_id,
            post_id,
            campaign_name: String(campaign_name).trim(),
            target_location: validatedLocations,
            target_age: {
                min: minAge,
                max: maxAge
            },
            target_gender: uniqueGenders,
            target_views: targetViewsNum,
            total_interactions: totalInteractions
        });

        const savedAds = await newAds.save();
        return res.status(201).json({ success: true, message: "Ad created successfully", data: savedAds });
    } catch (error) {
        console.error("Error creating ads:", error);
        return res.status(500).json({ success: false, message: "Server error while creating ad", error: error.message });
    }
};

// Get All Ads
const getAllAds = async (req, res) => {
    try {
        const { page = 1, limit = 10, status, target_gender } = req.query;
        const user_id = req.user._id;

        // Build filter
        const filter = { user_id };
        if (status) filter.status = status;
        if (target_gender) filter.target_gender = target_gender;

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        const ads = await Ads.aggregate([
            { $match: filter },
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
                    from: 'postmedias',
                    let: { postId: '$post_id' },
                    as: 'post_media',
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$post_id', '$$postId'] },
                                        { $eq: ['$type', 'post'] }
                                    ]
                                }
                            }
                        },
                        {
                            $lookup: {
                                from: 'media',
                                localField: 'media_id',
                                foreignField: '_id',
                                as: 'media_files',
                                pipeline: [
                                    { $project: { url: 1, media_type: 1, _id: 0 } }
                                ]
                            }
                        },
                        { $project: { _id: 0, media_files: 1 } }
                    ]
                }
            },
            {
                $addFields: {
                    user: { $arrayElemAt: ['$user', 0] },
                    post: { $arrayElemAt: ['$post', 0] },
                    media_files: {
                        $reduce: {
                            input: '$post_media.media_files',
                            initialValue: [],
                            in: { $concatArrays: ['$$value', '$$this'] }
                        }
                    },
                    // Calculate progress percentage
                    progress_percentage: {
                        $cond: [
                            { $gt: ['$target_views', 0] },
                            { $multiply: [{ $divide: ['$current_views', '$target_views'] }, 100] },
                            0
                        ]
                    }
                }
            },
            {
                $project: {
                    campaign_name: 1,
                    target_location: 1,
                    target_age: 1,
                    target_gender: 1,
                    target_views: 1,
                    current_views: 1,
                    progress_percentage: 1,
                    started_at: 1,
                    completed_at: 1,
                    status: 1,
                    created_at: 1,
                    updated_at: 1,
                    user: 1,
                    post: 1,
                    media_files: 1
                }
            },
            { $sort: { created_at: -1 } },
            { $skip: skip },
            { $limit: limitNum }
        ]);

        // Get total count for pagination
        const totalDocs = await Ads.countDocuments(filter);
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
            message: "Ads retrieved successfully",
            data: paginationData
        });

    } catch (error) {
        console.error("Error getting ads:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while retrieving ads",
            error: error.message
        });
    }
};

const getAllAdsByUserId = async (req, res) => {
    try {
        const userId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid user ID"
            });
        }

        const ads = await Ads.find({ user_id: userId }).sort({ createdAt: -1 });

        if (!ads || ads.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No ads found for this user",
                data: []
            });
        }

        const adsWithPayment = await Promise.all(
            ads.map(async (ad) => {
                const payment = await Payment.findOne({ ads_id: ad._id })
                    .select("method amount currency status paylink")
                    .lean();

                return {
                    ...ad.toObject(),
                    payment: payment || null
                };
            })
        );

        return res.status(200).json({
            success: true,
            message: "Ads with payment info retrieved successfully",
            data: adsWithPayment
        });

    } catch (error) {
        console.error("Error getting ads by user ID:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while retrieving ads",
            error: error.message
        });
    }
};

const getAdsAnalytics = async (req, res) => {
    try {
        const userId = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid user ID"
            });
        }

        // Aggregate ads data với payment information
        const analyticsData = await Ads.aggregate([
            {
                $match: {
                    user_id: userId,
                    status: { $in: ['completed', 'paused', 'active'] }
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
                    paidPayment: {
                        $arrayElemAt: [
                            {
                                $filter: {
                                    input: '$payment',
                                    cond: { $eq: ['$$this.status', 'paid'] }
                                }
                            },
                            0
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: null,
                    totalSpendVND: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $ne: ['$paidPayment', null] },
                                        { $eq: ['$paidPayment.currency', 'VND'] }
                                    ]
                                },
                                '$paidPayment.amount',
                                0
                            ]
                        }
                    },
                    totalSpendUSD: {
                        $sum: {
                            $cond: [
                                {
                                    $and: [
                                        { $ne: ['$paidPayment', null] },
                                        { $eq: ['$paidPayment.currency', 'USD'] }
                                    ]
                                },
                                '$paidPayment.amount',
                                0
                            ]
                        }
                    },
                    totalReach: { $sum: '$current_views' },
                    totalInteractions: { $sum: '$total_interactions' },
                    activeAdsCount: {
                        $sum: {
                            $cond: [
                                { $eq: ['$status', 'active'] },
                                1,
                                0
                            ]
                        }
                    },
                    completedAdsCount: {
                        $sum: {
                            $cond: [
                                { $eq: ['$status', 'completed'] },
                                1,
                                0
                            ]
                        }
                    },
                    pausedAdsCount: {
                        $sum: {
                            $cond: [
                                { $eq: ['$status', 'paused'] },
                                1,
                                0
                            ]
                        }
                    },
                    totalAdsCount: { $sum: 1 }
                }
            }
        ]);

        const result = analyticsData.length > 0 ? analyticsData[0] : {
            totalSpendVND: 0,
            totalSpendUSD: 0,
            totalReach: 0,
            totalInteractions: 0,
            activeAdsCount: 0,
            completedAdsCount: 0,
            pausedAdsCount: 0,
            totalAdsCount: 0
        };

        delete result._id;

        return res.status(200).json({
            success: true,
            message: "Ads analytics retrieved successfully",
            data: result
        });

    } catch (error) {
        console.error("Error getting ads analytics:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while retrieving ads analytics",
            error: error.message
        });
    }
};

// Get Ad by ID
const getAdById = async (req, res) => {
    try {
        const { id } = req.params;
        const user_id = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid ad ID"
            });
        }

        const ad = await Ads.aggregate([
            {
                $match: {
                    _id: new mongoose.Types.ObjectId(id),
                    user_id: new mongoose.Types.ObjectId(user_id)
                }
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
                        { $project: { content: 1, type: 1, createdAt: 1 } }
                    ]
                }
            },
            {
                $lookup: {
                    from: 'postmedias',
                    let: { postId: '$post_id' },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$post_id', '$$postId'] },
                                        { $eq: ['$type', 'post'] }
                                    ]
                                }
                            }
                        },
                        {
                            $lookup: {
                                from: 'media',
                                localField: 'media_id',
                                foreignField: '_id',
                                as: 'media_files',
                                pipeline: [
                                    { $project: { url: 1, media_type: 1 } }
                                ]
                            }
                        }
                    ],
                    as: 'post_media'
                }
            },
            {
                $addFields: {
                    user: { $arrayElemAt: ['$user', 0] },
                    post: { $arrayElemAt: ['$post', 0] },
                    media_files: {
                        $reduce: {
                            input: '$post_media.media_files',
                            initialValue: [],
                            in: { $concatArrays: ['$$value', '$$this'] }
                        }
                    },
                    progress_percentage: {
                        $cond: [
                            { $gt: ['$target_views', 0] },
                            { $multiply: [{ $divide: ['$current_views', '$target_views'] }, 100] },
                            0
                        ]
                    }
                }
            },
            {
                $project: {
                    campaign_name: 1,
                    target_location: 1,
                    target_age: 1,
                    target_gender: 1,
                    target_views: 1,
                    current_views: 1,
                    progress_percentage: 1,
                    started_at: 1,
                    completed_at: 1,
                    status: 1,
                    created_at: 1,
                    updated_at: 1,
                    user: 1,
                    post: 1,
                    media_files: 1
                }
            }
        ]);

        if (!ad || ad.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Ad not found"
            });
        }

        return res.status(200).json({
            success: true,
            message: "Ad retrieved successfully",
            data: ad[0]
        });

    } catch (error) {
        console.error("Error getting ad:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while retrieving ad",
            error: error.message
        });
    }
};

// Update Ad
const updateAd = async (req, res) => {
    try {
        const { id } = req.params;
        const user_id = req.user._id;
        const {
            campaign_name,
            target_location,
            target_age,
            target_gender,
        } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid ad ID"
            });
        }

        // Find the ad
        const ad = await Ads.findOne({ _id: id, user_id });
        if (!ad) {
            return res.status(404).json({
                success: false,
                message: "Ad not found"
            });
        }

        // Build updates object
        const updates = {};

        if (campaign_name !== undefined) {
            updates.campaign_name = String(campaign_name).trim();
        }

        if (target_location !== undefined) {
            if (!Array.isArray(target_location) || target_location.length === 0) {
                return res.status(400).json({ success: false, message: "Target location must be a non-empty array" });
            }
            const validatedLocations = target_location.map(location => String(location).trim()).filter(loc => loc.length > 0);
            if (validatedLocations.length === 0) {
                return res.status(400).json({ success: false, message: "At least one valid location is required" });
            }
            updates.target_location = validatedLocations;
        }

        if (target_age !== undefined) {
            if (!target_age || typeof target_age !== 'object' || !target_age.min || !target_age.max) {
                return res.status(400).json({ success: false, message: "target_age must be an object with min and max properties" });
            }

            const minAge = parseInt(target_age.min);
            const maxAge = parseInt(target_age.max);

            if (isNaN(minAge) || isNaN(maxAge) || minAge < 0 || maxAge < 0 || minAge > maxAge) {
                return res.status(400).json({ success: false, message: "Invalid age range. Min age must be less than or equal to max age" });
            }

            updates.target_age = {
                min: minAge,
                max: maxAge
            };
        }

        if (target_gender !== undefined) {
            if (!Array.isArray(target_gender) || target_gender.length === 0) {
                return res.status(400).json({ success: false, message: "Target gender must be a non-empty array" });
            }

            const validGenders = ['male', 'female', 'other'];
            const validatedGenders = target_gender.filter(gender => validGenders.includes(gender));

            if (validatedGenders.length === 0) {
                return res.status(400).json({ success: false, message: "At least one valid gender is required (male, female, other)" });
            }

            updates.target_gender = [...new Set(validatedGenders)];
        }

        // Check if any updates provided
        if (Object.keys(updates).length === 0) {
            return res.status(400).json({
                success: false,
                message: "No valid fields to update"
            });
        }

        // Update the ad
        const updatedAd = await Ads.findByIdAndUpdate(
            id,
            updates,
            { new: true, runValidators: true }
        ).populate('user_id', 'username email')
            .populate('post_id', 'content image_url');

        return res.status(200).json({
            success: true,
            message: "Ad updated successfully",
            data: updatedAd
        });

    } catch (error) {
        console.error("Error updating ad:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while updating ad",
            error: error.message
        });
    }
};

// Delete Ad
const deleteAd = async (req, res) => {
    try {
        const { id } = req.params;
        const user_id = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid ad ID"
            });
        }

        const ad = await Ads.findOne({ _id: id, user_id });
        if (!ad) {
            return res.status(404).json({
                success: false,
                message: "Ad not found"
            });
        }

        // Only allow deletion if status is waiting_payment, paused, payment_failed or canceled
        if (ad.status === 'active' || ad.status === 'completed') {
            return res.status(400).json({
                success: false,
                message: "Can only delete ads with waiting_payment, paused, payment_failed or canceled status"
            });
        }

        await Ads.findByIdAndDelete(id);

        return res.status(200).json({
            success: true,
            message: "Ad deleted successfully"
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

// Get Ads by Status
const getAdsByStatus = async (req, res) => {
    try {
        const { status } = req.params;
        const user_id = req.user._id;
        const { page = 1, limit = 10 } = req.query;

        if (!['active', 'paused', 'completed', 'waiting_payment', 'pending_review'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status"
            });
        }

        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        const filter = { user_id: new mongoose.Types.ObjectId(user_id), status };

        const ads = await Ads.aggregate([
            { $match: filter },
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
            { $sort: { created_at: -1 } },
            { $skip: skip },
            { $limit: limitNum }
        ]);

        const totalDocs = await Ads.countDocuments({ user_id, status });
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
            message: `${status} ads retrieved successfully`,
            data: paginationData
        });

    } catch (error) {
        console.error("Error getting ads by status:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while retrieving ads",
            error: error.message
        });
    }
};

// Update Ad Status
const updateAdStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const user_id = req.user._id;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid ad ID"
            });
        }

        if (!['active', 'paused', 'completed'].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status"
            });
        }

        const ad = await Ads.findOne({ _id: id, user_id });
        if (!ad) {
            return res.status(404).json({
                success: false,
                message: "Ad not found"
            });
        }

        // Update only the status
        const updatedAd = await Ads.findByIdAndUpdate(
            id,
            { status },
            { new: true }
        );

        return res.status(200).json({
            success: true,
            message: "Ad status updated successfully",
            data: updatedAd
        });

    } catch (error) {
        console.error("Error updating ad status:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while updating ad status",
            error: error.message
        });
    }
};

// Get Posts Available for Ads
const getPostsAvailableForAds = async (req, res) => {
    try {
        const user_id = req.user._id;

        // Get posts with media
        const postsWithMedia = await Post.aggregate([
            {
                $match: {
                    user_id: new mongoose.Types.ObjectId(user_id),
                    is_deleted: false,
                    type: "Public"
                }
            },
            {
                $lookup: {
                    from: 'postmedias',
                    localField: '_id',
                    foreignField: 'post_id',
                    as: 'post_media',
                    pipeline: [
                        {
                            $match: {
                                type: 'post'
                            }
                        }
                    ]
                }
            },
            {
                $match: {
                    'post_media.0': { $exists: true }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: 'user_id',
                    foreignField: '_id',
                    as: 'author',
                    pipeline: [
                        { $project: { username: 1, fullName: 1, avatar_url: 1 } }
                    ]
                }
            },
            {
                $lookup: {
                    from: 'postmedias',
                    localField: '_id',
                    foreignField: 'post_id',
                    as: 'media_data',
                    pipeline: [
                        {
                            $match: {
                                type: 'post'
                            }
                        },
                        {
                            $lookup: {
                                from: 'media',
                                localField: 'media_id',
                                foreignField: '_id',
                                as: 'media_files'
                            }
                        }
                    ]
                }
            },
            {
                $addFields: {
                    author: { $arrayElemAt: ['$author', 0] },
                    media: {
                        $reduce: {
                            input: '$media_data',
                            initialValue: [],
                            in: {
                                $concatArrays: [
                                    '$$value',
                                    {
                                        $map: {
                                            input: '$$this.media_files',
                                            as: 'media',
                                            in: {
                                                url: '$$media.url',
                                                type: '$$media.media_type'
                                            }
                                        }
                                    }
                                ]
                            }
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 1,
                    content: 1,
                    type: 1,
                    createdAt: 1,
                    updatedAt: 1,
                    author: 1,
                    media: 1
                }
            },
            {
                $sort: { createdAt: -1 }
            }
        ]);

        // Get post IDs that have ads with status other than 'completed' and 'canceled' 
        const postsWithActiveAds = await Ads.find({
            user_id: new mongoose.Types.ObjectId(user_id),
            status: { $ne: 'completed', $ne: 'canceled' }
        }).distinct('post_id');

        // Filter out posts that have active ads
        const availablePosts = postsWithMedia.filter(post =>
            !postsWithActiveAds.some(adPostId =>
                adPostId.toString() === post._id.toString()
            )
        );

        return res.status(200).json({
            success: true,
            message: "Posts available for ads retrieved successfully",
            data: availablePosts
        });

    } catch (error) {
        console.error("Error getting posts available for ads:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while retrieving posts",
            error: error.message
        });
    }
};

// Increment ad view count
const incrementAdView = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid ad ID"
            });
        }

        const ad = await Ads.findById(id);
        if (!ad) {
            return res.status(404).json({
                success: false,
                message: "Ad not found"
            });
        }

        // Only increment if ad is active
        if (ad.status !== 'active') {
            return res.status(400).json({
                success: false,
                message: "Can only increment views for active ads"
            });
        }

        // Increment current_views
        ad.current_views += 1;

        // Check if target is reached
        if (ad.current_views >= ad.target_views) {
            ad.status = 'completed';
            ad.completed_at = new Date();
        }

        await ad.save();

        return res.status(200).json({
            success: true,
            message: "Ad view incremented successfully",
            data: {
                current_views: ad.current_views,
                target_views: ad.target_views,
                status: ad.status,
                progress_percentage: (ad.current_views / ad.target_views) * 100
            }
        });

    } catch (error) {
        console.error("Error incrementing ad view:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while incrementing view",
            error: error.message
        });
    }
};

// Get interaction statistics by date/week for chart
const getInteractionStats = async (req, res) => {
    try {
        const userId = req.user._id;
        const { ads_id } = req.params;
        const { period = 'day', days = 7 } = req.query;

        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid user ID"
            });
        }

        if (!mongoose.Types.ObjectId.isValid(ads_id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid ads ID"
            });
        }

        // Validate period
        if (!['day', 'week'].includes(period)) {
            return res.status(400).json({
                success: false,
                message: "Period must be 'day' or 'week'"
            });
        }

        const daysBack = parseInt(days) || 7;
        if (daysBack < 1 || daysBack > 365) {
            return res.status(400).json({
                success: false,
                message: "Days must be between 1 and 365"
            });
        }

        // Find the specific ad and check ownership
        const ad = await Ads.findOne({
            _id: ads_id,
            user_id: userId
        }).select('post_id');

        if (!ad) {
            return res.status(404).json({
                success: false,
                message: "Ad not found or you don't have permission to view it"
            });
        }

        // Calculate date range
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - daysBack);

        let groupBy, dateFormat;

        if (period === 'day') {
            groupBy = {
                year: { $year: "$createdAt" },
                month: { $month: "$createdAt" },
                day: { $dayOfMonth: "$createdAt" }
            };
            dateFormat = "%Y-%m-%d";
        } else {
            groupBy = {
                year: { $year: "$createdAt" },
                week: { $week: "$createdAt" }
            };
            dateFormat = "%Y-W%V";
        }

        // Get comment statistics for this specific post
        const commentStats = await Comment.aggregate([
            {
                $match: {
                    post_id: ad.post_id,
                    createdAt: { $gte: startDate, $lte: endDate },
                    isDeleted: false
                }
            },
            {
                $group: {
                    _id: groupBy,
                    count: { $sum: 1 }
                }
            },
            {
                $addFields: {
                    dateString: {
                        $dateToString: {
                            format: dateFormat,
                            date: {
                                $dateFromParts: period === 'day'
                                    ? {
                                        year: "$_id.year",
                                        month: "$_id.month",
                                        day: "$_id.day"
                                    }
                                    : {
                                        isoWeekYear: "$_id.year",
                                        isoWeek: "$_id.week"
                                    }
                            }
                        }
                    }
                }
            },
            {
                $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1, "_id.week": 1 }
            }
        ]);

        // Get reaction statistics for this specific post
        const reactionStats = await Reaction.aggregate([
            {
                $match: {
                    post_id: ad.post_id,
                    createdAt: { $gte: startDate, $lte: endDate }
                }
            },
            {
                $group: {
                    _id: groupBy,
                    count: { $sum: 1 }
                }
            },
            {
                $addFields: {
                    dateString: {
                        $dateToString: {
                            format: dateFormat,
                            date: {
                                $dateFromParts: period === 'day'
                                    ? {
                                        year: "$_id.year",
                                        month: "$_id.month",
                                        day: "$_id.day"
                                    }
                                    : {
                                        isoWeekYear: "$_id.year",
                                        isoWeek: "$_id.week"
                                    }
                            }
                        }
                    }
                }
            },
            {
                $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1, "_id.week": 1 }
            }
        ]);

        // Create a map for easy lookup
        const commentMap = new Map();
        commentStats.forEach(item => {
            commentMap.set(item.dateString, item.count);
        });

        const reactionMap = new Map();
        reactionStats.forEach(item => {
            reactionMap.set(item.dateString, item.count);
        });

        // Generate complete date range
        const result = [];
        const current = new Date(startDate);

        while (current <= endDate) {
            let dateKey;

            if (period === 'day') {
                dateKey = current.toISOString().split('T')[0]; // YYYY-MM-DD
            } else {
                const year = current.getFullYear();
                const week = getWeekNumber(current);
                dateKey = `${year}-W${week.toString().padStart(2, '0')}`;
            }

            result.push({
                date: dateKey,
                comments: commentMap.get(dateKey) || 0,
                reactions: reactionMap.get(dateKey) || 0,
                total: (commentMap.get(dateKey) || 0) + (reactionMap.get(dateKey) || 0)
            });

            // Increment date
            if (period === 'day') {
                current.setDate(current.getDate() + 1);
            } else {
                current.setDate(current.getDate() + 7);
            }
        }

        return res.status(200).json({
            success: true,
            message: `Interaction statistics for ad ${ads_id} by ${period} retrieved successfully`,
            data: {
                ads_id,
                post_id: ad.post_id,
                period,
                daysBack,
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0],
                stats: result,
                summary: {
                    totalComments: commentStats.reduce((sum, item) => sum + item.count, 0),
                    totalReactions: reactionStats.reduce((sum, item) => sum + item.count, 0),
                    totalInteractions: commentStats.reduce((sum, item) => sum + item.count, 0) +
                        reactionStats.reduce((sum, item) => sum + item.count, 0)
                }
            }
        });

    } catch (error) {
        console.error("Error getting interaction statistics:", error);
        return res.status(500).json({
            success: false,
            message: "Server error while retrieving interaction statistics",
            error: error.message
        });
    }
};

// Helper function to get week number
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}


module.exports = {
    createAds,
    getAllAds,
    getAdById,
    updateAd,
    deleteAd,
    getAdsByStatus,
    updateAdStatus,
    getPostsAvailableForAds,
    incrementAdView,
    getAllAdsByUserId,
    getAdsAnalytics,
    getInteractionStats
};