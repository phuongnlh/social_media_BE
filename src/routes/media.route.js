const express = require("express");
const { 
  getUserImages, 
  getUserVideos, 
  getUserAllMedia, 
  getUserMediaStats 
} = require("../controllers/media.controller");
const { isLogin } = require("../middlewares/auth");

const router = express.Router();

/**
 * @route GET /api/media/user/:user_id/images
 * @desc Lấy tất cả hình ảnh của user
 * @access Private
 * @params user_id: ID của user
 * @query page: Số trang (default: 1)
 * @query limit: Số lượng items per page (default: 20)
 */
router.get("/user/:user_id/images", isLogin, getUserImages);

/**
 * @route GET /api/media/user/:user_id/videos
 * @desc Lấy tất cả video của user
 * @access Private
 * @params user_id: ID của user
 * @query page: Số trang (default: 1)
 * @query limit: Số lượng items per page (default: 20)
 */
router.get("/user/:user_id/videos", isLogin, getUserVideos);

/**
 * @route GET /api/media/user/:user_id/all
 * @desc Lấy tất cả media (images + videos) của user
 * @access Private
 * @params user_id: ID của user
 * @query page: Số trang (default: 1)
 * @query limit: Số lượng items per page (default: 20)
 */
router.get("/user/:user_id/all", isLogin, getUserAllMedia);

/**
 * @route GET /api/media/user/:user_id/stats
 * @desc Lấy thống kê media của user
 * @access Private
 * @params user_id: ID của user
 */
router.get("/user/:user_id/stats", isLogin, getUserMediaStats);

module.exports = router;
