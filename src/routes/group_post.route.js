const express = require("express");
const router = express.Router();
const passport = require("passport");
const { uploadGroup } = require("../utils/upload_utils");
const groupPostController = require("../controllers/post-group.controller");
const { isLogin } = require("../middlewares/auth");

router.post("/reaction", isLogin, groupPostController.reactToGroupPost); // Tạo hoặc cập nhật reaction của user với group post
router.delete("/reaction", isLogin, groupPostController.removeGroupPostReaction); // Xoá reaction của user với group post
router.post("/user-reactions", isLogin, groupPostController.getUserReactionsForGroupPosts); // Lấy reaction của user với nhiều group post (có thể truyền 1 hoặc nhiều postgr_ids)

router.get("/feed", isLogin, groupPostController.getGroupFeed); // Lấy feed bài viết từ tất cả group mà user đã tham gia
router.post("/share", isLogin, groupPostController.shareGroupPostToWall); // Chia sẻ bài viết trong group lên tường cá nhân
router.get("/reactions/:postgr_id", isLogin, groupPostController.getReactionsOfGroupPost); // Lấy tất cả reaction của group post
router.post('/report/:post_id', isLogin, groupPostController.reportGroupPost); // Báo cáo bài viết trong group
router.patch("/:post_id/restore", isLogin, groupPostController.restoreGroupPost); // Khôi phục bài viết đã xoá

//Dành cho quản trị viên của group
router.get("/:group_id/pending", isLogin, groupPostController.getPendingPostsInGroup); // Lấy danh sách bài viết chờ duyệt trong group
router.post("/:post_id/approve", isLogin, groupPostController.approveGroupPost); // Duyệt bài viết trong group
router.get('/:post_id/reports', isLogin, groupPostController.getReportsForPost); // Lấy danh sách báo cáo cho một bài viết cụ thể
router.get('/:group_id/reported-posts', isLogin, groupPostController.getReportedPostsInGroup); // Lấy danh sách bài viết đã báo cáo trong group (Trên 5)
router.patch('/:post_id/reported-handler', isLogin, groupPostController.handleGroupPostReport); // Xử lý report
//Hết dành cho quản trị viên

router.patch("/:id/views", groupPostController.increaseViewCount); // Tăng view count cho bài viết trong group
router.patch("/:post_id/soft-delete", isLogin, groupPostController.softDeleteGroupPost); // Xoá bài viết trong group (chỉ đánh dấu là đã xoá)
router.post("/", isLogin, uploadGroup.array("media", 10), groupPostController.createGroupPost); // Tạo bài viết trong group
router.get("/:group_id/:post_id", isLogin, groupPostController.getGroupPostById); // Lấy bài viết theo ID
router.get("/:group_id", isLogin, groupPostController.getAllPostsInGroup); // Lấy tất cả bài viết trong group
router.put("/:post_id", isLogin, groupPostController.updateGroupPost); // Cập nhật bài viết trong group

module.exports = router;