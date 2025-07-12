const express = require("express");
const userRoutes = require("./users");
const tokenRoutes = require("./token");
const postRoutes = require("./post.route");
const commentRoutes = require("./comment.route");
const groupRoutes = require("./group.route");
const groupPostRoutes = require("./group_post.route");
const router = express.Router();

router.get("/", (req, res) => {
  res.send("Welcome To Final Assignment!");
});

router.use("/user", userRoutes);
router.use("/refresh", tokenRoutes);
router.use("/post", postRoutes);
router.use("/comment", commentRoutes);
router.use("/group", groupRoutes);
router.use("/group-post", groupPostRoutes);


module.exports = router;
