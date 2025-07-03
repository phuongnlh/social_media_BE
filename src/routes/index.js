const express = require("express");
const userRoutes = require("./users");
const tokenRoutes = require("./token");
const router = express.Router();

router.get("/", (req, res) => {
  res.send("Welcome To Final Assignment!");
});

router.use("/user", userRoutes);
router.use("/refresh", tokenRoutes);

router

module.exports = router;
