const express = require("express");
const router = express.Router();
const adsController = require("../controllers/ads.controller");
const { isLogin } = require("../middlewares/auth");

//get getPostsAvailableForAds
router.get("/available-posts", isLogin, adsController.getPostsAvailableForAds);

router.post("/", isLogin, adsController.createAds);
router.get("/", isLogin, adsController.getAllAds);
router.get("/:id", isLogin, adsController.getAdById);
router.put("/:id", isLogin, adsController.updateAd);
router.delete("/:id", isLogin, adsController.deleteAd);

module.exports = router;
