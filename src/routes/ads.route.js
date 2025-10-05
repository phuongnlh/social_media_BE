const express = require("express");
const router = express.Router();
const adsController = require("../controllers/ads.controller");
const { isLogin } = require("../middlewares/auth");

// Get posts available for ads
router.get("/available-posts", isLogin, adsController.getPostsAvailableForAds);
router.get("/activities", isLogin, adsController.getActivitiesByUserId);


router.get("/me", isLogin, adsController.getAllAdsByUserId);
router.get("/analytics", isLogin, adsController.getAdsAnalytics);
router.get("/analytic/:ads_id", isLogin, adsController.getInteractionStats);

// CRUD operations
router.post("/", isLogin, adsController.createAds);
router.get("/", isLogin, adsController.getAllAds);
router.get("/:id", isLogin, adsController.getAdById);
router.put("/:id", isLogin, adsController.updateAd);
router.delete("/:id", isLogin, adsController.deleteAd);

// Status operations
router.get("/status/:status", isLogin, adsController.getAdsByStatus);
router.patch("/:id/status", isLogin, adsController.updateAdStatus);

// Increment view count
router.post("/:id/view", isLogin, adsController.incrementAdView);

module.exports = router;
