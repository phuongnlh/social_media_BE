const request = require('supertest');
const express = require('express');
const router = require('../routes/friend.route');
const friendController = require('../controllers/friend.controller');
const { isLogin } = require('../middlewares/auth');

// Create Express app for testing
const app = express();
app.use(express.json());
app.use('/friends', router);

// Mock the controller
jest.mock('../controllers/friend.controller');

// Mock the auth middleware
jest.mock('../middlewares/auth', () => ({
  isLogin: jest.fn((req, res, next) => {
    req.user = { _id: 'mockUserId123', id: 'mockUserId123' };
    next();
  })
}));

describe('Friend Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Request Friend --- POST /friends/friend-request', () => {
    it('should send friend request successfully', async () => {
      friendController.sendFriendRequest.mockImplementation((req, res) => {
        res.status(201).json({
          message: 'Đã gửi lời mời kết bạn',
          friendship: {
            _id: 'friendship123',
            user_id_1: 'mockUserId123',
            user_id_2: 'user456',
            status: 'pending',
            createdAt: new Date()
          }
        });
      });

      const response = await request(app)
        .post('/friends/friend-request')
        .set('Authorization', 'Bearer mockToken123')
        .send({ user_id: 'user456' });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Đã gửi lời mời kết bạn');
      expect(response.body.friendship).toHaveProperty('status', 'pending');
      expect(friendController.sendFriendRequest).toHaveBeenCalledTimes(1);
    });
  });

  describe('Unfriend --- POST /friends/unfriend', () => {
    it('should cancel friend request successfully', async () => {
      friendController.cancelFriendRequest.mockImplementation((req, res) => {
        res.status(200).json({
          message: 'Đã hủy kết bạn',
          friendship: {
            _id: 'friendship123',
            user_id_1: 'mockUserId123',
            user_id_2: 'user456',
            status: 'accepted'
          }
        });
      });

      const response = await request(app)
        .post('/friends/unfriend')
        .set('Authorization', 'Bearer mockToken123')
        .send({ user_id: 'user456' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Đã hủy kết bạn');
      expect(friendController.cancelFriendRequest).toHaveBeenCalledTimes(1);
    });
  });

  describe('Respond Friend Request --- PATCH /friends/friend-request/:friendshipId', () => {
    it('should accept friend request successfully', async () => {
      friendController.respondFriendRequest.mockImplementation((req, res) => {
        res.status(200).json({
          message: 'Đã chấp nhận lời mời kết bạn',
          friendship: {
            _id: 'friendship123',
            user_id_1: 'user456',
            user_id_2: 'mockUserId123',
            status: 'accepted',
            accepted_at: new Date()
          }
        });
      });

      const response = await request(app)
        .patch('/friends/friend-request/user456')
        .set('Authorization', 'Bearer mockToken123')
        .send({ action: 'accept' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Đã chấp nhận lời mời kết bạn');
      expect(response.body.friendship.status).toBe('accepted');
      expect(friendController.respondFriendRequest).toHaveBeenCalledTimes(1);
    });

    it('should decline friend request successfully', async () => {
      friendController.respondFriendRequest.mockImplementation((req, res) => {
        res.status(200).json({
          message: 'Đã từ chối lời mời kết bạn'
        });
      });

      const response = await request(app)
        .patch('/friends/friend-request/user456')
        .set('Authorization', 'Bearer mockToken123')
        .send({ action: 'decline' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Đã từ chối lời mời kết bạn');
      expect(friendController.respondFriendRequest).toHaveBeenCalledTimes(1);
    });
  });

  describe('Get Friends List --- GET /friends/friends/:userId', () => {
    it('should get friends list successfully', async () => {
      friendController.getFriendsList.mockImplementation((req, res) => {
        res.status(200).json([
          {
            _id: 'user1',
            fullName: 'John Doe',
            avatar_url: 'https://example.com/avatar1.jpg'
          },
          {
            _id: 'user2',
            fullName: 'Jane Smith',
            avatar_url: 'https://example.com/avatar2.jpg'
          }
        ]);
      });

      const response = await request(app)
        .get('/friends/friends/mockUserId123')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
      expect(friendController.getFriendsList).toHaveBeenCalledTimes(1);
    });
  });

  describe('Get Incoming Friend Requests --- GET /friends/friend-requests/incoming', () => {
    it('should get incoming friend requests successfully', async () => {
      friendController.getIncomingFriendRequests.mockImplementation((req, res) => {
        res.status(200).json([
          {
            _id: 'user1',
            fullName: 'John Doe',
            avatar_url: 'https://example.com/avatar1.jpg',
            createdAt: new Date()
          },
          {
            _id: 'user2',
            fullName: 'Jane Smith',
            avatar_url: 'https://example.com/avatar2.jpg',
            createdAt: new Date()
          }
        ]);
      });

      const response = await request(app)
        .get('/friends/friend-requests/incoming')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
      expect(friendController.getIncomingFriendRequests).toHaveBeenCalledTimes(1);
    });
  });

  describe('Withdraw Friend Request --- DELETE /friends/friend-request/withdraw', () => {
    it('should withdraw friend request successfully', async () => {
      friendController.withdrawFriendRequest.mockImplementation((req, res) => {
        res.status(200).json({
          message: 'Đã thu hồi lời mời kết bạn',
          friendship: {
            _id: 'friendship123',
            user_id_1: 'mockUserId123',
            user_id_2: 'user456',
            status: 'pending'
          }
        });
      });

      const response = await request(app)
        .delete('/friends/friend-request/withdraw')
        .set('Authorization', 'Bearer mockToken123')
        .send({ friendId: 'user456' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Đã thu hồi lời mời kết bạn');
      expect(friendController.withdrawFriendRequest).toHaveBeenCalledTimes(1);
    });
  });

  describe('Get Friends Count --- GET /friends/friends/count/:userId', () => {
    it('should count friends successfully', async () => {
      friendController.countFriends.mockImplementation((req, res) => {
        res.status(200).json(25);
      });

      const response = await request(app)
        .get('/friends/friends/count/mockUserId123')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(typeof response.body).toBe('number');
      expect(response.body).toBe(25);
      expect(friendController.countFriends).toHaveBeenCalledTimes(1);
    });
  });
});