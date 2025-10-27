const request = require('supertest');
const express = require('express');
const commentRouter = require('../routes/comment.route');
const postRouter = require('../routes/post.route');
const commentController = require('../controllers/comment.controller');
const postController = require('../controllers/post.controller');
const { isLogin } = require('../middlewares/auth');

const app = express();
app.use(express.json());
app.use('/comments', commentRouter);
app.use('/posts', postRouter);

// Mock the controllers
jest.mock('../controllers/comment.controller');
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

describe('Interaction Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ==================== COMMENT TESTS ====================
  describe('Comment Routes', () => {
    describe('Create Comment --- POST /comments', () => {
      it('should create comment successfully', async () => {
        commentController.createComment.mockImplementation((req, res) => {
          res.status(201).json({
            message: 'Comment created',
            comment: {
              _id: 'comment123',
              user_id: 'mockUserId123',
              post_id: 'post456',
              content: 'This is a comment',
              level: 0,
              root_id: null,
              thread_parent_id: null,
              ancestors: [],
              reply_to_comment_id: null,
              is_deleted: false,
              createdAt: new Date()
            }
          });
        });

        const response = await request(app)
          .post('/comments')
          .set('Authorization', 'Bearer mockToken123')
          .send({
            post_id: 'post456',
            content: 'This is a comment'
          });

        expect(response.status).toBe(201);
        expect(response.body.message).toBe('Comment created');
        expect(response.body.comment).toHaveProperty('content', 'This is a comment');
        expect(response.body.comment.level).toBe(0);
        expect(commentController.createComment).toHaveBeenCalledTimes(1);
      });

      it('should create reply comment successfully (level 1)', async () => {
        commentController.createComment.mockImplementation((req, res) => {
          res.status(201).json({
            message: 'Comment created',
            comment: {
              _id: 'comment789',
              user_id: 'mockUserId123',
              post_id: 'post456',
              content: 'This is a reply',
              level: 1,
              root_id: 'comment123',
              thread_parent_id: 'comment123',
              ancestors: ['comment123'],
              parent_comment_id: 'comment123',
              reply_to_comment_id: 'comment123',
              is_deleted: false,
              createdAt: new Date()
            }
          });
        });

        const response = await request(app)
          .post('/comments')
          .set('Authorization', 'Bearer mockToken123')
          .send({
            post_id: 'post456',
            content: 'This is a reply',
            parent_comment_id: 'comment123'
          });

        expect(response.status).toBe(201);
        expect(response.body.comment.level).toBe(1);
        expect(response.body.comment.parent_comment_id).toBe('comment123');
        expect(commentController.createComment).toHaveBeenCalledTimes(1);
      });

      it('should create nested reply successfully (level 2)', async () => {
        commentController.createComment.mockImplementation((req, res) => {
          res.status(201).json({
            message: 'Comment created',
            comment: {
              _id: 'comment999',
              user_id: 'mockUserId123',
              post_id: 'post456',
              content: 'Nested reply',
              level: 2,
              root_id: 'comment123',
              thread_parent_id: 'comment789',
              ancestors: ['comment123', 'comment789'],
              parent_comment_id: 'comment789',
              reply_to_comment_id: 'comment789',
              is_deleted: false,
              createdAt: new Date()
            }
          });
        });

        const response = await request(app)
          .post('/comments')
          .set('Authorization', 'Bearer mockToken123')
          .send({
            post_id: 'post456',
            content: 'Nested reply',
            parent_comment_id: 'comment789'
          });

        expect(response.status).toBe(201);
        expect(response.body.comment.level).toBe(2);
        expect(response.body.comment.ancestors).toEqual(['comment123', 'comment789']);
        expect(commentController.createComment).toHaveBeenCalledTimes(1);
      });

      it('should create comment with media successfully', async () => {
        commentController.createComment.mockImplementation((req, res) => {
          res.status(201).json({
            message: 'Comment created',
            comment: {
              _id: 'comment888',
              user_id: 'mockUserId123',
              post_id: 'post456',
              content: 'Comment with image',
              media: {
                url: 'https://example.com/image.jpg',
                media_type: 'image'
              },
              level: 0,
              createdAt: new Date()
            }
          });
        });

        const response = await request(app)
          .post('/comments')
          .set('Authorization', 'Bearer mockToken123')
          .send({
            post_id: 'post456',
            content: 'Comment with image',
            media: {
              url: 'https://example.com/image.jpg',
              media_type: 'image'
            }
          });

        expect(response.status).toBe(201);
        expect(response.body.comment.media).toHaveProperty('url');
        expect(commentController.createComment).toHaveBeenCalledTimes(1);
      });
    });

    describe('Get Comments of Post --- GET /comments/:post_id', () => {
      it('should get all comments of post successfully', async () => {
        commentController.getCommentsOfPost.mockImplementation((req, res) => {
          res.status(200).json({
            comments: [
              {
                _id: 'comment123',
                user_id: {
                  _id: 'user1',
                  fullName: 'John Doe',
                  avatar_url: 'avatar1.jpg'
                },
                content: 'Root comment',
                level: 0,
                replies: [
                  {
                    _id: 'comment456',
                    user_id: {
                      _id: 'user2',
                      fullName: 'Jane Smith',
                      avatar_url: 'avatar2.jpg'
                    },
                    content: 'Reply comment',
                    level: 1,
                    replies: [
                      {
                        _id: 'comment789',
                        content: 'Nested reply',
                        level: 2,
                        replying_to: 'comment456'
                      }
                    ],
                    replies_count: 1
                  }
                ],
                createdAt: new Date()
              }
            ]
          });
        });

        const response = await request(app)
          .get('/comments/post456');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('comments');
        expect(Array.isArray(response.body.comments)).toBe(true);
        expect(response.body.comments[0]).toHaveProperty('replies');
        expect(response.body.comments[0].replies[0]).toHaveProperty('replies_count');
        expect(commentController.getCommentsOfPost).toHaveBeenCalledTimes(1);
      });
    });

    describe('Edit Comment --- PUT /comments/:comment_id', () => {
      it('should edit comment successfully', async () => {
        commentController.editComment.mockImplementation((req, res) => {
          res.status(200).json({
            message: 'Comment updated',
            comment: {
              _id: 'comment123',
              user_id: 'mockUserId123',
              post_id: 'post456',
              content: 'Updated comment content',
              updatedAt: new Date()
            }
          });
        });

        const response = await request(app)
          .put('/comments/comment123')
          .set('Authorization', 'Bearer mockToken123')
          .send({
            content: 'Updated comment content'
          });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Comment updated');
        expect(response.body.comment.content).toBe('Updated comment content');
        expect(commentController.editComment).toHaveBeenCalledTimes(1);
      });
    });

    describe('Delete Comment --- DELETE /comments/:comment_id', () => {
      it('should delete comment successfully', async () => {
        commentController.softDeleteComment.mockImplementation((req, res) => {
          res.status(200).json({
            message: 'Comment deleted',
            comment: {
              _id: 'comment123',
              user_id: 'mockUserId123',
              post_id: 'post456',
              content: 'Deleted comment',
              is_deleted: true,
              deleted_at: new Date()
            }
          });
        });

        const response = await request(app)
          .delete('/comments/comment123')
          .set('Authorization', 'Bearer mockToken123');

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Comment deleted');
        expect(response.body.comment.is_deleted).toBe(true);
        expect(commentController.softDeleteComment).toHaveBeenCalledTimes(1);
      });
    });

    describe('React to Comment --- POST /comments/reaction', () => {
      it('should react to comment successfully', async () => {
        commentController.reactToComment.mockImplementation((req, res) => {
          res.status(200).json({
            message: 'Comment reaction saved',
            reaction: {
              _id: 'reaction123',
              user_id: 'mockUserId123',
              comment_id: 'comment456',
              type: 'like',
              createdAt: new Date()
            }
          });
        });

        const response = await request(app)
          .post('/comments/reaction')
          .set('Authorization', 'Bearer mockToken123')
          .send({
            comment_id: 'comment456',
            type: 'like'
          });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Comment reaction saved');
        expect(response.body.reaction).toHaveProperty('type', 'like');
        expect(commentController.reactToComment).toHaveBeenCalledTimes(1);
      });

      it('should react with different types successfully', async () => {
        const reactionTypes = ['like', 'love', 'haha', 'wow', 'sad', 'angry'];
        
        for (const type of reactionTypes) {
          commentController.reactToComment.mockImplementation((req, res) => {
            res.status(200).json({
              message: 'Comment reaction saved',
              reaction: {
                _id: 'reaction123',
                user_id: 'mockUserId123',
                comment_id: 'comment456',
                type: type,
                createdAt: new Date()
              }
            });
          });

          const response = await request(app)
            .post('/comments/reaction')
            .set('Authorization', 'Bearer mockToken123')
            .send({
              comment_id: 'comment456',
              type: type
            });

          expect(response.status).toBe(200);
          expect(response.body.reaction.type).toBe(type);
        }
        
        expect(commentController.reactToComment).toHaveBeenCalledTimes(6);
      });
    });

    describe('Remove Comment Reaction --- DELETE /comments/reaction', () => {
      it('should remove comment reaction successfully', async () => {
        commentController.removeCommentReaction.mockImplementation((req, res) => {
          res.status(200).json({
            message: 'Comment reaction removed'
          });
        });

        const response = await request(app)
          .delete('/comments/reaction')
          .set('Authorization', 'Bearer mockToken123')
          .send({
            comment_id: 'comment456'
          });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe('Comment reaction removed');
        expect(commentController.removeCommentReaction).toHaveBeenCalledTimes(1);
      });
    });

    describe('Get Reactions of Comment --- GET /comments/reactions/:comment_id', () => {
      it('should get all reactions of comment successfully', async () => {
        commentController.getReactionsOfComment.mockImplementation((req, res) => {
          res.status(200).json({
            reactions: [
              {
                _id: 'reaction1',
                user_id: {
                  _id: 'user1',
                  username: 'john_doe',
                  avatar_url: 'avatar1.jpg'
                },
                comment_id: 'comment456',
                type: 'like'
              },
              {
                _id: 'reaction2',
                user_id: {
                  _id: 'user2',
                  username: 'jane_smith',
                  avatar_url: 'avatar2.jpg'
                },
                comment_id: 'comment456',
                type: 'love'
              }
            ],
            counts: [
              { _id: 'like', count: 5 },
              { _id: 'love', count: 3 },
              { _id: 'haha', count: 1 }
            ]
          });
        });

        const response = await request(app)
          .get('/comments/reactions/comment456');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('reactions');
        expect(response.body).toHaveProperty('counts');
        expect(Array.isArray(response.body.reactions)).toBe(true);
        expect(Array.isArray(response.body.counts)).toBe(true);
        expect(commentController.getReactionsOfComment).toHaveBeenCalledTimes(1);
      });
    });

    describe('Get User Reactions for Comments --- POST /comments/user-reactions', () => {
      it('should get user reactions for multiple comments successfully', async () => {
        commentController.getUserReactionsForComments.mockImplementation((req, res) => {
          res.status(200).json({
            reactions: {
              'comment123': 'like',
              'comment456': 'love',
              'comment789': 'haha'
            }
          });
        });

        const response = await request(app)
          .post('/comments/user-reactions')
          .set('Authorization', 'Bearer mockToken123')
          .send({
            comment_ids: ['comment123', 'comment456', 'comment789']
          });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('reactions');
        expect(typeof response.body.reactions).toBe('object');
        expect(response.body.reactions).toHaveProperty('comment123', 'like');
        expect(response.body.reactions).toHaveProperty('comment456', 'love');
        expect(commentController.getUserReactionsForComments).toHaveBeenCalledTimes(1);
      });

      it('should get user reactions for single comment successfully', async () => {
        commentController.getUserReactionsForComments.mockImplementation((req, res) => {
          res.status(200).json({
            reactions: {
              'comment123': 'like'
            }
          });
        });

        const response = await request(app)
          .post('/comments/user-reactions')
          .set('Authorization', 'Bearer mockToken123')
          .send({
            comment_ids: ['comment123']
          });

        expect(response.status).toBe(200);
        expect(response.body.reactions).toHaveProperty('comment123', 'like');
        expect(commentController.getUserReactionsForComments).toHaveBeenCalledTimes(1);
      });
    });
  });

  // ==================== POST REACTION TESTS ====================
  describe('Post Reaction Routes', () => {
    describe('React to Post --- POST /posts/reaction', () => {
      it('should react to post successfully', async () => {
        postController.reactToPost.mockImplementation((req, res) => {
          res.status(201).json({
            message: 'Reaction saved',
            reaction: {
              _id: 'postReaction123',
              user_id: 'mockUserId123',
              post_id: 'post456',
              type: 'like',
              createdAt: new Date()
            }
          });
        });

        const response = await request(app)
          .post('/posts/reaction')
          .set('Authorization', 'Bearer mockToken123')
          .send({
            post_id: 'post456',
            type: 'like'
          });

        expect(response.status).toBe(201);
        expect(response.body.message).toBe('Reaction saved');
        expect(response.body.reaction).toHaveProperty('type', 'like');
        expect(postController.reactToPost).toHaveBeenCalledTimes(1);
      });

      it('should react to post with different types successfully', async () => {
        const reactionTypes = ['like', 'love', 'haha', 'wow', 'sad', 'angry'];
        
        for (const type of reactionTypes) {
          postController.reactToPost.mockImplementation((req, res) => {
            res.status(201).json({
              message: 'Reaction saved',
              reaction: {
                _id: 'postReaction123',
                user_id: 'mockUserId123',
                post_id: 'post456',
                type: type,
                createdAt: new Date()
              }
            });
          });

          const response = await request(app)
            .post('/posts/reaction')
            .set('Authorization', 'Bearer mockToken123')
            .send({
              post_id: 'post456',
              type: type
            });

          expect(response.status).toBe(201);
          expect(response.body.reaction.type).toBe(type);
        }
        
        expect(postController.reactToPost).toHaveBeenCalledTimes(6);
      });

      it('should remove post reaction when type is null', async () => {
        postController.reactToPost.mockImplementation((req, res) => {
          res.status(201).json({
            message: 'Reaction saved',
            reaction: null
          });
        });

        const response = await request(app)
          .post('/posts/reaction')
          .set('Authorization', 'Bearer mockToken123')
          .send({
            post_id: 'post456',
            type: null
          });

        expect(response.status).toBe(201);
        expect(response.body.message).toBe('Reaction saved');
        expect(postController.reactToPost).toHaveBeenCalledTimes(1);
      });

      it('should update existing reaction to different type successfully', async () => {
        postController.reactToPost.mockImplementation((req, res) => {
          res.status(201).json({
            message: 'Reaction saved',
            reaction: {
              _id: 'postReaction123',
              user_id: 'mockUserId123',
              post_id: 'post456',
              type: 'love',
              updatedAt: new Date()
            }
          });
        });

        const response = await request(app)
          .post('/posts/reaction')
          .set('Authorization', 'Bearer mockToken123')
          .send({
            post_id: 'post456',
            type: 'love'
          });

        expect(response.status).toBe(201);
        expect(response.body.reaction.type).toBe('love');
        expect(postController.reactToPost).toHaveBeenCalledTimes(1);
      });
    });

    describe('Get Reactions of Post --- GET /posts/reactions/:post_id', () => {
      it('should get all reactions of post successfully', async () => {
        postController.getReactionsOfPost.mockImplementation((req, res) => {
          res.status(200).json({
            reactions: [
              {
                _id: 'reaction1',
                user_id: {
                  _id: 'user1',
                  fullName: 'John Doe',
                  avatar_url: 'avatar1.jpg'
                },
                post_id: 'post456',
                type: 'like',
                createdAt: new Date()
              },
              {
                _id: 'reaction2',
                user_id: {
                  _id: 'user2',
                  fullName: 'Jane Smith',
                  avatar_url: 'avatar2.jpg'
                },
                post_id: 'post456',
                type: 'love',
                createdAt: new Date()
              }
            ],
            counts: [
              { _id: 'like', count: 10 },
              { _id: 'love', count: 5 },
              { _id: 'haha', count: 2 },
              { _id: 'wow', count: 1 }
            ]
          });
        });

        const response = await request(app)
          .get('/posts/reactions/post456');

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('reactions');
        expect(response.body).toHaveProperty('counts');
        expect(Array.isArray(response.body.reactions)).toBe(true);
        expect(Array.isArray(response.body.counts)).toBe(true);
        expect(response.body.counts).toHaveLength(4);
        expect(postController.getReactionsOfPost).toHaveBeenCalledTimes(1);
      });

      it('should get reactions with populated user info', async () => {
        postController.getReactionsOfPost.mockImplementation((req, res) => {
          res.status(200).json({
            reactions: [
              {
                _id: 'reaction1',
                user_id: {
                  _id: 'user1',
                  fullName: 'John Doe',
                  avatar_url: 'https://example.com/avatar1.jpg'
                },
                post_id: 'post456',
                type: 'like'
              }
            ],
            counts: [
              { _id: 'like', count: 1 }
            ]
          });
        });

        const response = await request(app)
          .get('/posts/reactions/post456');

        expect(response.status).toBe(200);
        expect(response.body.reactions[0].user_id).toHaveProperty('fullName');
        expect(response.body.reactions[0].user_id).toHaveProperty('avatar_url');
        expect(postController.getReactionsOfPost).toHaveBeenCalledTimes(1);
      });
    });

    describe('Get User Reactions for Posts --- POST /posts/user-reactions', () => {
      it('should get user reaction for a post successfully', async () => {
        postController.getUserReactionsForPosts.mockImplementation((req, res) => {
          res.status(200).json({
            _id: 'reaction123',
            user_id: 'mockUserId123',
            post_id: 'post456',
            type: 'like',
            createdAt: new Date()
          });
        });

        const response = await request(app)
          .post('/posts/user-reactions')
          .set('Authorization', 'Bearer mockToken123')
          .send({
            post_id: 'post456'
          });

        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('type', 'like');
        expect(response.body).toHaveProperty('post_id', 'post456');
        expect(postController.getUserReactionsForPosts).toHaveBeenCalledTimes(1);
      });

      it('should return null when user has not reacted to post', async () => {
        postController.getUserReactionsForPosts.mockImplementation((req, res) => {
          res.status(200).json(null);
        });

        const response = await request(app)
          .post('/posts/user-reactions')
          .set('Authorization', 'Bearer mockToken123')
          .send({
            post_id: 'post789'
          });

        expect(response.status).toBe(200);
        expect(response.body).toBeNull();
        expect(postController.getUserReactionsForPosts).toHaveBeenCalledTimes(1);
      });

      it('should get user reactions for different reaction types', async () => {
        const reactionTypes = ['like', 'love', 'haha', 'wow', 'sad', 'angry'];
        
        for (const type of reactionTypes) {
          postController.getUserReactionsForPosts.mockImplementation((req, res) => {
            res.status(200).json({
              _id: 'reaction123',
              user_id: 'mockUserId123',
              post_id: 'post456',
              type: type,
              createdAt: new Date()
            });
          });

          const response = await request(app)
            .post('/posts/user-reactions')
            .set('Authorization', 'Bearer mockToken123')
            .send({
              post_id: 'post456'
            });

          expect(response.status).toBe(200);
          expect(response.body.type).toBe(type);
        }
        
        expect(postController.getUserReactionsForPosts).toHaveBeenCalledTimes(6);
      });
    });
  });
});