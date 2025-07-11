const express = require("express");
const userRoutes = require("./users");
const tokenRoutes = require("./token");
const postRoutes = require("./post.route");
const friendRoutes = require("./friend.route");
const notificationRoutes = require("./notification.route");
const router = express.Router();

router.get("/", (req, res) => {
  res.send("Welcome To Final Assignment!");
});

router.use("/user", userRoutes);
router.use("/refresh", tokenRoutes);
router.use("/post", postRoutes);
router.use("/", friendRoutes);
router.use("/notifications", notificationRoutes);

module.exports = router;
