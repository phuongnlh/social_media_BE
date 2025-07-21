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

  // Create users (diverse cases)
  const user1 = await User.create({
    username: "testuser01",
    hash: "fd0b34ed15ac1ef30bdbb4d8b266f1b59c7a9d83e0f7a4d143aac3ca61438e8d769161b7cb12487d1060f5b19f8be90b0624c8d17f6207bbbf02e6b9fe3cc832",
    salt: "e40b63ac830033c77ec3b944f1230a765db50ad1983afccccf62ab66c74d3584",
    email: "testuser01@example.com",
    phone: "0123456789",
    fullName: "Test User 01",
    bio: "Hello, I'm user 01.",
    dateOfBirth: new Date("2000-01-01"),
    isActive: true,
    isPrivate: false,
    EmailVerified: true,
    PhoneVerified: true,
    isBlocked: false,
    isDeleted: false,
  });
  const user2 = await User.create({
    username: "testuser02",
    hash: "fd0b34ed15ac1ef30bdbb4d8b266f1b59c7a9d83e0f7a4d143aac3ca61438e8d769161b7cb12487d1060f5b19f8be90b0624c8d17f6207bbbf02e6b9fe3cc832",
    salt: "e40b63ac830033c77ec3b944f1230a765db50ad1983afccccf62ab66c74d3584",
    email: "testuser02@example.com",
    phone: "0987654321",
    fullName: "Test User 02",
    bio: "Hello, I'm user 02.",
    dateOfBirth: new Date("2001-02-02"),
    isActive: false,
    isPrivate: true,
    EmailVerified: false,
    PhoneVerified: false,
    isBlocked: true,
    isDeleted: false,
  });
  const user3 = await User.create({
    username: "testuser03",
    hash: "fd0b34ed15ac1ef30bdbb4d8b266f1b59c7a9d83e0f7a4d143aac3ca61438e8d769161b7cb12487d1060f5b19f8be90b0624c8d17f6207bbbf02e6b9fe3cc832",
    salt: "e40b63ac830033c77ec3b944f1230a765db50ad1983afccccf62ab66c74d3584",
    email: "testuser03@example.com",
    phone: "0111222333",
    fullName: "Test User 03",
    bio: "User 03 bio.",
    dateOfBirth: new Date("1999-03-03"),
    isActive: true,
    isPrivate: false,
    EmailVerified: true,
    PhoneVerified: false,
    isBlocked: false,
    isDeleted: true,
  });

  // Friendships (pending, accepted, declined, blocked)
  await Friendship.create({
    user_id_1: user1._id,
    user_id_2: user2._id,
    status: "accepted",
    requested_at: new Date(),
    accepted_at: new Date(),
  });
  await Friendship.create({
    user_id_1: user2._id,
    user_id_2: user3._id,
    status: "pending",
    requested_at: new Date(),
  });
  await Friendship.create({
    user_id_1: user3._id,
    user_id_2: user1._id,
    status: "declined",
    requested_at: new Date(),
  });
  await Friendship.create({
    user_id_1: user3._id,
    user_id_2: user2._id,
    status: "blocked",
    requested_at: new Date(),
  });

  // Followers (user1 follows user2, user2 follows user3, user3 follows user1)
  await Follower.create({ follower_id: user1._id, following_id: user2._id });
  await Follower.create({ follower_id: user2._id, following_id: user3._id });
  await Follower.create({ follower_id: user3._id, following_id: user1._id });

  // Media
  const media1 = await Media.create({
    user_id: user1._id,
    url: "https://placehold.co/600x400",
    media_type: "image",
  });
  const media2 = await Media.create({
    user_id: user2._id,
    url: "https://placehold.co/600x400/ff0000/ffffff",
    media_type: "image",
  });
  const media3 = await Media.create({
    user_id: user3._id,
    url: "https://placehold.co/600x400/00ff00/000000",
    media_type: "video",
  });

  // Posts (public, private, deleted)
  const post1 = await Post.create({
    user_id: user1._id,
    content: "This is a public post by user1.",
    type: "Public",
  });
  const post2 = await Post.create({
    user_id: user2._id,
    content: "This is a private post by user2.",
    type: "Private",
  });
  const post3 = await Post.create({
    user_id: user3._id,
    content: "This is a deleted post by user3.",
    type: "Public",
    is_deleted: true,
    deleted_at: new Date(),
  });

  // PostMedia
  await PostMedia.create({ type: "post", post_id: post1._id, media_id: [media1._id] });
  await PostMedia.create({ type: "post", post_id: post2._id, media_id: [media2._id] });
  await PostMedia.create({ type: "post", post_id: post3._id, media_id: [media3._id] });

  // Comments (root, reply, deleted)
  const comment1 = await Comment.create({
    user_id: user2._id,
    post_id: post1._id,
    content: "Nice post!",
  });
  const comment2 = await Comment.create({
    user_id: user1._id,
    post_id: post1._id,
    parent_comment_id: comment1._id,
    content: "Thank you!",
  });
  const comment3 = await Comment.create({
    user_id: user3._id,
    post_id: post2._id,
    content: "Interesting thoughts.",
    isDeleted: true,
    deleted_at: new Date(),
  });

  // CommentReactions
  await CommentReaction.create({ user_id: user1._id, comment_id: comment1._id, type: "like" });
  await CommentReaction.create({ user_id: user2._id, comment_id: comment2._id, type: "love" });
  await CommentReaction.create({ user_id: user3._id, comment_id: comment1._id, type: "haha" });

  // PostReactions
  await PostReaction.create({ user_id: user2._id, post_id: post1._id, type: "love" });
  await PostReaction.create({ user_id: user3._id, post_id: post1._id, type: "angry" });
  await PostReaction.create({ user_id: user1._id, post_id: post2._id, type: "sad" });

  // Notifications (read, unread, different types)
  await Notification.create({ user_id: user1._id, type: "like", content: "User2 liked your post.", is_read: false });
  await Notification.create({ user_id: user2._id, type: "comment", content: "User1 commented on your post.", is_read: true });
  await Notification.create({ user_id: user3._id, type: "friend_request", content: "User1 sent you a friend request.", is_read: false });

  // Messages (read, unread, with/without content)
  await Message.create({ from: user1._id, to: user2._id, content: "Hello!", is_read: false });
  await Message.create({ from: user2._id, to: user1._id, content: "Hi!", is_read: true });
  await Message.create({ from: user3._id, to: user1._id, content: "Hey there!", is_read: false });
  await Message.create({ from: user1._id, to: user3._id, is_read: false });

  // Groups (public, private)
  const group1 = await Group.create({
    name: "Test Group",
    description: "A group for testing.",
    cover_url: "https://placehold.co/800x200",
    privacy: "Public",
    creator: user1._id,
  });
  const group2 = await Group.create({
    name: "Private Group",
    description: "A private group.",
    cover_url: "https://placehold.co/800x200/0000ff/ffffff",
    privacy: "Private",
    creator: user2._id,
  });

  // GroupMembers (admin, member, pending)
  await GroupMember.create({ group: group1._id, user: user1._id, role: "admin", status: "approved" });
  await GroupMember.create({ group: group1._id, user: user2._id, role: "member", status: "approved" });
  await GroupMember.create({ group: group2._id, user: user2._id, role: "admin", status: "approved" });
  await GroupMember.create({ group: group2._id, user: user3._id, role: "member", status: "pending" });

  // GroupPosts (approved, pending, rejected, deleted)
  const groupPost1 = await GroupPost.create({ group_id: group1._id, user_id: user2._id, content: "Hello group!", status: "approved" });
  await GroupPost.create({ group_id: group1._id, user_id: user1._id, content: "Welcome!", status: "pending" });
  await GroupPost.create({ group_id: group2._id, user_id: user2._id, content: "Private post", status: "rejected" });
  await GroupPost.create({ group_id: group2._id, user_id: user3._id, content: "Deleted post", status: "approved", is_deleted: true, deleted_at: new Date() });

  // GroupRequests (pending, approved, rejected)
  await GroupRequest.create({ group_id: group1._id, user_id: user3._id, status: "pending", requested_at: new Date() });
  await GroupRequest.create({ group_id: group2._id, user_id: user1._id, status: "approved", requested_at: new Date(), handled_at: new Date() });
  await GroupRequest.create({ group_id: group2._id, user_id: user3._id, status: "rejected", requested_at: new Date(), handled_at: new Date() });

  console.log("Seed data created for all models!");
  await mongoose.disconnect();
}

seed();
