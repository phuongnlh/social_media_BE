// minioClient.js
const Minio = require("minio");

const minioClient = new Minio.Client({
  endPoint: "minio.dailyvibe.online", // domain MinIO
  port: 443,                         // nếu dùng SSL
  useSSL: true,
  accessKey: process.env.MINIO_ACCESS_KEY,
  secretKey: process.env.MINIO_SECRET_KEY
});

module.exports = minioClient;
