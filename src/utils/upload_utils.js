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

// Cấu hình storage cho avatar đơn giản hơn
const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: "avatars",
    resource_type: "auto",
    public_id: `avatar-${Date.now()}-${req.user._id}`,
  }),
});

const uploadToCloudinary = (buffers) => {
  return Promise.all(
    buffers.map((buffer) => {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            resource_type: "auto",
            folder: "chat_media",
          },
          (error, result) => {
            if (error) return reject(error);
            resolve(result);
          }
        );
        streamifier.createReadStream(buffer).pipe(uploadStream);
      });
    })
  );
};

const upload = multer({ storage });
const uploadGroup = multer({ storage: groupPostStorage });
const uploadAvatar = multer({ storage: avatarStorage });

module.exports = { upload, uploadGroup, uploadAvatar, uploadToCloudinary };
