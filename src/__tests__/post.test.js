const request = require('supertest');
const express = require('express');
const router = require('../routes/post.route');
const postController = require('../controllers/post.controller');
const { isLogin } = require('../middlewares/auth');
const { attachLocation } = require('../middlewares/location');

const app = express();
app.use(express.json());
app.use('/posts', router);

// Mock the controller
jest.mock('../controllers/post.controller');

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

// Mock location middleware
jest.mock('../middlewares/location', () => ({
  attachLocation: jest.fn((req, res, next) => {
    req.userLocation = {
      displayName: 'Ho Chi Minh City, Vietnam',
      source: 'ip',
      coordinates: [10.8231, 106.6297]
    };
    next();
  })
}));

describe('Post Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== CREATE POST ====================
  describe('Create Post --- POST /posts', () => {
    it('should create post without media successfully', async () => {
      postController.createPost.mockImplementation((req, res) => {
        res.status(201).json({
          message: 'Post created successfully',
          post: {
            _id: 'post123',
            content: 'This is a test post',
            type: 'Public',
            author: 'mockUserId123',
            media: [],
            createdAt: new Date()
          }
        });
      });

      const response = await request(app)
        .post('/posts')
        .set('Authorization', 'Bearer mockToken123')
        .send({
          content: 'This is a test post',
          type: 'Public'
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Post created successfully');
      expect(response.body.post).toHaveProperty('content', 'This is a test post');
      expect(response.body.post.media).toEqual([]);
      expect(postController.createPost).toHaveBeenCalledTimes(1);
    });

    it('should create post with single image successfully', async () => {
      postController.createPost.mockImplementation((req, res) => {
        res.status(201).json({
          message: 'Post created successfully',
          post: {
            _id: 'post456',
            content: 'Post with image',
            type: 'Public',
            author: 'mockUserId123',
            media: [
              { url: 'https://example.com/image.jpg', type: 'image' }
            ],
            createdAt: new Date()
          }
        });
      });

      const response = await request(app)
        .post('/posts')
        .set('Authorization', 'Bearer mockToken123')
        .send({
          content: 'Post with image',
          type: 'Public',
          media: [
            { url: 'https://example.com/image.jpg', media_type: 'image' }
          ]
        });

      expect(response.status).toBe(201);
      expect(response.body.post.media).toHaveLength(1);
      expect(response.body.post.media[0].type).toBe('image');
      expect(postController.createPost).toHaveBeenCalledTimes(1);
    });

    it('should create post with multiple images successfully', async () => {
      postController.createPost.mockImplementation((req, res) => {
        res.status(201).json({
          message: 'Post created successfully',
          post: {
            _id: 'post789',
            content: 'Post with multiple images',
            type: 'Public',
            author: 'mockUserId123',
            media: [
              { url: 'https://example.com/image1.jpg', type: 'image' },
              { url: 'https://example.com/image2.jpg', type: 'image' },
              { url: 'https://example.com/image3.jpg', type: 'image' }
            ],
            createdAt: new Date()
          }
        });
      });

      const response = await request(app)
        .post('/posts')
        .set('Authorization', 'Bearer mockToken123')
        .send({
          content: 'Post with multiple images',
          type: 'Public',
          media: [
            { url: 'https://example.com/image1.jpg', media_type: 'image' },
            { url: 'https://example.com/image2.jpg', media_type: 'image' },
            { url: 'https://example.com/image3.jpg', media_type: 'image' }
          ]
        });

      expect(response.status).toBe(201);
      expect(response.body.post.media).toHaveLength(3);
      expect(postController.createPost).toHaveBeenCalledTimes(1);
    });

    it('should create post with video successfully', async () => {
      postController.createPost.mockImplementation((req, res) => {
        res.status(201).json({
          message: 'Post created successfully',
          post: {
            _id: 'post999',
            content: 'Post with video',
            type: 'Public',
            author: 'mockUserId123',
            media: [
              { url: 'https://example.com/video.mp4', type: 'video' }
            ],
            createdAt: new Date()
          }
        });
      });

      const response = await request(app)
        .post('/posts')
        .set('Authorization', 'Bearer mockToken123')
        .send({
          content: 'Post with video',
          type: 'Public',
          media: [
            { url: 'https://example.com/video.mp4', media_type: 'video' }
          ]
        });

      expect(response.status).toBe(201);
      expect(response.body.post.media[0].type).toBe('video');
      expect(postController.createPost).toHaveBeenCalledTimes(1);
    });

    it('should create private post successfully', async () => {
      postController.createPost.mockImplementation((req, res) => {
        res.status(201).json({
          message: 'Post created successfully',
          post: {
            _id: 'post_private',
            content: 'Private post content',
            type: 'Private',
            author: 'mockUserId123',
            media: [],
            createdAt: new Date()
          }
        });
      });

      const response = await request(app)
        .post('/posts')
        .set('Authorization', 'Bearer mockToken123')
        .send({
          content: 'Private post content',
          type: 'Private'
        });

      expect(response.status).toBe(201);
      expect(response.body.post.type).toBe('Private');
      expect(postController.createPost).toHaveBeenCalledTimes(1);
    });

    it('should create friends-only post successfully', async () => {
      postController.createPost.mockImplementation((req, res) => {
        res.status(201).json({
          message: 'Post created successfully',
          post: {
            _id: 'post_friends',
            content: 'Friends only post',
            type: 'Friends',
            author: 'mockUserId123',
            media: [],
            createdAt: new Date()
          }
        });
      });

      const response = await request(app)
        .post('/posts')
        .set('Authorization', 'Bearer mockToken123')
        .send({
          content: 'Friends only post',
          type: 'Friends'
        });

      expect(response.status).toBe(201);
      expect(response.body.post.type).toBe('Friends');
      expect(postController.createPost).toHaveBeenCalledTimes(1);
    });
  });

  // ==================== GET POSTS ====================
  describe('Get All Posts by User --- GET /posts', () => {
    it('should get all user posts successfully', async () => {
      postController.getAllPostsbyUser.mockImplementation((req, res) => {
        res.json([
          {
            _id: 'post1',
            content: 'First post',
            type: 'Public',
            author: {
              _id: 'mockUserId123',
              username: 'johndoe',
              fullName: 'John Doe',
              avatar_url: 'avatar.jpg'
            },
            media: [],
            createdAt: new Date()
          },
          {
            _id: 'post2',
            content: 'Second post',
            type: 'Public',
            author: {
              _id: 'mockUserId123',
              username: 'johndoe',
              fullName: 'John Doe',
              avatar_url: 'avatar.jpg'
            },
            media: [
              { url: 'https://example.com/image.jpg', type: 'image' }
            ],
            createdAt: new Date()
          }
        ]);
      });

      const response = await request(app)
        .get('/posts')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
      expect(postController.getAllPostsbyUser).toHaveBeenCalledTimes(1);
    });
  });

  describe('Get Posts by User ID --- GET /posts/user/:userId', () => {
    it('should get posts by specific user ID successfully', async () => {
      postController.getAllPostsbyUserId.mockImplementation((req, res) => {
        res.json([
          {
            _id: 'post1',
            content: 'User post',
            author: {
              _id: 'user456',
              username: 'janesmith',
              fullName: 'Jane Smith'
            },
            media: []
          }
        ]);
      });

      const response = await request(app)
        .get('/posts/user/user456')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(postController.getAllPostsbyUserId).toHaveBeenCalledTimes(1);
    });

    it('should get posts with media only successfully', async () => {
      postController.getAllPostsbyUserId.mockImplementation((req, res) => {
        res.json([
          {
            _id: 'post_with_media',
            content: 'Post with media',
            media: [
              { url: 'https://example.com/image.jpg', type: 'image' }
            ]
          }
        ]);
      });

      const response = await request(app)
        .get('/posts/user/user456')
        .set('Authorization', 'Bearer mockToken123')
        .query({ media_only: 'true' });

      expect(response.status).toBe(200);
      expect(response.body.every(p => p.media && p.media.length > 0)).toBe(true);
      expect(postController.getAllPostsbyUserId).toHaveBeenCalledTimes(1);
    });
  });

  describe('Get Post by ID --- GET /posts/:id', () => {
    it('should get post detail by ID successfully', async () => {
      postController.getPostById.mockImplementation((req, res) => {
        res.json({
          _id: 'post123',
          content: 'Detailed post content',
          type: 'Public',
          author: {
            _id: 'mockUserId123',
            username: 'johndoe',
            fullName: 'John Doe',
            avatar_url: 'avatar.jpg'
          },
          media: [
            { url: 'https://example.com/image.jpg', type: 'image' }
          ],
          reactionCount: 10,
          commentCount: 5,
          viewCount: 100,
          createdAt: new Date()
        });
      });

      const response = await request(app)
        .get('/posts/post123')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('_id', 'post123');
      expect(response.body).toHaveProperty('reactionCount', 10);
      expect(response.body).toHaveProperty('commentCount', 5);
      expect(postController.getPostById).toHaveBeenCalledTimes(1);
    });

    it('should get shared post with original post data successfully', async () => {
      postController.getPostById.mockImplementation((req, res) => {
        res.json({
          _id: 'shared_post123',
          content: 'Sharing this post',
          type: 'Public',
          author: {
            _id: 'mockUserId123',
            username: 'johndoe',
            fullName: 'John Doe'
          },
          shared_post_id: {
            _id: 'original_post456',
            content: 'Original post content',
            author: {
              _id: 'user789',
              username: 'originaluser',
              fullName: 'Original User'
            },
            media: [
              { url: 'https://example.com/original.jpg', type: 'image' }
            ]
          },
          media: [],
          createdAt: new Date()
        });
      });

      const response = await request(app)
        .get('/posts/shared_post123')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('shared_post_id');
      expect(response.body.shared_post_id).toHaveProperty('_id', 'original_post456');
      expect(postController.getPostById).toHaveBeenCalledTimes(1);
    });
  });

  // ==================== UPDATE POST ====================
  describe('Update Post --- PUT /posts/:id', () => {
    it('should update post content successfully', async () => {
      postController.updatePost.mockImplementation((req, res) => {
        res.json({
          message: 'Bài đăng đã được cập nhật thành công'
        });
      });

      const response = await request(app)
        .put('/posts/post123')
        .set('Authorization', 'Bearer mockToken123')
        .send({
          content: 'Updated post content'
        });

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('Bài đăng đã được cập nhật thành công');
      expect(postController.updatePost).toHaveBeenCalledTimes(1);
    });
  });

  // ==================== DELETE POST ====================
  describe('Delete Post --- DELETE /posts/:id', () => {
    it('should soft delete post successfully', async () => {
      postController.softDeletePost.mockImplementation((req, res) => {
        res.status(200).json({
          message: 'Bài đăng đã được chuyển vào thùng rác. Sẽ bị xóa vĩnh viễn sau 7 ngày.'
        });
      });

      const response = await request(app)
        .delete('/posts/post123')
        .set('Authorization', 'Bearer mockToken123');

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('thùng rác');
      expect(postController.softDeletePost).toHaveBeenCalledTimes(1);
    });
  });

  // ==================== SHARE POST ====================
  describe('Share Post --- POST /posts/share', () => {
    it('should share post successfully', async () => {
      postController.sharePost.mockImplementation((req, res) => {
        res.status(201).json({
          message: 'Post shared successfully',
          postId: 'shared_post123'
        });
      });

      const response = await request(app)
        .post('/posts/share')
        .set('Authorization', 'Bearer mockToken123')
        .send({
          original_post_id: 'post456',
          content: 'Sharing this amazing post!',
          type: 'Public'
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Post shared successfully');
      expect(response.body).toHaveProperty('postId');
      expect(postController.sharePost).toHaveBeenCalledTimes(1);
    });

    it('should share post without caption successfully', async () => {
      postController.sharePost.mockImplementation((req, res) => {
        res.status(201).json({
          message: 'Post shared successfully',
          postId: 'shared_post456'
        });
      });

      const response = await request(app)
        .post('/posts/share')
        .set('Authorization', 'Bearer mockToken123')
        .send({
          original_post_id: 'post789',
          type: 'Public'
        });

      expect(response.status).toBe(201);
      expect(response.body.message).toBe('Post shared successfully');
      expect(postController.sharePost).toHaveBeenCalledTimes(1);
    });
  });

  // ==================== RECOMMEND POST ====================
  describe('Get Recommended Posts --- GET /posts/recommend', () => {
    it('should get recommended posts with location successfully', async () => {
      postController.getRecommendPost.mockImplementation((req, res) => {
        res.json({
          success: true,
          page: 1,
          limit: 10,
          total: 50,
          totalPages: 5,
          posts: [
            {
              _id: 'rec_post1',
              content: 'Recommended post 1',
              author: {
                fullName: 'User 1',
                avatar_url: 'avatar1.jpg'
              },
              media: [],
              score: 95.5,
              isAd: false,
              reactionCount: 20,
              commentCount: 10
            },
            {
              _id: 'rec_post2',
              content: 'Sponsored post',
              author: {
                fullName: 'Business Page',
                avatar_url: 'business.jpg'
              },
              media: [
                { url: 'https://example.com/ad.jpg', type: 'image' }
              ],
              score: 90.0,
              isAd: true,
              reactionCount: 50,
              commentCount: 15
            }
          ],
          meta: {
            responseTime: '120ms',
            userLocation: 'Ho Chi Minh City, Vietnam',
            locationSource: 'ip',
            adsCount: 1
          }
        });
      });

      const response = await request(app)
        .get('/posts/recommend')
        .set('Authorization', 'Bearer mockToken123')
        .query({ page: 1, limit: 10 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.posts)).toBe(true);
      expect(response.body).toHaveProperty('meta');
      expect(response.body.meta).toHaveProperty('userLocation');
      expect(response.body.meta).toHaveProperty('adsCount');
      expect(postController.getRecommendPost).toHaveBeenCalledTimes(1);
    });

    it('should get recommended posts with pagination successfully', async () => {
      postController.getRecommendPost.mockImplementation((req, res) => {
        res.json({
          success: true,
          page: 2,
          limit: 20,
          total: 100,
          totalPages: 5,
          posts: Array(20).fill({
            _id: 'post',
            content: 'Post content',
            score: 80.0
          }),
          meta: {
            responseTime: '150ms'
          }
        });
      });

      const response = await request(app)
        .get('/posts/recommend')
        .set('Authorization', 'Bearer mockToken123')
        .query({ page: 2, limit: 20 });

      expect(response.status).toBe(200);
      expect(response.body.page).toBe(2);
      expect(response.body.limit).toBe(20);
      expect(response.body.posts).toHaveLength(20);
      expect(postController.getRecommendPost).toHaveBeenCalledTimes(1);
    });
  });

  // ==================== VIEW COUNT ====================
  describe('Increase View Count --- PATCH /posts/:id/view', () => {
    it('should increase post view count successfully', async () => {
      postController.increaseViewCount.mockImplementation((req, res) => {
        res.status(200).json({
          message: 'View count increased'
        });
      });

      const response = await request(app)
        .patch('/posts/post123/view');

      expect(response.status).toBe(200);
      expect(response.body.message).toBe('View count increased');
      expect(postController.increaseViewCount).toHaveBeenCalledTimes(1);
    });

    it('should track ad impressions when viewing ad post', async () => {
      postController.increaseViewCount.mockImplementation((req, res) => {
        res.status(200).json({
          message: 'View count increased',
          adTracked: true
        });
      });

      const response = await request(app)
        .patch('/posts/ad_post123/view');

      expect(response.status).toBe(200);
      expect(postController.increaseViewCount).toHaveBeenCalledTimes(1);
    });
  });
});