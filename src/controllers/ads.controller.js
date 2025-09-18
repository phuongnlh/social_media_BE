const mongoose = require("mongoose");
const Ads = require("../models/Payment_Ads/ads.model");
const Post = require("../models/post.model");
const Payment = require("../models/Payment_Ads/payment.model");

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

        // Validate target_views
        const targetViewsNum = parseInt(target_views);
        if (isNaN(targetViewsNum) || targetViewsNum < 1) {
            return res.status(400).json({ success: false, message: "target_views must be a positive number" });
        }

        if (!["male", "female", "other", "all"].includes(String(target_gender))) {
            return res.status(400).json({ success: false, message: "Invalid target gender" });
        }
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
            target_age: String(target_age).trim(),
            target_gender: String(target_gender),
            target_views: targetViewsNum,
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
                    .select("method amount currency status")
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

        // Aggregate ads data with payment information
        const analyticsData = await Ads.aggregate([
            {
                $match: { user_id: userId }
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
                $group: {
                    _id: null,
                    totalSpend: {
                        $sum: {
                            $cond: [
                                { $gt: [{ $size: '$payment' }, 0] },
                                { $arrayElemAt: ['$payment.amount', 0] },
                                0
                            ]
                        }
                    },
                    totalReach: { $sum: '$current_views' },
                    activeAdsCount: {
                        $sum: {
                            $cond: [
                                { $eq: ['$status', 'active'] },
                                1,
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        const result = analyticsData.length > 0 ? analyticsData[0] : {
            totalSpend: 0,
            totalReach: 0,
            activeAdsCount: 0
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
            target_views
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
            updates.target_location = String(target_location).trim();
        }

        if (target_age !== undefined) {
            updates.target_age = String(target_age).trim();
        }

        if (target_gender !== undefined) {
            if (!['male', 'female', 'other', 'all'].includes(target_gender)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid target gender"
                });
            }
            updates.target_gender = target_gender;
        }

        if (target_views !== undefined) {
            const targetViewsNum = parseInt(target_views);
            if (isNaN(targetViewsNum) || targetViewsNum < 1) {
                return res.status(400).json({
                    success: false,
                    message: "target_views must be a positive number"
                });
            }
            updates.target_views = targetViewsNum;
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

        // Only allow deletion if status is waiting_payment
        if (ad.status !== 'waiting_payment') {
            return res.status(400).json({
                success: false,
                message: "Can only delete ads with waiting_payment status"
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

        // Get post IDs that have ads with status other than 'completed'
        const postsWithActiveAds = await Ads.find({
            user_id: new mongoose.Types.ObjectId(user_id),
            status: { $ne: 'completed' }
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
    getAdsAnalytics
};