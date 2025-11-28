const request = require('supertest');
const express = require('express');
const router = require('../routes/notification.route');
const notificationController = require('../controllers/notification.controller');
const { isLogin } = require('../middlewares/auth');

const app = express();
app.use(express.json());
app.use('/notifications', router);

// Mock the controller
jest.mock('../controllers/notification.controller');

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

describe('Notification Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Get All Notifications --- GET /notifications', () => {
    it('should get all notifications with pagination successfully', async () => {
      notificationController.getNotifications.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: {
            notifications: [
              {
                _id: 'notif1',
                user_id: 'mockUserId123',
                type: 'like',
                message: 'John liked your post',
                actor: {
                  _id: 'user456',
                  fullName: 'Jane Smith',
                  avatar_url: 'avatar.jpg'
                },
                post_id: 'post123',
                is_read: false,
                createdAt: new Date()
              },
              {
                _id: 'notif2',
                user_id: 'mockUserId123',
                type: 'comment',
                message: 'Someone commented on your post',
                actor: {
                  _id: 'user789',
                  fullName: 'Bob Wilson',
                  avatar_url: 'avatar2.jpg'
                },
                post_id: 'post456',
                is_read: true,
                createdAt: new Date()
              }
            ],
            pagination: {
              total: 25,
              page: 1,
              limit: 10,
              pages: 3
            }
          }
        });
      });

      const response = await request(app)
        .get('/notifications')
        .set('Authorization', 'Bearer mockToken123')
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data.notifications)).toBe(true);
      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body.data.pagination).toHaveProperty('total', 25);
      expect(response.body.data.pagination).toHaveProperty('page', 1);
      expect(response.body.data.pagination).toHaveProperty('pages', 3);
      expect(notificationController.getNotifications).toHaveBeenCalledTimes(1);
    });

    it('should get notifications with default pagination (page 1, limit 10)', async () => {
      notificationController.getNotifications.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: {
            notifications: [],
            pagination: {
              total: 0,
              page: 1,
              limit: 10,
              pages: 0
            }
          }
        });
      });

      const response = await request(app)
        .get('/notifications')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(10);
      expect(notificationController.getNotifications).toHaveBeenCalledTimes(1);
    });

    it('should get notifications for specific page successfully', async () => {
      notificationController.getNotifications.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: {
            notifications: [
              {
                _id: 'notif11',
                type: 'follow',
                message: 'Someone followed you',
                is_read: false
              }
            ],
            pagination: {
              total: 25,
              page: 2,
              limit: 10,
              pages: 3
            }
          }
        });
      });

      const response = await request(app)
        .get('/notifications')
        .set('Authorization', 'Bearer mockToken123')
        .query({ page: 2, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.data.pagination.page).toBe(2);
      expect(notificationController.getNotifications).toHaveBeenCalledTimes(1);
    });

    it('should get notifications with custom limit successfully', async () => {
      notificationController.getNotifications.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: {
            notifications: Array(20).fill({
              _id: 'notif',
              type: 'like',
              is_read: false
            }),
            pagination: {
              total: 100,
              page: 1,
              limit: 20,
              pages: 5
            }
          }
        });
      });

      const response = await request(app)
        .get('/notifications')
        .set('Authorization', 'Bearer mockToken123')
        .query({ page: 1, limit: 20 });

      expect(response.status).toBe(200);
      expect(response.body.data.pagination.limit).toBe(20);
      expect(response.body.data.pagination.pages).toBe(5);
      expect(notificationController.getNotifications).toHaveBeenCalledTimes(1);
    });

    it('should get empty notifications list when no notifications exist', async () => {
      notificationController.getNotifications.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: {
            notifications: [],
            pagination: {
              total: 0,
              page: 1,
              limit: 10,
              pages: 0
            }
          }
        });
      });

      const response = await request(app)
        .get('/notifications')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(response.body.data.notifications).toEqual([]);
      expect(response.body.data.pagination.total).toBe(0);
      expect(notificationController.getNotifications).toHaveBeenCalledTimes(1);
    });
  });

  describe('Get Unread Count --- GET /notifications/unread-count', () => {
    it('should get unread notification count successfully', async () => {
      notificationController.getUnreadCount.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: { count: 5 }
        });
      });

      const response = await request(app)
        .get('/notifications/unread-count')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('count', 5);
      expect(notificationController.getUnreadCount).toHaveBeenCalledTimes(1);
    });

    it('should return zero when no unread notifications', async () => {
      notificationController.getUnreadCount.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: { count: 0 }
        });
      });

      const response = await request(app)
        .get('/notifications/unread-count')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(response.body.data.count).toBe(0);
      expect(notificationController.getUnreadCount).toHaveBeenCalledTimes(1);
    });

    it('should return high count when many unread notifications', async () => {
      notificationController.getUnreadCount.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: { count: 99 }
        });
      });

      const response = await request(app)
        .get('/notifications/unread-count')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(response.body.data.count).toBe(99);
      expect(notificationController.getUnreadCount).toHaveBeenCalledTimes(1);
    });
  });

  describe('Mark Notification as Read --- PATCH /notifications/:notificationId/read', () => {
    it('should mark notification as read successfully', async () => {
      notificationController.markAsRead.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'Đã đánh dấu thông báo là đã đọc',
          data: {
            notification: {
              _id: 'notif123',
              user_id: 'mockUserId123',
              type: 'like',
              message: 'Someone liked your post',
              is_read: true,
              read_at: new Date()
            }
          }
        });
      });

      const response = await request(app)
        .patch('/notifications/notif123/read')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Đã đánh dấu thông báo là đã đọc');
      expect(response.body.data.notification.is_read).toBe(true);
      expect(response.body.data.notification).toHaveProperty('read_at');
      expect(notificationController.markAsRead).toHaveBeenCalledTimes(1);
    });

    it('should mark unread notification as read successfully', async () => {
      notificationController.markAsRead.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'Đã đánh dấu thông báo là đã đọc',
          data: {
            notification: {
              _id: 'notif456',
              type: 'comment',
              is_read: true,
              read_at: new Date()
            }
          }
        });
      });

      const response = await request(app)
        .patch('/notifications/notif456/read')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(response.body.data.notification.is_read).toBe(true);
      expect(notificationController.markAsRead).toHaveBeenCalledTimes(1);
    });

    it('should handle marking already read notification successfully', async () => {
      notificationController.markAsRead.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'Đã đánh dấu thông báo là đã đọc',
          data: {
            notification: {
              _id: 'notif789',
              is_read: true,
              read_at: new Date('2025-10-20')
            }
          }
        });
      });

      const response = await request(app)
        .patch('/notifications/notif789/read')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(response.body.data.notification.is_read).toBe(true);
      expect(notificationController.markAsRead).toHaveBeenCalledTimes(1);
    });
  });

  describe('Mark All Notifications as Read --- PATCH /notifications/read-all', () => {
    it('should mark all notifications as read successfully', async () => {
      notificationController.markAllAsRead.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'Đã đánh dấu tất cả thông báo là đã đọc'
        });
      });

      const response = await request(app)
        .patch('/notifications/read-all')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Đã đánh dấu tất cả thông báo là đã đọc');
      expect(notificationController.markAllAsRead).toHaveBeenCalledTimes(1);
    });

    it('should mark all unread notifications as read successfully', async () => {
      notificationController.markAllAsRead.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'Đã đánh dấu tất cả thông báo là đã đọc',
          data: {
            modifiedCount: 15
          }
        });
      });

      const response = await request(app)
        .patch('/notifications/read-all')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(notificationController.markAllAsRead).toHaveBeenCalledTimes(1);
    });

    it('should handle when no unread notifications exist', async () => {
      notificationController.markAllAsRead.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'Đã đánh dấu tất cả thông báo là đã đọc',
          data: {
            modifiedCount: 0
          }
        });
      });

      const response = await request(app)
        .patch('/notifications/read-all')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(notificationController.markAllAsRead).toHaveBeenCalledTimes(1);
    });
  });

  describe('Delete Notification --- DELETE /notifications/:notificationId', () => {
    it('should delete notification successfully', async () => {
      notificationController.deleteNotification.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'Đã xóa thông báo thành công'
        });
      });

      const response = await request(app)
        .delete('/notifications/notif123')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Đã xóa thông báo thành công');
      expect(notificationController.deleteNotification).toHaveBeenCalledTimes(1);
    });

    it('should delete read notification successfully', async () => {
      notificationController.deleteNotification.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'Đã xóa thông báo thành công',
          data: {
            deletedNotificationId: 'notif456'
          }
        });
      });

      const response = await request(app)
        .delete('/notifications/notif456')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(notificationController.deleteNotification).toHaveBeenCalledTimes(1);
    });

    it('should delete unread notification successfully', async () => {
      notificationController.deleteNotification.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'Đã xóa thông báo thành công',
          data: {
            deletedNotificationId: 'notif789'
          }
        });
      });

      const response = await request(app)
        .delete('/notifications/notif789')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(notificationController.deleteNotification).toHaveBeenCalledTimes(1);
    });
  });

  describe('Notification Types', () => {
    it('should handle like notification successfully', async () => {
      notificationController.getNotifications.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: {
            notifications: [
              {
                _id: 'notif1',
                type: 'like',
                message: 'Jane liked your post',
                actor: { fullName: 'Jane Smith' },
                post_id: 'post123',
                is_read: false
              }
            ],
            pagination: { total: 1, page: 1, limit: 10, pages: 1 }
          }
        });
      });

      const response = await request(app)
        .get('/notifications')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(response.body.data.notifications[0].type).toBe('like');
      expect(notificationController.getNotifications).toHaveBeenCalledTimes(1);
    });

    it('should handle comment notification successfully', async () => {
      notificationController.getNotifications.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: {
            notifications: [
              {
                _id: 'notif2',
                type: 'comment',
                message: 'Bob commented on your post',
                actor: { fullName: 'Bob Wilson' },
                post_id: 'post456',
                comment_id: 'comment789',
                is_read: false
              }
            ],
            pagination: { total: 1, page: 1, limit: 10, pages: 1 }
          }
        });
      });

      const response = await request(app)
        .get('/notifications')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(response.body.data.notifications[0].type).toBe('comment');
      expect(notificationController.getNotifications).toHaveBeenCalledTimes(1);
    });

    it('should handle follow notification successfully', async () => {
      notificationController.getNotifications.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: {
            notifications: [
              {
                _id: 'notif3',
                type: 'follow',
                message: 'Alice started following you',
                actor: { 
                  _id: 'user999',
                  fullName: 'Alice Brown',
                  avatar_url: 'alice.jpg'
                },
                is_read: false
              }
            ],
            pagination: { total: 1, page: 1, limit: 10, pages: 1 }
          }
        });
      });

      const response = await request(app)
        .get('/notifications')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(response.body.data.notifications[0].type).toBe('follow');
      expect(notificationController.getNotifications).toHaveBeenCalledTimes(1);
    });

    it('should handle friend request notification successfully', async () => {
      notificationController.getNotifications.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: {
            notifications: [
              {
                _id: 'notif4',
                type: 'friend_request',
                message: 'Tom sent you a friend request',
                actor: { fullName: 'Tom Davis' },
                friendship_id: 'friendship123',
                is_read: false
              }
            ],
            pagination: { total: 1, page: 1, limit: 10, pages: 1 }
          }
        });
      });

      const response = await request(app)
        .get('/notifications')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(response.body.data.notifications[0].type).toBe('friend_request');
      expect(notificationController.getNotifications).toHaveBeenCalledTimes(1);
    });

    it('should handle group invitation notification successfully', async () => {
      notificationController.getNotifications.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: {
            notifications: [
              {
                _id: 'notif5',
                type: 'group_invitation',
                message: 'Sarah invited you to join Tech Community',
                actor: { fullName: 'Sarah Lee' },
                group_id: 'group456',
                is_read: false
              }
            ],
            pagination: { total: 1, page: 1, limit: 10, pages: 1 }
          }
        });
      });

      const response = await request(app)
        .get('/notifications')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(response.body.data.notifications[0].type).toBe('group_invitation');
      expect(notificationController.getNotifications).toHaveBeenCalledTimes(1);
    });
  });
});