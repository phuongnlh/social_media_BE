const mongoose = require("mongoose");
const dotenv = require("dotenv");
const { faker } = require("@faker-js/faker");

// Import models
const User = require("../models/user.model.js");
const Post = require("../models/post.model.js");

// Load biến môi trường từ .env
dotenv.config();
console.log("🔍 Mongo URI =", process.env.DB_STRING);

mongoose.connect(process.env.DB_STRING);

async function seedRealData() {
  try {
    console.log("🚀 Bắt đầu seed dữ liệu...");

    await User.deleteMany({});
    await Post.deleteMany({});

    // user
    const users = [];
    for (let i = 0; i < 50; i++) {
      let username = faker.internet.username().toLowerCase();

      if (username.length < 8) {
        username += faker.string.alphanumeric(8 - username.length);
      }

      const user = {
        username,
        hash: faker.internet.password(),
        salt: faker.string.alphanumeric(16),
        email: faker.internet.email().toLowerCase(),
        phone: faker.phone.number("+84#########"),
        fullName: faker.person.fullName(),
        bio: faker.lorem.sentence(),
        dateOfBirth: faker.date.birthdate({ min: 18, max: 45, mode: "age" }),
        location: faker.location.city(),
        gender: faker.helpers.arrayElement(["male", "female", "other"]),
        avatar_url: faker.image.avatar(),
        cover_photo_url: faker.image.urlPicsumPhotos({
          width: 900,
          height: 300,
        }),
        isActive: true,
        isPrivate: faker.datatype.boolean({ probability: 0.2 }),
        EmailVerified: faker.datatype.boolean({ probability: 0.6 }),
        PhoneVerified: faker.datatype.boolean({ probability: 0.4 }),
        isBlocked: false,
        isDeleted: false,
      };

      users.push(user);
    }

    const createdUsers = await User.insertMany(users);
    console.log(`✅ Đã tạo ${createdUsers.length} user!`);

    // POST
    const posts = [];
    for (const user of createdUsers) {
      const numberOfPosts = faker.number.int({ min: 3, max: 5 });
      for (let i = 0; i < numberOfPosts; i++) {
        const post = {
          user_id: user._id,
          content: faker.lorem.paragraphs({ min: 1, max: 2 }),
          type: faker.helpers.arrayElement(["Public", "Private"]),
          viewCount: faker.number.int({ min: 50, max: 10000 }),
          is_deleted: false,
        };

        // 20% bài có thể là “share post”
        if (faker.datatype.boolean({ probability: 0.2 }) && posts.length > 0) {
          post.shared_post_id = faker.helpers.arrayElement(posts)._id;
        }

        posts.push(post);
      }
    }

    const createdPosts = await Post.insertMany(posts);
    console.log(`✅ Đã tạo ${createdPosts.length} bài post!`);

    console.log("🎉 Seed dữ liệu hoàn tất!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Lỗi khi seed dữ liệu:", error);
    process.exit(1);
  }
}

seedRealData();
