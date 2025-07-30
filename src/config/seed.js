// Seed script for all models
const mongoose = require("mongoose");
const User = require("../models/user.model");
const Post = require("../models/post.model");
const Notification = require("../models/notification.model");
const Follower = require("../models/follower.model");
const Friendship = require("../models/friendship.model");
const Media = require("../models/media.model");
const Message = require("../models/message.model");
const PostMedia = require("../models/postMedia.model");
const Comment = require("../models/Comment_Reaction/comment.model");
const CommentReaction = require("../models/Comment_Reaction/comment_reactions.model");
const PostReaction = require("../models/Comment_Reaction/post_reaction.model");
const Group = require("../models/Group/group.model");
const GroupMember = require("../models/Group/group_member.model");
const GroupPost = require("../models/Group/group_post.model");
const GroupRequest = require("../models/Group/group_request.model");

async function seed() {
  await mongoose.connect("mongodb://localhost:27017/final");

  // Clear all collections
  await Promise.all([
    User.deleteMany({}),
    Post.deleteMany({}),
    Notification.deleteMany({}),
    Follower.deleteMany({}),
    Friendship.deleteMany({}),
    Media.deleteMany({}),
    Message.deleteMany({}),
    PostMedia.deleteMany({}),
    Comment.deleteMany({}),
    CommentReaction.deleteMany({}),
    PostReaction.deleteMany({}),
    Group.deleteMany({}),
    GroupMember.deleteMany({}),
    GroupPost.deleteMany({}),
    GroupRequest.deleteMany({}),
  ]);

  // Create users with realistic data
  const user1 = await User.create({
    username: "minh_nguyen98",
    hash: "fd0b34ed15ac1ef30bdbb4d8b266f1b59c7a9d83e0f7a4d143aac3ca61438e8d769161b7cb12487d1060f5b19f8be90b0624c8d17f6207bbbf02e6b9fe3cc832",
    salt: "e40b63ac830033c77ec3b944f1230a765db50ad1983afccccf62ab66c74d3584",
    email: "demo1@gmail.com",
    phone: "0987654321",
    fullName: "Nguyễn Văn Minh",
    bio: "🎓 Student at UIT | 💻 Web Developer | ☕ Coffee lover | 📍 Hồ Chí Minh",
    dateOfBirth: new Date("1998-05-15"),
    isActive: true,
    isPrivate: false,
    EmailVerified: true,
    PhoneVerified: true,
    isBlocked: false,
    isDeleted: false,
  });

  const user2 = await User.create({
    username: "linh_pham_design",
    hash: "fd0b34ed15ac1ef30bdbb4d8b266f1b59c7a9d83e0f7a4d143aac3ca61438e8d769161b7cb12487d1060f5b19f8be90b0624c8d17f6207bbbf02e6b9fe3cc832",
    salt: "e40b63ac830033c77ec3b944f1230a765db50ad1983afccccf62ab66c74d3584",
    email: "demo2@gmail.com",
    phone: "0912345678",
    fullName: "Phạm Thị Linh",
    bio: "🎨 UI/UX Designer | 🌸 Nature lover | 📚 Always learning | ✨ Creative soul",
    dateOfBirth: new Date("1999-12-22"),
    isActive: true,
    isPrivate: true,
    EmailVerified: true,
    PhoneVerified: false,
    isBlocked: false,
    isDeleted: false,
  });

  const user3 = await User.create({
    username: "duc_le_travel",
    hash: "fd0b34ed15ac1ef30bdbb4d8b266f1b59c7a9d83e0f7a4d143aac3ca61438e8d769161b7cb12487d1060f5b19f8be90b0624c8d17f6207bbbf02e6b9fe3cc832",
    salt: "e40b63ac830033c77ec3b944f1230a765db50ad1983afccccf62ab66c74d3584",
    email: "duc.le.travel@yahoo.com",
    phone: "0928765432",
    fullName: "Lê Minh Đức",
    bio: "✈️ Travel enthusiast | 📸 Photography | 🏔️ Adventure seeker | 🌍 Exploring Vietnam",
    dateOfBirth: new Date("1997-08-10"),
    isActive: true,
    isPrivate: false,
    EmailVerified: true,
    PhoneVerified: true,
    isBlocked: false,
    isDeleted: false,
  });

  const user4 = await User.create({
    username: "hoa_tran_chef",
    hash: "fd0b34ed15ac1ef30bdbb4d8b266f1b59c7a9d83e0f7a4d143aac3ca61438e8d769161b7cb12487d1060f5b19f8be90b0624c8d17f6207bbbf02e6b9fe3cc832",
    salt: "e40b63ac830033c77ec3b944f1230a765db50ad1983afccccf62ab66c74d3584",
    email: "hoa.tran.chef@gmail.com",
    phone: "0934567890",
    fullName: "Trần Thị Hoa",
    bio: "👩‍🍳 Home chef | 🍜 Vietnamese cuisine | 📖 Food blogger | 💕 Cooking with love",
    dateOfBirth: new Date("1995-03-28"),
    isActive: true,
    isPrivate: false,
    EmailVerified: true,
    PhoneVerified: true,
    isBlocked: false,
    isDeleted: false,
  });

  const user5 = await User.create({
    username: "quan_fitness",
    hash: "fd0b34ed15ac1ef30bdbb4d8b266f1b59c7a9d83e0f7a4d143aac3ca61438e8d769161b7cb12487d1060f5b19f8be90b0624c8d17f6207bbbf02e6b9fe3cc832",
    salt: "e40b63ac830033c77ec3b944f1230a765db50ad1983afccccf62ab66c74d3584",
    email: "quan.fitness2000@hotmail.com",
    phone: "0945678901",
    fullName: "Vũ Minh Quân",
    bio: "💪 Personal Trainer | 🏃‍♂️ Marathon runner | 🥗 Nutrition coach | 📍 Gym FitLife",
    dateOfBirth: new Date("2000-11-05"),
    isActive: false,
    isPrivate: true,
    EmailVerified: false,
    PhoneVerified: false,
    isBlocked: true,
    isDeleted: false,
  });

  // Friendships - realistic relationships
  await Friendship.create({
    user_id_1: user1._id, // Minh and Linh are friends
    user_id_2: user2._id,
    status: "accepted",
    requested_at: new Date("2024-12-15"),
    accepted_at: new Date("2024-12-16"),
  });
  await Friendship.create({
    user_id_1: user3._id, // Duc sent friend request to Hoa (pending)
    user_id_2: user4._id,
    status: "pending",
    requested_at: new Date("2025-01-10"),
  });
  await Friendship.create({
    user_id_1: user1._id, // Minh and Duc are friends
    user_id_2: user3._id,
    status: "accepted",
    requested_at: new Date("2024-11-20"),
    accepted_at: new Date("2024-11-21"),
  });
  await Friendship.create({
    user_id_1: user5._id, // Quan sent request to Linh but was declined
    user_id_2: user2._id,
    status: "declined",
    requested_at: new Date("2025-01-05"),
  });
  await Friendship.create({
    user_id_1: user4._id, // Hoa blocked Quan
    user_id_2: user5._id,
    status: "blocked",
    requested_at: new Date("2024-10-15"),
  });

  // Followers - who follows whom
  await Follower.create({ follower_id: user1._id, following_id: user3._id }); // Minh follows Duc
  await Follower.create({ follower_id: user1._id, following_id: user4._id }); // Minh follows Hoa
  await Follower.create({ follower_id: user2._id, following_id: user1._id }); // Linh follows Minh
  await Follower.create({ follower_id: user3._id, following_id: user4._id }); // Duc follows Hoa
  await Follower.create({ follower_id: user4._id, following_id: user1._id }); // Hoa follows Minh
  await Follower.create({ follower_id: user4._id, following_id: user3._id }); // Hoa follows Duc

  // Media - realistic images and videos
  const media1 = await Media.create({
    user_id: user1._id,
    url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=500&h=500&fit=crop",
    media_type: "image",
  });
  const media2 = await Media.create({
    user_id: user2._id,
    url: "https://images.unsplash.com/photo-1594736797933-d0401ba1eb65?w=500&h=500&fit=crop",
    media_type: "image",
  });
  const media3 = await Media.create({
    user_id: user3._id,
    url: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&h=600&fit=crop",
    media_type: "image",
  });
  const media4 = await Media.create({
    user_id: user4._id,
    url: "https://images.unsplash.com/photo-1565299624946-b28f40a0ca4b?w=500&h=500&fit=crop",
    media_type: "image",
  });
  const media5 = await Media.create({
    user_id: user1._id,
    url: "https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4",
    media_type: "video",
  });

  // Posts - realistic content
  const post1 = await Post.create({
    user_id: user1._id,
    content:
      "Hôm nay code xong feature mới! 💻 Cảm giác thành tựu quá! Ai cũng đang học ReactJS không? Share kinh nghiệm với mình nhé! #coding #reactjs #webdev",
    type: "Public",
  });
  const post2 = await Post.create({
    user_id: user2._id,
    content:
      "Vừa hoàn thành design cho client mới 🎨✨ Làm UI/UX thật sự là đam mê của mình. Cảm ơn team đã support nhiệt tình! #design #uiux #figma",
    type: "Public",
  });
  const post3 = await Post.create({
    user_id: user3._id,
    content:
      "Cuối tuần trekking Sapa quá tuyệt vời! 🏔️ Thời tiết mát mẻ, cảnh đẹp lung linh. Ai muốn đi cùng lần sau không? #travel #sapa #trekking #vietnam",
    type: "Public",
  });
  const post4 = await Post.create({
    user_id: user4._id,
    content:
      "Hôm nay thử làm món bún bò Huế 🍜 Hương vị đậm đà, cay nồng đúng điệu! Recipe mình sẽ share trong group nấu ăn nhé! #cooking #bunboHue #vietnamesefood",
    type: "Public",
  });
  const post5 = await Post.create({
    user_id: user2._id,
    content:
      "Buổi sáng productive với một tách cà phê ☕ và playlist lofi chill. Ready cho một ngày mới đầy năng lượng! 💪",
    type: "Private",
  });
  const post6 = await Post.create({
    user_id: user5._id,
    content: "Post này đã bị xóa do vi phạm community guidelines...",
    type: "Public",
    is_deleted: true,
    deleted_at: new Date("2025-01-20"),
  });

  // PostMedia - link posts with media
  await PostMedia.create({
    type: "post",
    post_id: post1._id,
    media_id: [media1._id],
  }); // Minh's coding post with his avatar
  await PostMedia.create({
    type: "post",
    post_id: post2._id,
    media_id: [media2._id],
  }); // Linh's design post with design image
  await PostMedia.create({
    type: "post",
    post_id: post3._id,
    media_id: [media3._id],
  }); // Duc's travel post with mountain view
  await PostMedia.create({
    type: "post",
    post_id: post4._id,
    media_id: [media4._id],
  }); // Hoa's cooking post with food image
  await PostMedia.create({
    type: "post",
    post_id: post1._id,
    media_id: [media5._id],
  }); // Minh's post also has a coding video

  // Comments - realistic interactions
  const comment1 = await Comment.create({
    user_id: user2._id, // Linh comments on Minh's coding post
    post_id: post1._id,
    content:
      "Wow code đẹp quá! Mình cũng đang học React, có thể xin tips không? 😊",
  });
  const comment2 = await Comment.create({
    user_id: user1._id, // Minh replies to Linh's comment
    post_id: post1._id,
    parent_comment_id: comment1._id,
    content:
      "Cảm ơn bạn! Mình sẽ share tài liệu trong group nhé. Cùng học hỏi! 💪",
  });
  const comment3 = await Comment.create({
    user_id: user3._id, // Duc comments on Hoa's cooking post
    post_id: post4._id,
    content: "Trời ơi nhìn ngon quá! 🤤 Lần sau về Huế mình phải thử món này!",
  });
  const comment4 = await Comment.create({
    user_id: user4._id, // Hoa replies to Duc
    post_id: post4._id,
    parent_comment_id: comment3._id,
    content:
      "Hihi cảm ơn! Bạn về Huế nhớ inbox mình, mình recommend quán ngon! 😄",
  });
  const comment5 = await Comment.create({
    user_id: user1._id, // Minh comments on Duc's travel post
    post_id: post3._id,
    content:
      "Sapa lúc này đẹp nhỉ! Mình cũng muốn đi lắm nhưng bận code quá 😅",
  });
  const comment6 = await Comment.create({
    user_id: user5._id, // Deleted comment from Quan
    post_id: post2._id,
    content: "Comment này đã bị xóa do không phù hợp...",
    isDeleted: true,
    deleted_at: new Date("2025-01-18"),
  });

  // CommentReactions - realistic reactions to comments
  await CommentReaction.create({
    user_id: user1._id,
    comment_id: comment1._id,
    type: "love",
  }); // Minh loves Linh's compliment
  await CommentReaction.create({
    user_id: user3._id,
    comment_id: comment2._id,
    type: "like",
  }); // Duc likes Minh's helpful reply
  await CommentReaction.create({
    user_id: user4._id,
    comment_id: comment3._id,
    type: "haha",
  }); // Hoa finds Duc's comment funny
  await CommentReaction.create({
    user_id: user2._id,
    comment_id: comment5._id,
    type: "like",
  }); // Linh likes Minh's travel comment
  await CommentReaction.create({
    user_id: user1._id,
    comment_id: comment4._id,
    type: "love",
  }); // Minh loves Hoa's helpful response

  // PostReactions - realistic reactions to posts
  await PostReaction.create({
    user_id: user2._id,
    post_id: post1._id,
    type: "love",
  }); // Linh loves Minh's coding post
  await PostReaction.create({
    user_id: user3._id,
    post_id: post1._id,
    type: "like",
  }); // Duc likes Minh's coding post
  await PostReaction.create({
    user_id: user4._id,
    post_id: post1._id,
    type: "like",
  }); // Hoa likes Minh's coding post
  await PostReaction.create({
    user_id: user1._id,
    post_id: post2._id,
    type: "love",
  }); // Minh loves Linh's design post
  await PostReaction.create({
    user_id: user1._id,
    post_id: post3._id,
    type: "wow",
  }); // Minh is amazed by Duc's travel photos
  await PostReaction.create({
    user_id: user2._id,
    post_id: post3._id,
    type: "love",
  }); // Linh loves Duc's travel post
  await PostReaction.create({
    user_id: user3._id,
    post_id: post4._id,
    type: "sad",
  }); // Duc finds Hoa's food delicious
  await PostReaction.create({
    user_id: user1._id,
    post_id: post4._id,
    type: "love",
  }); // Minh loves Hoa's cooking post

  // Notifications - realistic notifications
  await Notification.create({
    user_id: user1._id,
    type: "like",
    content: "Linh và 2 người khác đã thích bài viết của bạn về ReactJS",
    is_read: false,
    created_at: new Date("2025-01-25T10:30:00Z"),
  });
  await Notification.create({
    user_id: user1._id,
    type: "comment",
    content:
      "Linh đã bình luận về bài viết của bạn: 'Wow code đẹp quá! Mình cũng đang học React...'",
    is_read: true,
    created_at: new Date("2025-01-25T09:15:00Z"),
  });
  await Notification.create({
    user_id: user4._id,
    type: "friend_request",
    content: "Đức đã gửi lời mời kết bạn cho bạn",
    is_read: false,
    created_at: new Date("2025-01-22T14:20:00Z"),
  });
  await Notification.create({
    user_id: user3._id,
    type: "like",
    content: "Minh và Linh đã thích bài viết du lịch Sapa của bạn",
    is_read: true,
    created_at: new Date("2025-01-24T16:45:00Z"),
  });
  await Notification.create({
    user_id: user2._id,
    type: "follow",
    content: "Minh đã bắt đầu theo dõi bạn",
    is_read: false,
    created_at: new Date("2025-01-23T11:30:00Z"),
  });

  // Messages - realistic chat conversations
  await Message.create({
    from: user1._id,
    to: user2._id,
    content: "Chào Linh! Code ReactJS có gì khó hiểu cứ hỏi mình nhé 😊",
    is_read: true,
    created_at: new Date("2025-01-25T10:00:00Z"),
  });
  await Message.create({
    from: user2._id,
    to: user1._id,
    content:
      "Cảm ơn Minh! Mình đang bị stuck ở phần hooks, có thể giải thích không?",
    is_read: false,
    created_at: new Date("2025-01-25T10:05:00Z"),
  });
  await Message.create({
    from: user3._id,
    to: user4._id,
    content: "Hoa ơi! Mình về HCM rồi, có món gì ngon giới thiệu với! 🍜",
    is_read: true,
    created_at: new Date("2025-01-24T18:30:00Z"),
  });
  await Message.create({
    from: user4._id,
    to: user3._id,
    content: "Ôi Đức về rồi à! Chiều nay mình rảnh, đi ăn bún riêu không? 😄",
    is_read: false,
    created_at: new Date("2025-01-24T19:00:00Z"),
  });
  await Message.create({
    from: user1._id,
    to: user3._id,
    content: "Bro, ảnh Sapa đẹp quá! Lần sau đi cùng nhé 📸",
    is_read: true,
    created_at: new Date("2025-01-23T20:15:00Z"),
  });
  await Message.create({
    from: user2._id,
    to: user4._id,
    content: "Chị Hoa, em muốn học nấu ăn, có thể dạy em không? 🙏",
    is_read: false,
    created_at: new Date("2025-01-22T16:45:00Z"),
  });

  // Groups - realistic communities
  const group1 = await Group.create({
    name: "ReactJS Vietnam Developers",
    description:
      "Cộng đồng developers Việt Nam học và chia sẻ kiến thức về ReactJS. Hỏi đáp, thảo luận và chia sẻ projects! 💻⚛️",
    cover_url:
      "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800&h=200&fit=crop",
    privacy: "Public",
    creator: user1._id,
  });
  const group2 = await Group.create({
    name: "Foodie Saigon - Ẩm thực Sài Gòn",
    description:
      "Nhóm chia sẻ món ăn ngon, công thức nấu ăn và review quán ăn tại Sài Gòn. Chỉ dành cho những người yêu ẩm thực! 🍜🍲",
    cover_url:
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&h=200&fit=crop",
    privacy: "Private",
    creator: user4._id,
  });
  const group3 = await Group.create({
    name: "Travel Vietnam Together",
    description:
      "Cộng đồng yêu du lịch Việt Nam. Chia sẻ kinh nghiệm, lịch trình và tìm bạn đồng hành cho các chuyến đi! ✈️🏔️",
    cover_url:
      "https://images.unsplash.com/photo-1539650116574-75c0c6d73d1e?w=800&h=200&fit=crop",
    privacy: "Public",
    creator: user3._id,
  });

  // GroupMembers - realistic group memberships
  await GroupMember.create({
    group: group1._id,
    user: user1._id,
    role: "admin",
    status: "approved",
  }); // Minh is admin of ReactJS group
  await GroupMember.create({
    group: group1._id,
    user: user2._id,
    role: "member",
    status: "approved",
  }); // Linh joins ReactJS group
  await GroupMember.create({
    group: group1._id,
    user: user3._id,
    role: "member",
    status: "approved",
  }); // Duc joins ReactJS group

  await GroupMember.create({
    group: group2._id,
    user: user4._id,
    role: "admin",
    status: "approved",
  }); // Hoa is admin of Food group
  await GroupMember.create({
    group: group2._id,
    user: user1._id,
    role: "member",
    status: "approved",
  }); // Minh joins Food group
  await GroupMember.create({
    group: group2._id,
    user: user2._id,
    role: "member",
    status: "banned",
  }); // Linh banned in Food group

  await GroupMember.create({
    group: group3._id,
    user: user3._id,
    role: "admin",
    status: "approved",
  }); // Duc is admin of Travel group
  await GroupMember.create({
    group: group3._id,
    user: user1._id,
    role: "member",
    status: "approved",
  }); // Minh joins Travel group
  await GroupMember.create({
    group: group3._id,
    user: user4._id,
    role: "member",
    status: "approved",
  }); // Hoa joins Travel group

  // GroupPosts - realistic group content
  const groupPost1 = await GroupPost.create({
    group_id: group1._id,
    user_id: user2._id,
    content:
      "Chào mọi người! Mình mới học React, có ai có thể review code cho mình không? 🙏 #reactjs #help #learning",
    status: "approved",
  });
  await GroupPost.create({
    group_id: group1._id,
    user_id: user1._id,
    content:
      "Share một số tips tối ưu performance React app! Thread dài nên mọi người đọc từ từ nhé 🧵 #performance #optimization",
    status: "approved",
  });
  await GroupPost.create({
    group_id: group1._id,
    user_id: user3._id,
    content:
      "Ai có kinh nghiệm deploy React app lên AWS không? Mình cần tư vấn 🚀",
    status: "pending",
  });

  await GroupPost.create({
    group_id: group2._id,
    user_id: user4._id,
    content:
      "Hôm nay chia sẻ cách làm bánh mì thịt nướng authentic! Recipe trong comment 👇 #banhmi #recipe #vietnamese",
    status: "approved",
  });
  await GroupPost.create({
    group_id: group2._id,
    user_id: user1._id,
    content:
      "Quán cơm tấm ngon ở Q1, ai muốn biết địa chỉ inbox mình! 🍛 #comtam #saigonfood",
    status: "approved",
  });
  await GroupPost.create({
    group_id: group2._id,
    user_id: user5._id,
    content: "Post này vi phạm quy định group nên đã bị từ chối...",
    status: "rejected",
  });

  await GroupPost.create({
    group_id: group3._id,
    user_id: user3._id,
    content:
      "Ai muốn đi Phú Quốc tháng 3 không? Mình đang tìm bạn đồng hành! ✈️🏝️ #phuquoc #travel #findpartner",
    status: "approved",
  });
  await GroupPost.create({
    group_id: group3._id,
    user_id: user1._id,
    content: "Post đã bị xóa do spam...",
    status: "approved",
    is_deleted: true,
    deleted_at: new Date("2025-01-20"),
  });

  // GroupRequests - realistic join requests
  await GroupRequest.create({
    group_id: group2._id,
    user_id: user3._id,
    status: "pending",
    requested_at: new Date("2025-01-20T10:00:00Z"),
  }); // Duc wants to join Food group (pending)

  await GroupRequest.create({
    group_id: group2._id,
    user_id: user1._id,
    status: "approved",
    requested_at: new Date("2025-01-15T14:30:00Z"),
    handled_at: new Date("2025-01-15T15:00:00Z"),
  }); // Minh was approved to join Food group

  await GroupRequest.create({
    group_id: group2._id,
    user_id: user5._id,
    status: "rejected",
    requested_at: new Date("2025-01-10T09:15:00Z"),
    handled_at: new Date("2025-01-10T16:20:00Z"),
  }); // Quan was rejected from Food group

  await GroupRequest.create({
    group_id: group3._id,
    user_id: user2._id,
    status: "pending",
    requested_at: new Date("2025-01-25T11:30:00Z"),
  }); // Linh wants to join Travel group (pending)

  console.log(
    "✅ Seed data created successfully with realistic Vietnamese social media content!"
  );
  console.log(
    "👥 Users: Minh (dev), Linh (designer), Duc (traveler), Hoa (chef), Quan (fitness)"
  );
  console.log("📝 Posts: Coding, Design, Travel, Cooking content");
  console.log("👥 Groups: ReactJS Vietnam, Foodie Saigon, Travel Vietnam");
  console.log("💬 Messages & Comments: Natural Vietnamese conversations");
  await mongoose.disconnect();
}

seed();
