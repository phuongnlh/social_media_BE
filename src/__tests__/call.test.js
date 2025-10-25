const request = require('supertest');
const express = require('express');
const router = require('../routes/agora.route');
const callController = require('../controllers/call.controller');

const app = express();
app.use(express.json());
app.use('/agora', router);

// Mock the controller
jest.mock('../controllers/call.controller');

// Mock environment variables
process.env.AGORA_APP_ID = 'mockAppId123';
process.env.AGORA_APP_CERTIFICATE = 'mockCertificate456';

describe('Agora Call Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Generate Agora Token --- POST /agora/token', () => {
    it('should generate Agora token successfully with default role', async () => {
      callController.genToken.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: {
            token: 'mockAgoraToken123abc',
            appId: 'mockAppId123',
            channelName: 'test-channel',
            uid: 0,
            expiredTs: Math.floor(Date.now() / 1000) + 24 * 3600
          }
        });
      });

      const response = await request(app)
        .post('/agora/token')
        .send({
          channelName: 'test-channel',
          uid: 0,
          role: 'publisher'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('appId');
      expect(response.body.data.channelName).toBe('test-channel');
      expect(callController.genToken).toHaveBeenCalledTimes(1);
    });

    it('should generate Agora token with publisher role successfully', async () => {
      callController.genToken.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: {
            token: 'mockPublisherToken789',
            appId: 'mockAppId123',
            channelName: 'video-call-room',
            uid: 12345,
            expiredTs: Math.floor(Date.now() / 1000) + 24 * 3600
          }
        });
      });

      const response = await request(app)
        .post('/agora/token')
        .send({
          channelName: 'video-call-room',
          uid: 12345,
          role: 'publisher'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.uid).toBe(12345);
      expect(callController.genToken).toHaveBeenCalledTimes(1);
    });

    it('should generate Agora token with audience role successfully', async () => {
      callController.genToken.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: {
            token: 'mockAudienceToken456',
            appId: 'mockAppId123',
            channelName: 'live-stream',
            uid: 67890,
            expiredTs: Math.floor(Date.now() / 1000) + 24 * 3600
          }
        });
      });

      const response = await request(app)
        .post('/agora/token')
        .send({
          channelName: 'live-stream',
          uid: 67890,
          role: 'audience'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      expect(callController.genToken).toHaveBeenCalledTimes(1);
    });
  });

  describe('Generate User Token --- POST /agora/user-token', () => {
    it('should generate user token successfully', async () => {
      callController.genUserToken.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: {
            token: 'mockUserToken999',
            appId: 'mockAppId123',
            channelName: 'user-channel',
            uid: 123,
            userId: '123',
            expiredTs: Math.floor(Date.now() / 1000) + 24 * 3600
          }
        });
      });

      const response = await request(app)
        .post('/agora/user-token')
        .send({
          channelName: 'user-channel',
          userId: '123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('userId', '123');
      expect(response.body.data).toHaveProperty('uid', 123);
      expect(callController.genUserToken).toHaveBeenCalledTimes(1);
    });

    it('should generate user token with string userId successfully', async () => {
      callController.genUserToken.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: {
            token: 'mockUserTokenString',
            appId: 'mockAppId123',
            channelName: 'private-call',
            uid: 456,
            userId: '456',
            expiredTs: Math.floor(Date.now() / 1000) + 24 * 3600
          }
        });
      });

      const response = await request(app)
        .post('/agora/user-token')
        .send({
          channelName: 'private-call',
          userId: '456'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.userId).toBe('456');
      expect(callController.genUserToken).toHaveBeenCalledTimes(1);
    });
  });

  describe('Validate Agora Configuration --- GET /agora/validate', () => {
    it('should validate Agora configuration successfully', async () => {
      callController.validateToken.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: {
            hasAppId: true,
            hasAppCertificate: true,
            isConfigured: true,
            appId: 'mockAppI...'
          }
        });
      });

      const response = await request(app)
        .get('/agora/validate');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('hasAppId', true);
      expect(response.body.data).toHaveProperty('hasAppCertificate', true);
      expect(response.body.data).toHaveProperty('isConfigured', true);
      expect(callController.validateToken).toHaveBeenCalledTimes(1);
    });

    it('should return masked appId for security', async () => {
      callController.validateToken.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: {
            hasAppId: true,
            hasAppCertificate: true,
            isConfigured: true,
            appId: 'mockAppI...'
          }
        });
      });

      const response = await request(app)
        .get('/agora/validate');

      expect(response.status).toBe(200);
      expect(response.body.data.appId).toContain('...');
      expect(callController.validateToken).toHaveBeenCalledTimes(1);
    });
  });
});