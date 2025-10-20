const mongoose = require("mongoose");
const dotenv = require("dotenv");
const { faker } = require("@faker-js/faker");

const User = require("../models/user.model.js");
const Post = require("../models/post.model.js");

dotenv.config();
console.log("🔍 Mongo URI =", process.env.DB_STRING);

mongoose.connect(process.env.DB_STRING);

async function seedRealData() {
  try {
    console.log("🚀 Bắt đầu seed dữ liệu...");

    await User.deleteMany({});
    await Post.deleteMany({});

    //USER
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

    // POSTS
    const sampleCaptions = [
      "The weather is so nice today, who wants to go for coffee ☕",
      "Let's chill with friends on the weekend 🍻",
      "Sometimes just a cup of tea is enough 🍵",
      "Traveling alone is also fun ✈️",
      "Love the feeling of watching the sunset 🌇",
      "It's been a long time since I visited my hometown ❤️",
      "Tried a new dish, the result... was pretty good 😋",
      "Thank you everyone for wishing me a happy birthday 🎂",
      "My team just completed a deadline 🎉",
      "A long day at work, now I just want to sleep 😴",
      "Learning a new skill, hope to be successful 💡",
      "I just finished reading a really good book 📚",
      "Welcome the new month with lots of positive energy 🌻",
    ];

    // Ảnh
    const imageThemes = {
      cafe: [
        "https://images.unsplash.com/photo-1511920170033-f8396924c348?w=900",
        "https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=900",
        "https://images.unsplash.com/photo-1498804103079-a6351b050096?w=900",
      ],
      travel: [
        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=900",
        "https://images.unsplash.com/photo-1500534623283-312aade485b7?w=900",
        "https://images.unsplash.com/photo-1491553895911-0055eca6402d?w=900",
      ],
      food: [
        "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=900",
        "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=900",
        "https://images.unsplash.com/photo-1498579809087-ef1e558fd1da?w=900",
      ],
      work: [
        "https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=900",
        "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=900",
        "https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=900",
      ],
      study: [
        "https://images.unsplash.com/photo-1519681393784-d120267933ba?w=900",
        "https://images.unsplash.com/photo-1503676260728-1c00da094a0b?w=900",
        "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f?w=900",
      ],
    };

    function getImageForCaption(caption) {
      const lower = caption.toLowerCase();
      if (lower.includes("cà phê") || lower.includes("trà"))
        return faker.helpers.arrayElement(imageThemes.cafe);
      if (lower.includes("du lịch") || lower.includes("quê"))
        return faker.helpers.arrayElement(imageThemes.travel);
      if (
        lower.includes("ăn") ||
        lower.includes("món") ||
        lower.includes("sinh nhật")
      )
        return faker.helpers.arrayElement(imageThemes.food);
      if (lower.includes("deadline") || lower.includes("team"))
        return faker.helpers.arrayElement(imageThemes.work);
      if (lower.includes("học") || lower.includes("sách"))
        return faker.helpers.arrayElement(imageThemes.study);
      return faker.helpers.arrayElement([
        ...imageThemes.cafe,
        ...imageThemes.travel,
        ...imageThemes.food,
      ]);
    }

    const posts = [];

    for (const user of createdUsers) {
      const numberOfPosts = faker.number.int({ min: 3, max: 5 });

      for (let i = 0; i < numberOfPosts; i++) {
        const randomCaption = faker.helpers.arrayElement(sampleCaptions);
        const postType = faker.helpers.arrayElement([
          "text+image",
          "text-only",
          "image-only",
        ]);

        const post = {
          user_id: user._id,
          content: postType === "image-only" ? "" : randomCaption,
          media_url:
            postType === "text-only" ? null : getImageForCaption(randomCaption),
          type: faker.helpers.arrayElement(["Public", "Private"]),
          viewCount: faker.number.int({ min: 100, max: 10000 }),
          is_deleted: false,
        };
        posts.push(post);
      }
    }

    // tạo các bài gốc
    const createdPosts = await Post.insertMany(posts);
    // tạo các bài share
    const sharePosts = [];

    for (const user of createdUsers) {
      // Xác suất 15% người dùng share bài
      if (faker.datatype.boolean({ probability: 0.15 })) {
        const randomSharedPost = faker.helpers.arrayElement(createdPosts);

        sharePosts.push({
          user_id: user._id,
          shared_post_id: randomSharedPost._id,
          content: faker.helpers.arrayElement([
            "This article is so good, I have to share it right away 🔁",
            "I really sympathize with this article ❤️",
            "I found it interesting so I shared it for everyone to read 📢",
            "A thoughtful point of view 👀",
            "This article is very suitable for my mood 😅",
          ]),
          type: "Public",
          viewCount: faker.number.int({ min: 50, max: 3000 }),
        });
      }
    }

    await Post.insertMany(sharePosts);

    console.log(`✅ Đã tạo ${createdPosts.length} bài post gốc!`);
    console.log(`✅ Đã tạo thêm ${sharePosts.length} bài share post!`);
    console.log("🎉 Seed dữ liệu thật hoàn tất!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Lỗi khi seed dữ liệu thật:", error);
    process.exit(1);
  }
}

seedRealData();
