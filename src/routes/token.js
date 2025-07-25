const express = require("express");
const router = express.Router();

const { refreshAccessToken } = require("../controllers/token.controller");

router.post("/", refreshAccessToken);

module.exports = router;
