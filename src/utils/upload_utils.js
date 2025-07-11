const multer = require("multer");
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const cloudinary = require("../config/cloudinary.storage");

const storage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: "posts",
    resource_type: "auto", // auto-detect image or video
    public_id: `${Date.now()}-${file.originalname}`,
  }),
});

const uploadToCloudinary = async (base64Array) => {
  const uploads = base64Array.map((base64) =>
    cloudinary.uploader.upload(base64, {
      resource_type: "auto",
      folder: "chat_media",
    })
  );
  return Promise.all(uploads);
};

const upload = multer({ storage });

module.exports = upload;
module.exports.uploadToCloudinary = uploadToCloudinary;
