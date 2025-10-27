const request = require('supertest');
const express = require('express');
const router = require('../routes/story.route');
const StoryController = require('../controllers/story.controller');
const { isLogin } = require('../middlewares/auth');

const app = express();
app.use(express.json());
app.use('/stories', router);

// Mock the controller
jest.mock('../controllers/story.controller');

// Mock the auth middleware
jest.mock('../middlewares/auth', () => ({
  isLogin: jest.fn((req, res, next) => {
    req.user = { _id: 'mockUserId123' };
    next();
  })
}));

describe('Story Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Create Story', () => {
    it('should create a new story successfully', async () => {
      StoryController.createStory.mockImplementation((req, res) => {
        res.status(201).json({
          success: true,
          story: {
            _id: 'story123',
            userId: 'mockUserId123',
            storyText: 'My story',
            backgroundColor: '#ffffff',
            textColor: '#000000',
            privacy: 'public',
            imageUrl: null,
            videoUrl: null,
            createdAt: new Date()
          }
        });
      });

      const response = await request(app)
        .post('/stories')
        .set('Authorization', 'Bearer mockToken123')
        .send({
          storyText: 'My story',
          backgroundColor: '#ffffff',
          textColor: '#000000',
          privacy: 'public'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.story).toHaveProperty('_id');
      expect(StoryController.createStory).toHaveBeenCalledTimes(1);
    });
  });

  describe('Get All Stories', () => {
    it('should get all stories successfully', async () => {
      StoryController.getStories.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: [
            {
              user: {
                _id: 'user1',
                fullName: 'John Doe',
                avatar_url: 'https://example.com/avatar.jpg'
              },
              stories: [
                {
                  _id: 'story1',
                  storyText: 'Hello World',
                  backgroundColor: '#ffffff',
                  createdAt: new Date()
                }
              ]
            }
          ]
        });
      });

      const response = await request(app)
        .get('/stories')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(StoryController.getStories).toHaveBeenCalledTimes(1);
    });
  });

  describe('Get Story By ID', () => {
    it('should get story by id successfully', async () => {
      StoryController.getStoryById.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: [
            {
              user: {
                _id: 'user1',
                fullName: 'John Doe',
                avatar_url: 'https://example.com/avatar.jpg'
              },
              stories: [
                {
                  _id: 'story123',
                  storyText: 'Hello World',
                  backgroundColor: '#ffffff',
                  createdAt: new Date()
                }
              ]
            }
          ]
        });
      });

      const response = await request(app)
        .get('/stories/story123')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(StoryController.getStoryById).toHaveBeenCalledTimes(1);
    });
  });

  describe('React to Story', () => {
    it('should react to story successfully', async () => {
      StoryController.reactStory.mockImplementation((req, res) => {
        res.status(201).json({
          success: true,
          story: {
            _id: 'reaction123',
            user_id: 'mockUserId123',
            story_id: 'story123',
            type: 'like',
            createdAt: new Date()
          }
        });
      });

      const response = await request(app)
        .post('/stories/story123/reactions')
        .set('Authorization', 'Bearer mockToken123')
        .send({ type: 'like' });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.story).toHaveProperty('type', 'like');
      expect(StoryController.reactStory).toHaveBeenCalledTimes(1);
    });
  });

  describe('View Story', () => {
    it('should view story successfully', async () => {
      StoryController.viewStory.mockImplementation((req, res) => {
        res.status(201).json({ success: true });
      });

      const response = await request(app)
        .post('/stories/story123/views')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(StoryController.viewStory).toHaveBeenCalledTimes(1);
    });
  });

  describe('Get Story Views', () => {
    it('should get story views successfully', async () => {
      StoryController.getViews.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          data: [
            {
              _id: 'view1',
              user_id: {
                _id: 'user1',
                fullName: 'John Doe',
                avatar_url: 'https://example.com/avatar.jpg'
              },
              story_id: 'story123',
              reaction: 'like',
              createdAt: new Date()
            }
          ]
        });
      });

      const response = await request(app)
        .get('/stories/story123/views')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(StoryController.getViews).toHaveBeenCalledTimes(1);
    });
  });

  describe('Delete Story', () => {
    it('should delete story successfully', async () => {
      StoryController.deleteStory.mockImplementation((req, res) => {
        res.status(200).json({
          success: true,
          message: 'Story deleted successfully'
        });
      });

      const response = await request(app)
        .delete('/stories/story123')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Story deleted successfully');
      expect(StoryController.deleteStory).toHaveBeenCalledTimes(1);
    });
  });
});