const request = require('supertest');
const express = require('express');
const router = require('../routes/group.route');
const groupController = require('../controllers/group.controller');
const { isLogin } = require('../middlewares/auth');

const app = express();
app.use(express.json());
app.use('/groups', router);

// Mock the controller
jest.mock('../controllers/group.controller');

// Mock the auth middleware
jest.mock('../middlewares/auth', () => ({
  isLogin: jest.fn((req, res, next) => {
    req.user = { 
      _id: 'mockUserId123',
      id: 'mockUserId123',
      fullName: 'John Doe',
      avatar_url: 'https://example.com/avatar.jpg'
    };
    next();
  })
}));

describe('Group Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== GROUP CRUD ====================
  describe('Create Group --- POST /groups', () => {
    it('should create group successfully', async () => {
      groupController.createGroup.mockImplementation((req, res) => {
        res.status(201).json({
          message: 'Group created',
          group: {
            _id: 'group123',
            name: 'Tech Community',
            description: 'A group for tech enthusiasts',
            privacy: 'Public',
            cover_url: 'https://example.com/cover.jpg',
            creator: 'mockUserId123',
            created_at: new Date()
          }
        });
      });

      const response = await request(app)
        .post('/groups')
        .set('Authorization', 'Bearer mockToken123')
        .send({
          name: 'Tech Community',
          description: 'A group for tech enthusiasts',
          privacy: 'Public',
          cover_url: 'https://example.com/cover.jpg'
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Group created');
      expect(response.body.group).toHaveProperty('name', 'Tech Community');
      expect(response.body.group).toHaveProperty('privacy', 'Public');
      expect(groupController.createGroup).toHaveBeenCalledTimes(1);
    });

    it('should create private group successfully', async () => {
      groupController.createGroup.mockImplementation((req, res) => {
        res.status(201).json({
          message: 'Group created',
          group: {
            _id: 'group456',
            name: 'Private Club',
            description: 'Exclusive group',
            privacy: 'Private',
            creator: 'mockUserId123'
          }
        });
      });

      const response = await request(app)
        .post('/groups')
        .set('Authorization', 'Bearer mockToken123')
        .send({
          name: 'Private Club',
          description: 'Exclusive group',
          privacy: 'Private'
        });

      expect(response.status).toBe(201);
      expect(response.body.group.privacy).toBe('Private');
      expect(groupController.createGroup).toHaveBeenCalledTimes(1);
    });
  });

  describe('Get My Groups --- GET /groups/my-groups', () => {
    it('should get user joined groups successfully', async () => {
      groupController.getMyGroups.mockImplementation((req, res) => {
        res.status(200).json({
          groups: [
            {
              _id: 'group1',
              name: 'Tech Community',
              description: 'Tech group',
              privacy: 'Public',
              role: 'admin',
              totalMembers: 50,
              totalPosts: 120,
              lastActivity: new Date()
            },
            {
              _id: 'group2',
              name: 'Book Club',
              privacy: 'Private',
              role: 'member',
              totalMembers: 20,
              totalPosts: 45,
              lastActivity: new Date()
            }
          ]
        });
      });

      const response = await request(app)
        .get('/groups/my-groups')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.groups)).toBe(true);
      expect(response.body.groups[0]).toHaveProperty('totalMembers');
      expect(response.body.groups[0]).toHaveProperty('totalPosts');
      expect(response.body.groups[0]).toHaveProperty('role', 'admin');
      expect(groupController.getMyGroups).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when user has no groups', async () => {
      groupController.getMyGroups.mockImplementation((req, res) => {
        res.status(200).json({
          message: "You haven't joined any groups yet",
          groups: []
        });
      });

      const response = await request(app)
        .get('/groups/my-groups')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(response.body.groups).toEqual([]);
      expect(groupController.getMyGroups).toHaveBeenCalledTimes(1);
    });
  });

  describe('Get All Groups --- GET /groups/get-groups', () => {
    it('should get all groups successfully', async () => {
      groupController.getAllGroups.mockImplementation((req, res) => {
        res.status(200).json({
          groups: [
            {
              _id: 'group1',
              name: 'Tech Community',
              privacy: 'Public'
            },
            {
              _id: 'group2',
              name: 'Book Club',
              privacy: 'Private'
            }
          ]
        });
      });

      const response = await request(app)
        .get('/groups/get-groups')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.groups)).toBe(true);
      expect(groupController.getAllGroups).toHaveBeenCalledTimes(1);
    });
  });

  describe('Get Group Detail --- GET /groups/get-group/:group_id', () => {
    it('should get group detail successfully', async () => {
      groupController.getGroupDetail.mockImplementation((req, res) => {
        res.status(200).json({
          group: {
            _id: 'group123',
            name: 'Tech Community',
            description: 'A tech group',
            privacy: 'Public',
            cover_url: 'https://example.com/cover.jpg',
            totalMembers: 50,
            totalPosts: 120,
            lastActivity: new Date(),
            isJoined: true,
            isAdmin: false
          }
        });
      });

      const response = await request(app)
        .get('/groups/get-group/group123')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(response.body.group).toHaveProperty('name', 'Tech Community');
      expect(response.body.group).toHaveProperty('isJoined', true);
      expect(response.body.group).toHaveProperty('isAdmin', false);
      expect(groupController.getGroupDetail).toHaveBeenCalledTimes(1);
    });
  });

  describe('Search Groups --- GET /groups/search', () => {
    it('should search groups successfully', async () => {
      groupController.searchGroups.mockImplementation((req, res) => {
        res.status(200).json([
          {
            _id: 'group1',
            name: 'Tech Community',
            description: 'Technology group',
            totalMembers: 50,
            totalPosts: 120
          },
          {
            _id: 'group2',
            name: 'Tech Enthusiasts',
            description: 'Tech lovers',
            totalMembers: 30,
            totalPosts: 80
          }
        ]);
      });

      const response = await request(app)
        .get('/groups/search')
        .set('Authorization', 'Bearer mockToken123')
        .query({ query: 'Tech' });

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body[0]).toHaveProperty('totalMembers');
      expect(groupController.searchGroups).toHaveBeenCalledTimes(1);
    });
  });

  // ==================== MEMBERSHIP MANAGEMENT ====================
  describe('Request Join Group --- POST /groups/request-join', () => {
    it('should join public group immediately', async () => {
      groupController.requestJoinGroup.mockImplementation((req, res) => {
        res.status(200).json({
          message: 'Joined group'
        });
      });

      const response = await request(app)
        .post('/groups/request-join')
        .set('Authorization', 'Bearer mockToken123')
        .send({ group_id: 'group123' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Joined group');
      expect(groupController.requestJoinGroup).toHaveBeenCalledTimes(1);
    });

    it('should send join request for private group', async () => {
      groupController.requestJoinGroup.mockImplementation((req, res) => {
        res.status(200).json({
          message: 'Join request sent'
        });
      });

      const response = await request(app)
        .post('/groups/request-join')
        .set('Authorization', 'Bearer mockToken123')
        .send({ group_id: 'group456' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Join request sent');
      expect(groupController.requestJoinGroup).toHaveBeenCalledTimes(1);
    });
  });

  describe('Leave Group --- POST /groups/leave', () => {
    it('should leave group successfully', async () => {
      groupController.leaveGroup.mockImplementation((req, res) => {
        res.status(200).json({
          message: 'Left group'
        });
      });

      const response = await request(app)
        .post('/groups/leave')
        .set('Authorization', 'Bearer mockToken123')
        .send({ group_id: 'group123' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Left group');
      expect(groupController.leaveGroup).toHaveBeenCalledTimes(1);
    });
  });

  describe('Get Group Members --- GET /groups/members/:group_id', () => {
    it('should get group members successfully', async () => {
      groupController.getGroupMembers.mockImplementation((req, res) => {
        res.status(200).json({
          members: [
            {
              _id: 'member1',
              user: {
                _id: 'user1',
                fullName: 'John Doe',
                username: 'john_doe',
                avatar_url: 'avatar1.jpg'
              },
              role: 'admin',
              postCount: 50,
              status: 'approved'
            },
            {
              _id: 'member2',
              user: {
                _id: 'user2',
                fullName: 'Jane Smith',
                username: 'jane_smith',
                avatar_url: 'avatar2.jpg'
              },
              role: 'member',
              postCount: 20,
              status: 'approved'
            }
          ]
        });
      });

      const response = await request(app)
        .get('/groups/members/group123')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.members)).toBe(true);
      expect(response.body.members[0]).toHaveProperty('role', 'admin');
      expect(response.body.members[0]).toHaveProperty('postCount', 50);
      expect(groupController.getGroupMembers).toHaveBeenCalledTimes(1);
    });

    it('should filter members by role successfully', async () => {
      groupController.getGroupMembers.mockImplementation((req, res) => {
        res.status(200).json({
          members: [
            {
              user: { fullName: 'John Doe' },
              role: 'admin',
              postCount: 50
            }
          ]
        });
      });

      const response = await request(app)
        .get('/groups/members/group123')
        .set('Authorization', 'Bearer mockToken123')
        .query({ roles: 'admin' });

      expect(response.status).toBe(200);
      expect(response.body.members[0].role).toBe('admin');
      expect(groupController.getGroupMembers).toHaveBeenCalledTimes(1);
    });

    it('should search members by name successfully', async () => {
      groupController.getGroupMembers.mockImplementation((req, res) => {
        res.status(200).json({
          members: [
            {
              user: { fullName: 'John Doe' },
              role: 'member'
            }
          ]
        });
      });

      const response = await request(app)
        .get('/groups/members/group123')
        .set('Authorization', 'Bearer mockToken123')
        .query({ search: 'John' });

      expect(response.status).toBe(200);
      expect(response.body.members[0].user.fullName).toContain('John');
      expect(groupController.getGroupMembers).toHaveBeenCalledTimes(1);
    });
  });

  // ==================== ADMIN OPERATIONS ====================
  describe('Get Pending Join Requests --- GET /groups/pending-requests/:group_id', () => {
    it('should get pending join requests successfully', async () => {
      groupController.getPendingRequests.mockImplementation((req, res) => {
        res.status(200).json({
          requests: [
            {
              _id: 'request1',
              user_id: {
                _id: 'user789',
                username: 'new_user',
                fullName: 'New User',
                avatar_url: 'avatar.jpg'
              },
              group_id: 'group123',
              status: 'pending',
              requested_at: new Date()
            }
          ]
        });
      });

      const response = await request(app)
        .get('/groups/pending-requests/group123')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.requests)).toBe(true);
      expect(response.body.requests[0]).toHaveProperty('status', 'pending');
      expect(groupController.getPendingRequests).toHaveBeenCalledTimes(1);
    });
  });

  describe('Handle Join Request --- POST /groups/handle-join-request/:request_id', () => {
    it('should approve join request successfully', async () => {
      groupController.handleJoinRequest.mockImplementation((req, res) => {
        res.status(200).json({
          message: 'Request approved'
        });
      });

      const response = await request(app)
        .post('/groups/handle-join-request/request123')
        .set('Authorization', 'Bearer mockToken123')
        .send({ action: 'approved' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Request approved');
      expect(groupController.handleJoinRequest).toHaveBeenCalledTimes(1);
    });

    it('should reject join request successfully', async () => {
      groupController.handleJoinRequest.mockImplementation((req, res) => {
        res.status(200).json({
          message: 'Request rejected'
        });
      });

      const response = await request(app)
        .post('/groups/handle-join-request/request123')
        .set('Authorization', 'Bearer mockToken123')
        .send({ action: 'rejected' });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Request rejected');
      expect(groupController.handleJoinRequest).toHaveBeenCalledTimes(1);
    });
  });

  describe('Change Member Role --- POST /groups/change-role', () => {
    it('should promote member to admin successfully', async () => {
      groupController.changeMemberRole.mockImplementation((req, res) => {
        res.status(200).json({
          message: 'Role updated',
          member: {
            _id: 'member123',
            user: 'user456',
            group: 'group123',
            role: 'admin'
          }
        });
      });

      const response = await request(app)
        .post('/groups/change-role')
        .set('Authorization', 'Bearer mockToken123')
        .send({
          group_id: 'group123',
          user_id: 'user456',
          role: 'admin'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Role updated');
      expect(response.body.member.role).toBe('admin');
      expect(groupController.changeMemberRole).toHaveBeenCalledTimes(1);
    });

    it('should demote admin to member successfully', async () => {
      groupController.changeMemberRole.mockImplementation((req, res) => {
        res.status(200).json({
          message: 'Role updated',
          member: {
            _id: 'member123',
            role: 'member'
          }
        });
      });

      const response = await request(app)
        .post('/groups/change-role')
        .set('Authorization', 'Bearer mockToken123')
        .send({
          group_id: 'group123',
          user_id: 'user456',
          role: 'member'
        });

      expect(response.status).toBe(200);
      expect(response.body.member.role).toBe('member');
      expect(groupController.changeMemberRole).toHaveBeenCalledTimes(1);
    });
  });

  describe('Transfer Group Creator --- POST /groups/demote-or-transfer', () => {
    it('should demote self from admin to member successfully', async () => {
      groupController.demoteOrTransferCreator.mockImplementation((req, res) => {
        res.status(200).json({
          message: 'Successfully demoted yourself to member',
          member: {
            _id: 'member123',
            role: 'member'
          }
        });
      });

      const response = await request(app)
        .post('/groups/demote-or-transfer')
        .set('Authorization', 'Bearer mockToken123')
        .send({
          group_id: 'group123',
          action: 'demote'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('demoted');
      expect(groupController.demoteOrTransferCreator).toHaveBeenCalledTimes(1);
    });

    it('should transfer creator role successfully', async () => {
      groupController.demoteOrTransferCreator.mockImplementation((req, res) => {
        res.status(200).json({
          message: 'Creator role transferred successfully',
          newCreator: 'user789',
          group: {
            _id: 'group123',
            creator: 'user789'
          }
        });
      });

      const response = await request(app)
        .post('/groups/demote-or-transfer')
        .set('Authorization', 'Bearer mockToken123')
        .send({
          group_id: 'group123',
          action: 'transfer_creator',
          new_creator_id: 'user789'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('transferred');
      expect(response.body.newCreator).toBe('user789');
      expect(groupController.demoteOrTransferCreator).toHaveBeenCalledTimes(1);
    });
  });

  describe('Update Group Info --- PUT /groups/update/:group_id', () => {
    it('should update group info successfully', async () => {
      groupController.updateGroup.mockImplementation((req, res) => {
        res.status(200).json({
          message: 'Group updated',
          group: {
            _id: 'group123',
            name: 'Updated Tech Community',
            description: 'Updated description',
            privacy: 'Private',
            cover_url: 'https://example.com/new-cover.jpg'
          }
        });
      });

      const response = await request(app)
        .put('/groups/update/group123')
        .set('Authorization', 'Bearer mockToken123')
        .send({
          name: 'Updated Tech Community',
          description: 'Updated description',
          privacy: 'Private',
          cover_url: 'https://example.com/new-cover.jpg'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Group updated');
      expect(response.body.group.name).toBe('Updated Tech Community');
      expect(groupController.updateGroup).toHaveBeenCalledTimes(1);
    });
  });

  describe('Delete Group --- DELETE /groups/delete/:group_id', () => {
    it('should delete group successfully', async () => {
      groupController.deleteGroup.mockImplementation((req, res) => {
        res.status(200).json({
          message: 'Group and all related data deleted successfully'
        });
      });

      const response = await request(app)
        .delete('/groups/delete/group123')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('deleted successfully');
      expect(groupController.deleteGroup).toHaveBeenCalledTimes(1);
    });
  });

  // ==================== MODERATION ====================
  describe('Ban Member --- POST /groups/ban-member', () => {
    it('should ban member successfully', async () => {
      groupController.banMember.mockImplementation((req, res) => {
        res.status(200).json({
          message: 'Member banned',
          member: {
            _id: 'member123',
            user: 'user456',
            status: 'banned',
            banned_at: new Date(),
            ban_reason: 'Violated community rules'
          }
        });
      });

      const response = await request(app)
        .post('/groups/ban-member')
        .set('Authorization', 'Bearer mockToken123')
        .send({
          group_id: 'group123',
          user_id: 'user456',
          ban_reason: 'Violated community rules'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Member banned');
      expect(response.body.member.status).toBe('banned');
      expect(groupController.banMember).toHaveBeenCalledTimes(1);
    });
  });

  describe('Unban Member --- POST /groups/unban-member', () => {
    it('should unban member successfully', async () => {
      groupController.unbanMember.mockImplementation((req, res) => {
        res.status(200).json({
          message: 'Member unbanned',
          member: {
            _id: 'member123',
            user: 'user456'
          }
        });
      });

      const response = await request(app)
        .post('/groups/unban-member')
        .set('Authorization', 'Bearer mockToken123')
        .send({
          group_id: 'group123',
          user_id: 'user456'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Member unbanned');
      expect(groupController.unbanMember).toHaveBeenCalledTimes(1);
    });
  });

  describe('Restrict MemberPOST /groups/restrict-member', () => {
    it('should restrict member from posting successfully', async () => {
      groupController.restrictMember.mockImplementation((req, res) => {
        const until = new Date();
        until.setDate(until.getDate() + 7);
        
        res.status(200).json({
          message: 'Member restricted from posting',
          member: {
            _id: 'member123',
            user: 'user456',
            restrict_post_until: until,
            restrict_reason: 'Spam posting'
          }
        });
      });

      const response = await request(app)
        .post('/groups/restrict-member')
        .set('Authorization', 'Bearer mockToken123')
        .send({
          group_id: 'group123',
          user_id: 'user456',
          days: 7,
          restrict_reason: 'Spam posting'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('restricted');
      expect(response.body.member).toHaveProperty('restrict_post_until');
      expect(groupController.restrictMember).toHaveBeenCalledTimes(1);
    });
  });
});