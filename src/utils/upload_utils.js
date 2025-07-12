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

const groupPostStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: "group_posts",
    resource_type: "auto",
    public_id: `${Date.now()}-${file.originalname}`,
  }),
});

const upload = multer({ storage });
const uploadGroup = multer({ storage: groupPostStorage });

module.exports = {upload, uploadGroup};
