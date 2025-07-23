const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary.storage");
const streamifier = require("streamifier");

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: "posts",
    resource_type: "auto", // auto-detect image or video
    public_id: `${Date.now()}-${file.originalname}`,
  }),
});

const groupPostStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: "group_posts",
    resource_type: "auto",
    public_id: `${Date.now()}-${file.originalname}`,
  }),
});

const uploadToCloudinary = (buffers) => {
  // Hàm này giờ trả về một Promise chứa mảng các kết quả upload
  return Promise.all(
    buffers.map((buffer) => {
      return new Promise((resolve, reject) => {
        // Tạo một stream upload lên Cloudinary
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            // Tùy chọn: bạn có thể thêm folder, tag... ở đây
            folder: "chat_media",
          },
          (error, result) => {
            if (error) {
              // Nếu có lỗi, reject Promise
              return reject(error);
            }
            // Nếu thành công, resolve Promise với kết quả
            resolve(result);
          }
        );

        // Chuyển buffer thành stream và pipe vào stream upload của Cloudinary
        streamifier.createReadStream(buffer).pipe(uploadStream);
      });
    })
  );
};

const upload = multer({ storage });
const uploadGroup = multer({ storage: groupPostStorage });

module.exports = { upload, uploadGroup };
module.exports.uploadToCloudinary = uploadToCloudinary;
