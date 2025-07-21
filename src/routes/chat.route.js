const express = require("express");
const router = express.Router();
const { isLogin } = require("../middlewares/auth");
const chatController = require("../controllers/chat.controller");

router.get("/chat-list", isLogin, chatController.getChatList);
router.get("/messages/:userId", isLogin, chatController.getMessagesWithUser);

module.exports = router;