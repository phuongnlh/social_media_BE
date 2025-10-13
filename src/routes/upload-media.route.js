const express = require("express");
const router = express.Router();
const minioClient = require("../config/minioClient.storage");
const { isLogin } = require("../middlewares/auth");

router.post("/", isLogin, async (req, res) => {
  const userId = req.user._id;
  const { folder } = req.body; // từ FE gửi lên
  const fileName = `${folder}/${userId}/${Date.now()}`; // tạo tên file duy nhất
  try {
    const url = await minioClient.presignedPutObject(
      "dailyvibe", // tên bucket
      fileName, // tên file muốn lưu
      60 * 60 // thời gian URL tồn tại 1 giờ
    );
    const publicUrl = `https://minio.dailyvibe.online/dailyvibe/${fileName}`;
    res.json({ url, publicUrl });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Cannot generate presigned URL" });
  }
});

module.exports = router;
