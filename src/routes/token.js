const express = require("express");
const router = express.Router();

const { isLogin } = require("../middlewares/auth");
const { refreshAccessToken } = require("../controllers/token.controller");

router.get("/", refreshAccessToken);

module.exports = router;
