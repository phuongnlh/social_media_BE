const request = require('supertest');
const express = require('express');
const router = require('../routes/channel.route');
const channelController = require('../controllers/channel.controller');
const { isLogin } = require('../middlewares/auth');

const app = express();
app.use(express.json());
app.use('/channels', router);

// Mock the controller
jest.mock('../controllers/channel.controller');

// Mock the auth middleware
jest.mock('../middlewares/auth', () => ({
  isLogin: jest.fn((req, res, next) => {
    req.user = { 
      _id: 'mockUserId123',
      id: 'mockUserId123',
      fullName: 'John Doe'
    };
    next();
  })
}));

describe('Channel Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Create Private Channel --- POST /channels/private', () => {
    it('should create private channel successfully', async () => {
      channelController.createPrivateChannel.mockImplementation((req, res) => {
        res.status(201).json({
          success: true,
          message: 'Private channel created successfully',
          data: {
            _id: 'channel123',
            channelId: 'private-user1-user2',
            type: 'private',
            createdBy: 'mockUserId123',
            members: [
              {
                userId: {
                  _id: 'mockUserId123',
                  fullName: 'John Doe',
                  avatar_url: 'https://example.com/avatar1.jpg'
                },
                role: 'member'
              },
              {
                userId: {
                  _id: 'user456',
                  fullName: 'Jane Smith',
                  avatar_url: 'https://example.com/avatar2.jpg'
                },
                role: 'member'
              }
            ],
            createdAt: new Date()
          }
        });
      });

      const response = await request(app)
        .post('/channels/private')
        .set('Authorization', 'Bearer mockToken123')
        .send({
          userAId: 'mockUserId123',
          userBId: 'user456'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Private channel created successfully');
      expect(response.body.data.type).toBe('private');
      expect(channelController.createPrivateChannel).toHaveBeenCalledTimes(1);
    });
  });

  describe('Create Group Channel --- POST /channels/group', () => {
    it('should create group channel successfully', async () => {
      channelController.createGroupChannel.mockImplementation((req, res) => {
        res.status(201).json({
          success: true,
          message: 'Group channel created successfully',
          data: {
            _id: 'group123',
            channelId: 'group-1234567890',
            type: 'group',
            name: 'Project Team',
            avatar: 'https://example.com/group-avatar.jpg',
            createdBy: 'mockUserId123',
            members: [
              {
                userId: {
                  _id: 'mockUserId123',
                  fullName: 'John Doe',
                  avatar_url: 'https://example.com/avatar1.jpg'
                },
                role: 'admin'
              },
              {
                userId: {
                  _id: 'user456',
                  fullName: 'Jane Smith',
                  avatar_url: 'https://example.com/avatar2.jpg'
                },
                role: 'member'
              }
            ],
            createdAt: new Date()
          }
        });
      });

      const response = await request(app)
        .post('/channels/group')
        .set('Authorization', 'Bearer mockToken123')
        .send({
          name: 'Project Team',
          memberIds: ['user456', 'user789'],
          url: 'https://example.com/group-avatar.jpg'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.type).toBe('group');
      expect(response.body.data.name).toBe('Project Team');
      expect(channelController.createGroupChannel).toHaveBeenCalledTimes(1);
    });
  });

  describe('Get User Channels --- GET /channels', () => {
    it('should get user channels successfully', async () => {
      channelController.getUserChannels.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'User channels retrieved successfully',
          data: [
            {
              _id: 'channel1',
              channelId: 'private-user1-user2',
              type: 'private',
              members: [
                { userId: { fullName: 'John Doe', avatar_url: 'avatar1.jpg' } },
                { userId: { fullName: 'Jane Smith', avatar_url: 'avatar2.jpg' } }
              ],
              lastMessage: {
                content: 'Hello there!',
                type: 'text',
                from: { fullName: 'Jane Smith' }
              },
              lastMessageTime: new Date(),
              unreadCount: 2
            },
            {
              _id: 'channel2',
              channelId: 'group-123',
              type: 'group',
              name: 'Team Chat',
              avatar: 'group-avatar.jpg',
              lastMessage: {
                content: 'Meeting at 3pm',
                type: 'text'
              },
              unreadCount: 0
            }
          ]
        });
      });

      const response = await request(app)
        .get('/channels')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data[0]).toHaveProperty('lastMessage');
      expect(response.body.data[0]).toHaveProperty('unreadCount');
      expect(channelController.getUserChannels).toHaveBeenCalledTimes(1);
    });
  });

  describe('Get Channel Details --- GET /channels/:channelId', () => {
    it('should get channel details successfully', async () => {
      channelController.getChannelDetails.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'Channel details retrieved successfully',
          data: {
            _id: 'channel123',
            channelId: 'group-123',
            type: 'group',
            name: 'Team Chat',
            avatar: 'group-avatar.jpg',
            members: [
              {
                userId: {
                  _id: 'mockUserId123',
                  fullName: 'John Doe',
                  avatar_url: 'avatar1.jpg'
                },
                role: 'admin'
              }
            ]
          }
        });
      });

      const response = await request(app)
        .get('/channels/group-123')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('channelId', 'group-123');
      expect(channelController.getChannelDetails).toHaveBeenCalledTimes(1);
    });
  });

  describe('Get Channel Messages --- GET /channels/:channelId/messages', () => {
    it('should get channel messages successfully', async () => {
      channelController.getChannelMessages.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          messages: [
            {
              _id: 'msg1',
              channelId: 'channel123',
              from: {
                _id: 'user456',
                fullName: 'Jane Smith',
                avatar_url: 'avatar2.jpg'
              },
              content: 'Hello!',
              messageType: 'text',
              createdAt: new Date()
            },
            {
              _id: 'msg2',
              channelId: 'channel123',
              from: {
                _id: 'mockUserId123',
                fullName: 'John Doe',
                avatar_url: 'avatar1.jpg'
              },
              content: 'Hi there!',
              messageType: 'text',
              createdAt: new Date()
            }
          ],
          activeCall: null,
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalMessages: 2,
            hasMore: false
          }
        });
      });

      const response = await request(app)
        .get('/channels/channel123/messages')
        .set('Authorization', 'Bearer mockToken123')
        .query({ page: 1, limit: 20 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.messages)).toBe(true);
      expect(response.body).toHaveProperty('pagination');
      expect(channelController.getChannelMessages).toHaveBeenCalledTimes(1);
    });
  });

  describe('Add Members to Group --- POST /channels/:channelId/members', () => {
    it('should add members to group successfully', async () => {
      channelController.addMemberToGroup.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'Members added successfully',
          data: {
            _id: 'group123',
            channelId: 'group-123',
            members: [
              { userId: { fullName: 'John Doe' }, role: 'admin' },
              { userId: { fullName: 'New Member' }, role: 'member' }
            ]
          }
        });
      });

      const response = await request(app)
        .post('/channels/group-123/members')
        .set('Authorization', 'Bearer mockToken123')
        .send({ memberIds: ['user789', 'user101'] });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Members added successfully');
      expect(channelController.addMemberToGroup).toHaveBeenCalledTimes(1);
    });
  });

  describe('Remove Member from Group --- DELETE /channels/:channelId/members/:memberId', () => {
    it('should remove member from group successfully', async () => {
      channelController.removeMemberFromGroup.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'Member removed successfully',
          data: {
            _id: 'group123',
            channelId: 'group-123',
            members: [
              { userId: { fullName: 'John Doe' }, role: 'admin' }
            ]
          }
        });
      });

      const response = await request(app)
        .delete('/channels/group-123/members/user456')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Member removed successfully');
      expect(channelController.removeMemberFromGroup).toHaveBeenCalledTimes(1);
    });
  });

  describe('Leave Group Channel --- POST /channels/:channelId/leave', () => {
    it('should leave group channel successfully', async () => {
      channelController.leaveGroupChannel.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'Left group successfully'
        });
      });

      const response = await request(app)
        .post('/channels/group-123/leave')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Left group successfully');
      expect(channelController.leaveGroupChannel).toHaveBeenCalledTimes(1);
    });
  });

  describe('Change Member Role --- PUT /channels/:channelId/members/:memberId/role', () => {
    it('should change member role successfully', async () => {
      channelController.changeMemberRole.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'Member role updated successfully',
          data: {
            _id: 'group123',
            channelId: 'group-123',
            members: [
              { userId: { fullName: 'Jane Smith' }, role: 'admin' }
            ]
          }
        });
      });

      const response = await request(app)
        .put('/channels/group-123/members/user456/role')
        .set('Authorization', 'Bearer mockToken123')
        .send({ role: 'admin' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Member role updated successfully');
      expect(channelController.changeMemberRole).toHaveBeenCalledTimes(1);
    });
  });

  describe('Delete Group Channel --- DELETE /channels/:channelId', () => {
    it('should delete group channel successfully', async () => {
      channelController.deleteGroupChannel.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'Group channel deleted successfully'
        });
      });

      const response = await request(app)
        .delete('/channels/group-123')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Group channel deleted successfully');
      expect(channelController.deleteGroupChannel).toHaveBeenCalledTimes(1);
    });
  });

  describe('Get Channel by User ID --- GET /channels/get-channel/:userId', () => {
    it('should get channel by user ID successfully', async () => {
      channelController.getChannelByUserId.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'Channel retrieved successfully',
          data: {
            _id: 'channel123',
            channelId: 'private-user1-user2',
            type: 'private',
            name: 'Jane Smith',
            avatar: 'https://example.com/avatar2.jpg',
            members: [
              { userId: 'mockUserId123', role: 'member' },
              { userId: 'user456', role: 'member' }
            ]
          }
        });
      });

      const response = await request(app)
        .get('/channels/get-channel/user456')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('channelId');
      expect(response.body.data).toHaveProperty('name', 'Jane Smith');
      expect(channelController.getChannelByUserId).toHaveBeenCalledTimes(1);
    });
  });

  describe('Get All Channel Chat List --- GET /channels/all', () => {
    it('should get all channel chat list successfully', async () => {
      channelController.getChannelChatList.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'Channels retrieved successfully',
          data: [
            {
              _id: 'channel1',
              channelId: 'private-123',
              type: 'private',
              members: [
                { fullName: 'John Doe', avatar_url: 'avatar1.jpg' },
                { fullName: 'Jane Smith', avatar_url: 'avatar2.jpg' }
              ]
            }
          ]
        });
      });

      const response = await request(app)
        .get('/channels/all')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(channelController.getChannelChatList).toHaveBeenCalledTimes(1);
    });
  });
});