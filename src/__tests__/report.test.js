const request = require('supertest');
const express = require('express');
const router = require('../routes/report.route');
const reportController = require('../controllers/report.controller');
const { isLogin } = require('../middlewares/auth');

const app = express();
app.use(express.json());
app.use('/reports', router);

// Mock the controller
jest.mock('../controllers/report.controller');

// Mock the auth middleware
jest.mock('../middlewares/auth', () => ({
  isLogin: jest.fn((req, res, next) => {
    req.user = { _id: 'mockUserId123', id: 'mockUserId123' };
    next();
  })
}));

describe('Report Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Create Report', () => {
    it('should create a new report successfully', async () => {
      reportController.createReport.mockImplementation((req, res) => {
        res.status(201).json({
          success: true,
          message: 'Report created successfully',
          data: {
            _id: 'report123',
            reportedBy: {
              _id: 'mockUserId123',
              username: 'john_doe',
              avatar: 'https://example.com/avatar.jpg'
            },
            reportedPost: {
              _id: 'post123',
              content: 'This is a post',
              images: [],
              createdAt: new Date()
            },
            reportedUser: {
              _id: 'user123',
              username: 'reported_user',
              avatar: 'https://example.com/avatar2.jpg'
            },
            reportType: 'spam',
            description: 'This post is spam',
            reason: 'Inappropriate content',
            status: 'pending',
            createdAt: new Date()
          }
        });
      });

      const response = await request(app)
        .post('/reports')
        .set('Authorization', 'Bearer mockToken123')
        .send({
          reportedPost: 'post123',
          reportType: 'spam',
          description: 'This post is spam',
          reason: 'Inappropriate content',
          evidence: ['https://example.com/evidence.jpg']
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Report created successfully');
      expect(response.body.data).toHaveProperty('_id');
      expect(response.body.data.reportType).toBe('spam');
      expect(reportController.createReport).toHaveBeenCalledTimes(1);
    });
  });

  describe('Get User Reports', () => {
    it('should get user reports successfully', async () => {
      reportController.getUserReports.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: {
            reports: [
              {
                _id: 'report123',
                reportedBy: 'mockUserId123',
                reportedPost: {
                  _id: 'post123',
                  content: 'This is a post',
                  images: [],
                  createdAt: new Date()
                },
                reportedUser: {
                  _id: 'user123',
                  username: 'reported_user',
                  avatar: 'https://example.com/avatar.jpg'
                },
                reportType: 'spam',
                description: 'This post is spam',
                status: 'pending',
                createdAt: new Date()
              }
            ],
            pagination: {
              page: 1,
              limit: 10,
              total: 1,
              pages: 1
            }
          }
        });
      });

      const response = await request(app)
        .get('/reports/my-reports')
        .set('Authorization', 'Bearer mockToken123')
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('reports');
      expect(response.body.data).toHaveProperty('pagination');
      expect(Array.isArray(response.body.data.reports)).toBe(true);
      expect(reportController.getUserReports).toHaveBeenCalledTimes(1);
    });

    it('should get user reports with status filter successfully', async () => {
      reportController.getUserReports.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: {
            reports: [
              {
                _id: 'report123',
                reportType: 'spam',
                status: 'pending',
                createdAt: new Date()
              }
            ],
            pagination: {
              page: 1,
              limit: 10,
              total: 1,
              pages: 1
            }
          }
        });
      });

      const response = await request(app)
        .get('/reports/my-reports')
        .set('Authorization', 'Bearer mockToken123')
        .query({ status: 'pending' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(reportController.getUserReports).toHaveBeenCalledTimes(1);
    });
  });

  describe('Delete Report', () => {
    it('should delete report successfully', async () => {
      reportController.deleteReport.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'Report deleted successfully'
        });
      });

      const response = await request(app)
        .delete('/reports/report123')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Report deleted successfully');
      expect(reportController.deleteReport).toHaveBeenCalledTimes(1);
    });
  });
});