const express = require("express");
const router = express.Router();
const passport = require("passport");
const { uploadGroup } = require("../utils/upload_utils");
const groupController = require("../controllers/group.controller");
const { isLogin } = require("../middlewares/auth");

router.post("/", isLogin, uploadGroup.array("media", 1), groupController.createGroup); // Tạo group mới
router.get("/get-groups-by-id/:user_id", isLogin, groupController.getUserGroups); // Lấy danh sách group đã tham gia theo user_id
router.get("/my-groups", isLogin, groupController.getMyGroups); // Lấy danh sách group đã tham gia
router.post("/request-join", isLogin, groupController.requestJoinGroup); // Gửi yêu cầu tham gia group
router.post("/leave", isLogin, groupController.leaveGroup); // Rời group
router.get("/get-groups", isLogin,groupController.getAllGroups); // Lấy tất cả group
router.get("/get-group/:group_id", isLogin, groupController.getGroupDetail); // Lấy thông tin group theo ID
router.get("/members/:group_id", isLogin, groupController.getGroupMembers); // Lấy danh sách thành viên

// Dành cho quản trị viên của group
router.post("/ban-member", isLogin, groupController.banMember); // Ban thành viên
router.post("/unban-member", isLogin, groupController.unbanMember); // Bỏ ban thành viên
router.post("/restrict-member", isLogin, groupController.restrictMember); // Hạn chế thành viên đăng bài
router.get("/banned-members/:group_id", isLogin, groupController.getbannedMemberList); // Lấy danh sách thành viên bị ban
router.get("/restrict-members/:group_id", isLogin, groupController.getRestrictMemberList); // Lấy danh sách thành viên bị hạn chế đăng bài
router.post("/handle-join-request/:request_id", isLogin, groupController.handleJoinRequest); // Duyệt/từ chối yêu cầu tham gia
router.get("/pending-requests/:group_id", isLogin, groupController.getPendingRequests); // Lấy danh sách người chờ duyệt
router.post("/change-role", isLogin, groupController.changeMemberRole); // Gán/hạ quyền quản trị
router.put("/update/:group_id", isLogin, uploadGroup.array("media", 1), groupController.updateGroup); // Chỉnh sửa thông tin nhóm
router.delete("/delete/:group_id", isLogin, groupController.deleteGroup); // Xóa nhóm
module.exports = router;