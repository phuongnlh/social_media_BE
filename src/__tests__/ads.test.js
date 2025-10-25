const request = require('supertest');
const express = require('express');
const router = require('../routes/ads.route');
const adsController = require('../controllers/ads.controller');
const { isLogin } = require('../middlewares/auth');

const app = express();
app.use(express.json());
app.use('/ads', router);

// Mock the controller
jest.mock('../controllers/ads.controller');

// Mock the auth middleware
jest.mock('../middlewares/auth', () => ({
  isLogin: jest.fn((req, res, next) => {
    req.user = { _id: 'mockUserId123', id: 'mockUserId123' };
    next();
  })
}));

describe('Ads Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Create Ads --- POST /ads', () => {
    it('should create a new ad successfully', async () => {
      adsController.createAds.mockImplementation((req, res) => {
        res.status(201).json({
          success: true,
          message: 'Ad created successfully',
          data: {
            _id: 'ad123',
            user_id: 'mockUserId123',
            post_id: 'post123',
            campaign_name: 'Summer Campaign',
            target_location: ['Hanoi', 'HCMC'],
            target_age: { min: 18, max: 35 },
            target_gender: ['male', 'female'],
            target_views: 1000,
            current_views: 0,
            status: 'waiting_payment',
            total_interactions: 0,
            created_at: new Date()
          }
        });
      });

      const response = await request(app)
        .post('/ads')
        .set('Authorization', 'Bearer mockToken123')
        .send({
          post_id: 'post123',
          campaign_name: 'Summer Campaign',
          target_location: ['Hanoi', 'HCMC'],
          target_age: { min: 18, max: 35 },
          target_gender: ['male', 'female'],
          target_views: 1000
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Ad created successfully');
      expect(response.body.data).toHaveProperty('campaign_name', 'Summer Campaign');
      expect(adsController.createAds).toHaveBeenCalledTimes(1);
    });
  });

  describe('Get all Ads --- GET /ads', () => {
    it('should get all ads with pagination successfully', async () => {
      adsController.getAllAds.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'Ads retrieved successfully',
          data: {
            docs: [
              {
                _id: 'ad1',
                campaign_name: 'Campaign 1',
                status: 'active',
                target_views: 1000,
                current_views: 500,
                progress_percentage: 50
              }
            ],
            totalDocs: 1,
            limit: 10,
            totalPages: 1,
            page: 1,
            hasPrevPage: false,
            hasNextPage: false
          }
        });
      });

      const response = await request(app)
        .get('/ads')
        .set('Authorization', 'Bearer mockToken123')
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('docs');
      expect(Array.isArray(response.body.data.docs)).toBe(true);
      expect(adsController.getAllAds).toHaveBeenCalledTimes(1);
    });
  });

  describe('Get Ads by User ID --- GET /ads/me', () => {
    it('should get all ads by user ID successfully', async () => {
      adsController.getAllAdsByUserId.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'Ads with payment info retrieved successfully',
          data: [
            {
              _id: 'ad1',
              campaign_name: 'Campaign 1',
              status: 'active',
              payment: {
                method: 'stripe',
                amount: 100000,
                currency: 'VND',
                status: 'paid'
              }
            }
          ]
        });
      });

      const response = await request(app)
        .get('/ads/me')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data[0]).toHaveProperty('payment');
      expect(adsController.getAllAdsByUserId).toHaveBeenCalledTimes(1);
    });
  });

  describe('Get Ads Analytics --- GET /ads/analytics', () => {
    it('should get ads analytics successfully', async () => {
      adsController.getAdsAnalytics.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'Ads analytics retrieved successfully',
          data: {
            totalSpendVND: 500000,
            totalSpendUSD: 0,
            totalReach: 5000,
            totalInteractions: 250,
            activeAdsCount: 2,
            completedAdsCount: 3,
            pausedAdsCount: 1,
            totalAdsCount: 6
          }
        });
      });

      const response = await request(app)
        .get('/ads/analytics')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalSpendVND');
      expect(response.body.data).toHaveProperty('totalReach');
      expect(response.body.data).toHaveProperty('activeAdsCount');
      expect(adsController.getAdsAnalytics).toHaveBeenCalledTimes(1);
    });
  });

  describe('Get Ad Interaction Statistics --- GET /ads/analytic/:ads_id', () => {
    it('should get interaction statistics for specific ad successfully', async () => {
      adsController.getInteractionStats.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'Interaction statistics for ad ad123 by day retrieved successfully',
          data: {
            ads_id: 'ad123',
            post_id: 'post123',
            period: 'day',
            daysBack: 7,
            stats: [
              { date: '2025-10-18', comments: 5, reactions: 10, total: 15 },
              { date: '2025-10-19', comments: 3, reactions: 8, total: 11 }
            ],
            summary: {
              totalComments: 8,
              totalReactions: 18,
              totalInteractions: 26
            }
          }
        });
      });

      const response = await request(app)
        .get('/ads/analytic/ad123')
        .set('Authorization', 'Bearer mockToken123')
        .query({ period: 'day', days: 7 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('stats');
      expect(response.body.data).toHaveProperty('summary');
      expect(Array.isArray(response.body.data.stats)).toBe(true);
      expect(adsController.getInteractionStats).toHaveBeenCalledTimes(1);
    });
  });

  describe('Get Available Posts --- GET /ads/available-posts', () => {
    it('should get posts available for ads successfully', async () => {
      adsController.getPostsAvailableForAds.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'Posts available for ads retrieved successfully',
          data: [
            {
              _id: 'post1',
              content: 'Post content',
              type: 'Public',
              author: {
                _id: 'mockUserId123',
                username: 'john_doe',
                fullName: 'John Doe'
              },
              media: [
                { url: 'https://example.com/image.jpg', type: 'image' }
              ]
            }
          ]
        });
      });

      const response = await request(app)
        .get('/ads/available-posts')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(adsController.getPostsAvailableForAds).toHaveBeenCalledTimes(1);
    });
  });

  describe('Get Ads Activities ---GET /ads/activities', () => {
    it('should get user activities successfully', async () => {
      adsController.getActivitiesByUserId.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'User activities retrieved successfully',
          data: {
            docs: [
              {
                _id: 'activity1',
                type: 'campaign_created',
                metadata: { campaign_name: 'Summer Campaign' },
                campaign: {
                  campaign_name: 'Summer Campaign',
                  status: 'active'
                },
                created_at: new Date()
              }
            ],
            totalDocs: 1,
            limit: 10,
            totalPages: 1,
            page: 1
          }
        });
      });

      const response = await request(app)
        .get('/ads/activities')
        .set('Authorization', 'Bearer mockToken123')
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('docs');
      expect(Array.isArray(response.body.data.docs)).toBe(true);
      expect(adsController.getActivitiesByUserId).toHaveBeenCalledTimes(1);
    });
  });

  describe('Get Ad by ID --- GET /ads/:id', () => {
    it('should get ad by ID successfully', async () => {
      adsController.getAdById.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'Ad retrieved successfully',
          data: {
            _id: 'ad123',
            campaign_name: 'Summer Campaign',
            target_views: 1000,
            current_views: 500,
            progress_percentage: 50,
            status: 'active',
            user: {
              username: 'john_doe',
              fullName: 'John Doe'
            },
            post: {
              content: 'Post content'
            },
            media_files: [
              { url: 'https://example.com/image.jpg', media_type: 'image' }
            ]
          }
        });
      });

      const response = await request(app)
        .get('/ads/ad123')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('campaign_name');
      expect(response.body.data).toHaveProperty('progress_percentage');
      expect(adsController.getAdById).toHaveBeenCalledTimes(1);
    });
  });

  describe('Update Ad --- PUT /ads/:id', () => {
    it('should update ad successfully', async () => {
      adsController.updateAd.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'Ad updated successfully',
          data: {
            _id: 'ad123',
            campaign_name: 'Updated Campaign',
            target_location: ['Hanoi'],
            target_age: { min: 20, max: 40 },
            target_gender: ['female']
          }
        });
      });

      const response = await request(app)
        .put('/ads/ad123')
        .set('Authorization', 'Bearer mockToken123')
        .send({
          campaign_name: 'Updated Campaign',
          target_location: ['Hanoi']
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Ad updated successfully');
      expect(adsController.updateAd).toHaveBeenCalledTimes(1);
    });
  });

  describe('Increment Ad View --- POST /ads/:id/view', () => {
    it('should increment ad view successfully', async () => {
      adsController.incrementAdView.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'Ad view incremented successfully',
          data: {
            current_views: 501,
            target_views: 1000,
            status: 'active',
            progress_percentage: 50.1
          }
        });
      });

      const response = await request(app)
        .post('/ads/ad123/view')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Ad view incremented successfully');
      expect(response.body.data).toHaveProperty('current_views');
      expect(response.body.data).toHaveProperty('progress_percentage');
      expect(adsController.incrementAdView).toHaveBeenCalledTimes(1);
    });
  });
});