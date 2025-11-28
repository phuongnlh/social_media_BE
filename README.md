# 🚀 Social Media Backend API

A comprehensive social media backend API built with Node.js, Express, MongoDB, and Socket.IO. This application provides a full-featured social networking platform with real-time messaging, user management, content sharing, and advanced notification systems.

## 🌟 Features

### Core Features

- **User Authentication & Authorization** - JWT-based authentication with refresh tokens
- **User Profile Management** - Complete profile system with avatar uploads
- **Post & Media Sharing** - Text posts with image/video uploads via Cloudinary
- **Real-time Messaging** - Channel-based chat system with Socket.IO
- **Social Interactions** - Friend requests, following system, and content reactions
- **Group Management** - Create and manage group conversations
- **Notification System** - Real-time notifications for all user activities
- **Content Moderation** - Automated content moderation using Bull queues
- **Payment Integration** - Stripe integration for premium features
- **Admin Dashboard** - Comprehensive admin controls and analytics

### Technical Features

- **Scalable Architecture** - Modular MVC structure with separation of concerns
- **Real-time Communication** - Socket.IO with namespace-based messaging
- **Caching Layer** - Redis for session management and caching
- **File Storage** - Cloudinary integration for media uploads
- **Email Services** - Nodemailer for transactional emails
- **Input Validation** - Comprehensive validation using express-validator
- **Error Handling** - Centralized error handling with proper HTTP status codes
- **Testing Suite** - Jest and Supertest for comprehensive testing
- **Background Jobs** - Bull queues for async processing

## 📁 Project Structure

```
social_media_BE/
├── src/
│   ├── app.js                 # Express app configuration
│   ├── server.js              # Server startup and Socket.IO setup
│   ├── config/               # Configuration files
│   │   ├── database.mongo.js  # MongoDB connection
│   │   ├── database.redis.js  # Redis connection
│   │   ├── cloudinary.storage.js # Cloudinary config
│   │   ├── passport.js        # Passport JWT strategy
│   │   └── generateKeys.js    # JWT key generation
│   ├── controllers/          # Route controllers
│   │   ├── user.controller.js
│   │   ├── post.controller.js
│   │   ├── comment.controller.js
│   │   ├── friend.controller.js
│   │   ├── follow.controller.js
│   │   ├── notification.controller.js
│   │   └── token.controller.js
│   ├── models/              # Database models
│   │   ├── user.model.js
│   │   ├── post.model.js
│   │   ├── friendship.model.js
│   │   ├── notification.model.js
│   │   ├── Chat/            # Chat-related models
│   │   ├── Comment_Reaction/ # Comment and reaction models
│   │   ├── Group/           # Group-related models
│   │   ├── Payment_Ads/     # Payment and ads models
│   │   └── Admin/           # Admin-related models
│   ├── routes/              # Route definitions
│   │   ├── index.js         # Main router
│   │   ├── users.js
│   │   ├── post.route.js
│   │   ├── friend.route.js
│   │   └── token.js
│   ├── middlewares/         # Custom middleware
│   │   └── auth.js          # Authentication middleware
│   ├── services/           # Business logic layer
│   │   └── notification.service.js
│   ├── socket/            # Socket.IO handlers
│   │   ├── index.js       # Socket setup
│   │   └── io-instance.js # Socket instance management
│   ├── utils/             # Utility functions
│   │   ├── jwt_utils.js   # JWT helpers
│   │   ├── pwd_utils.js   # Password utilities
│   │   ├── email_utils.js # Email helpers
│   │   └── upload_utils.js # File upload utilities
│   ├── workers/           # Background job workers
│   │   └── moderationWorker.js
│   ├── queues/           # Queue definitions
│   ├── proto/            # gRPC protocol buffers
│   └── __tests__/        # Test files
├── package.json
├── .env.example
└── README.md
```

## 🛠️ Technology Stack

### Backend Framework

- **Node.js** (v18+) - Runtime environment
- **Express.js** (v5.1.0) - Web application framework
- **Socket.IO** (v4.8.1) - Real-time bidirectional event-based communication

### Database & Storage

- **MongoDB** (v8.16.1) - Primary database with Mongoose ODM
- **Redis** (v5.6.0) - Caching and session storage
- **Cloudinary** - Cloud-based media storage and optimization

### Authentication & Security

- **Passport.js** (v0.7.0) - Authentication middleware
- **JWT** - JSON Web Token for stateless authentication
- **bcrypt** - Password hashing and salting

### Real-time & Background Processing

- **BullMQ** (v5.58.5) - Queue management for background jobs
- **Node-cache** (v5.1.2) - In-memory caching

### Email & Notifications

- **Nodemailer** (v7.0.4) - Email sending functionality
- **Firebase Admin** (v13.5.0) - Push notifications

### Payment Processing

- **Stripe** (v18.5.0) - Payment processing integration

### Development & Testing

- **Jest** (v30.2.0) - Testing framework
- **Supertest** (v7.1.4) - HTTP assertion testing
- **Nodemon** (v3.1.10) - Development server auto-restart
- **cross-env** (v10.1.0) - Cross-platform environment variables

## Table of Contents

- [🚀 Quick Start](#quick-start)
- [⚙️ Configuration](#configuration)
- [🔐 Authentication](#authentication)
- [📚 API Documentation](#api-documentation)
- [🌐 WebSocket API](#websocket-api)
- [🗄️ Database Models](#database-models)
- [🚀 Deployment](#deployment)
- [🧪 Testing](#testing)
- [🤝 Contributing](#contributing)
- [📄 License](#license)

## 🚀 Quick Start

### Prerequisites

Before running this application, make sure you have the following installed:

- **Node.js** (v18.0.0 or higher) - [Download here](https://nodejs.org/)
- **MongoDB** (v6.0 or higher) - [Download here](https://www.mongodb.com/download-center)
- **Redis** (v7.0 or higher) - [Download here](https://redis.io/download)
- **Git** - [Download here](https://git-scm.com/downloads)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/phuongnlh/social_media_BE.git
   cd social_media_BE
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Environment setup**

   Copy the example environment file and configure it:

   ```bash
   cp .env.example .env
   ```

4. **Generate JWT keys**

   ```bash
   node src/config/generateKeys.js
   ```

5. **Start the development server**

   ```bash
   npm run dev
   ```

6. **Verify installation**

   The server should be running on `http://localhost:3000`. You can verify by visiting:

   ```
   GET http://localhost:3000/api/health
   ```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
PORT=3000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
ADMIN_URL=http://localhost:5174
BACKEND_URL=http://localhost:3000

# Database Configuration
DB_STRING=mongodb://localhost:27017/social_media
REDIS_URL=redis://localhost:6379

# JWT Configuration
JWT_SECRET=your_jwt_secret_key_here
JWT_REFRESH_SECRET=your_refresh_secret_key_here
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Cloudinary Configuration (for media uploads)
CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

# Email Configuration (for notifications)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password

# Stripe Configuration (for payments)
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Firebase Configuration (for push notifications)
FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour_firebase_private_key\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com

# Security Configuration
BCRYPT_SALT_ROUNDS=12
SESSION_SECRET=your_session_secret_key

# File Upload Configuration
MAX_FILE_SIZE=10485760
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,video/mp4,video/avi

# Rate Limiting
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX_REQUESTS=100
```

### Database Setup

1. **MongoDB Setup**

   ```bash
   # Start MongoDB service
   sudo systemctl start mongod  # Linux
   brew services start mongodb  # macOS
   # Or run directly: mongod
   ```

2. **Redis Setup**

   ```bash
   # Start Redis service
   sudo systemctl start redis   # Linux
   brew services start redis    # macOS
   # Or run directly: redis-server
   ```

3. **Database Initialization**
   ```bash
   # The application will automatically create collections on first run
   # No manual database setup required
   ```

### Available Scripts

```bash
# Development
npm run dev          # Start development server with nodemon
npm start           # Start production server

# Testing
npm test            # Run test suite
npm run test:watch  # Run tests in watch mode
npm run test:cov    # Run tests with coverage report

# Production
npm run build       # Build for production (if applicable)
npm run prod        # Start production server with PM2
```

## 🔐 Authentication

This application uses JWT (JSON Web Token) based authentication with refresh token rotation for enhanced security.

### Authentication Flow

1. **Registration/Login** → Receive access token (15min) + refresh token (7 days)
2. **API Requests** → Include access token in Authorization header
3. **Token Refresh** → Use refresh token to get new access token when expired
4. **Logout** → Invalidate refresh tokens

### Token Usage

**Access Token (Bearer Token)**

```http
Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Refresh Token (HTTP-Only Cookie)**

- Automatically sent with requests to `/api/refresh`
- Stored securely in HTTP-only cookie
- Rotated on each refresh for security

### Security Features

- **RS256 Algorithm** - Asymmetric signing with RSA keys
- **Token Rotation** - Refresh tokens are single-use
- **Replay Attack Protection** - Automatic session termination on suspicious activity
- **Redis Blacklisting** - Invalidated tokens stored in Redis
- **Secure Cookies** - HTTP-only, Secure, SameSite attributes

## 📚 API Documentation

Base URL: `http://localhost:3000/api`

### Response Format

All API responses follow a consistent format:

**Success Response:**

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    // Response data here
  }
}
```

**Error Response:**

```json
{
  "success": false,
  "message": "Error description",
  "error": {
    "code": "ERROR_CODE",
    "details": "Detailed error information"
  }
}
```

### HTTP Status Codes

- `200` - OK
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `422` - Unprocessable Entity
- `429` - Too Many Requests
- `500` - Internal Server Error

### API Endpoints

#### User Routes

#### Register a new user

- **URL**: `/user/register`
- **Method**: `POST`
- **Auth required**: No
- **Input**:
  ```json
  {
    "fullName": "string",
    "email": "string",
    "password": "string"
  }
  ```
- **Output**:
  ```json
  {
    "success": true,
    "message": "User registered successfully. Please verify your email.",
    "data": {
      "user": {
        "_id": "string",
        "fullName": "string",
        "email": "string",
        "createdAt": "date"
      }
    }
  }
  ```

#### Login

- **URL**: `/user/login`
- **Method**: `POST`
- **Auth required**: No
- **Input**:
  ```json
  {
    "email": "string",
    "password": "string"
  }
  ```
- **Output**:
  ```json
  {
    "success": true,
    "message": "Login successful",
    "data": {
      "user": {
        "_id": "string",
        "fullName": "string",
        "email": "string",
        "avatar_url": "string"
      },
      "accessToken": "string",
      "refreshToken": "string"
    }
  }
  ```

#### Get Current User

- **URL**: `/user`
- **Method**: `GET`
- **Auth required**: Yes
- **Output**:
  ```json
  {
    "_id": "string",
    "fullName": "string",
    "email": "string",
    "avatar_url": "string",
    "bio": "string",
    "createdAt": "date",
    "updatedAt": "date"
  }
  ```

#### Update User Profile

- **URL**: `/user/profile`
- **Method**: `PUT`
- **Auth required**: Yes
- **Content-Type**: `multipart/form-data`
- **Input**:
  - `fullName`: string (optional)
  - `bio`: string (optional)
  - `avatar`: file (optional)

### Post Routes

#### Create a Post

- **URL**: `/post`
- **Method**: `POST`
- **Auth required**: Yes
- **Content-Type**: `multipart/form-data`
- **Input**:
  - `content`: string
  - `media`: file(s) (optional, max 10)
  - `privacy`: string (public, friends, private)
- **Output**:
  ```json
  {
    "success": true,
    "message": "Post created successfully",
    "data": {
      "post": {
        "_id": "string",
        "content": "string",
        "author": {
          "_id": "string",
          "fullName": "string",
          "avatar_url": "string"
        },
        "media": [
          {
            "_id": "string",
            "url": "string",
            "type": "image|video",
            "filename": "string"
          }
        ],
        "privacy": "string",
        "createdAt": "date"
      }
    }
  }
  ```

#### Get Recommended Posts

- **URL**: `/post/recommend`
- **Method**: `GET`
- **Auth required**: Yes
- **Query Parameters**:
  - `page`: number (default: 1)
  - `limit`: number (default: 10)

#### Get User Posts

- **URL**: `/post`
- **Method**: `GET`
- **Auth required**: Yes

#### React to Post

- **URL**: `/post/reaction`
- **Method**: `POST`
- **Auth required**: Yes
- **Input**:
  ```json
  {
    "post_id": "string",
    "reaction_type": "like|love|haha|wow|sad|angry"
  }
  ```

#### Remove Post Reaction

- **URL**: `/post/reaction`
- **Method**: `DELETE`
- **Auth required**: Yes
- **Input**:
  ```json
  {
    "post_id": "string"
  }
  ```

#### Get Post Reactions

- **URL**: `/post/reactions/:postId`
- **Method**: `GET`
- **Auth required**: Yes
- **Output**:
  ```json
  {
    "reactions": [
      {
        "_id": "string",
        "user_id": {
          "_id": "string",
          "fullName": "string",
          "avatar_url": "string"
        },
        "type": "like|love|haha|wow|sad|angry",
        "createdAt": "date"
      }
    ],
    "counts": [
      {
        "_id": "like",
        "count": 5
      }
    ]
  }
  ```

### Comment Routes

#### Create a Comment

- **URL**: `/comment`
- **Method**: `POST`
- **Auth required**: Yes
- **Content-Type**: `multipart/form-data`
- **Input**:
  - `post_id`: string
  - `content`: string
  - `parent_comment_id`: string (optional, for replies)
  - `media`: file(s) (optional)

#### Get Comments for a Post

- **URL**: `/comment/:postId`
- **Method**: `GET`
- **Auth required**: Yes

#### React to Comment

- **URL**: `/comment/reaction`
- **Method**: `POST`
- **Auth required**: Yes
- **Input**:
  ```json
  {
    "comment_id": "string",
    "type": "like|love|haha|wow|sad|angry"
  }
  ```

### Friend & Follow Routes

#### Send Friend Request

- **URL**: `/friend-request`
- **Method**: `POST`
- **Auth required**: Yes
- **Input**:
  ```json
  {
    "user_id": "string"
  }
  ```

#### Respond to Friend Request

- **URL**: `/friend-request/:friendshipId`
- **Method**: `PATCH`
- **Auth required**: Yes
- **Input**:
  ```json
  {
    "action": "accept|decline"
  }
  ```

#### Get Friends List

- **URL**: `/friends`
- **Method**: `GET`
- **Auth required**: Yes

#### Get Incoming Friend Requests

- **URL**: `/friend-requests/incoming`
- **Method**: `GET`
- **Auth required**: Yes

#### Get Unfriended Users (Suggestions)

- **URL**: `/unfriended-users`
- **Method**: `GET`
- **Auth required**: Yes

### Channel & Chat Routes

#### Get Chat List (User's Channels)

- **URL**: `/chat/list`
- **Method**: `GET`
- **Auth required**: Yes
- **Output**:
  ```json
  {
    "success": true,
    "data": [
      {
        "channelId": "string",
        "type": "private|group",
        "name": "string",
        "avatar": "string",
        "lastMessage": {
          "content": "string",
          "media": [],
          "createdAt": "date",
          "from": {
            "_id": "string",
            "fullName": "string",
            "avatar_url": "string"
          },
          "messageType": "user|system"
        },
        "unreadCount": 5,
        "members": []
      }
    ]
  }
  ```

#### Get Channel Messages

- **URL**: `/chat/channel/:channelId/messages`
- **Method**: `GET`
- **Auth required**: Yes
- **Query Parameters**:
  - `page`: number (default: 1)
  - `limit`: number (default: 50)

#### Get or Create Private Channel

- **URL**: `/chat/private/:partnerId`
- **Method**: `GET`
- **Auth required**: Yes

#### Mark Channel as Read

- **URL**: `/chat/channel/:channelId/read`
- **Method**: `PATCH`
- **Auth required**: Yes

#### Get Channel Info

- **URL**: `/chat/channel/:channelId/info`
- **Method**: `GET`
- **Auth required**: Yes

### Channel Management Routes

#### Create Group Channel

- **URL**: `/channel/group`
- **Method**: `POST`
- **Auth required**: Yes
- **Input**:
  ```json
  {
    "name": "string",
    "memberIds": ["string"],
    "avatar": "string"
  }
  ```

#### Update Group Name

- **URL**: `/channel/:channelId/name`
- **Method**: `PUT`
- **Auth required**: Yes
- **Input**:
  ```json
  {
    "name": "string"
  }
  ```

#### Add Member to Group

- **URL**: `/channel/:channelId/members`
- **Method**: `POST`
- **Auth required**: Yes
- **Input**:
  ```json
  {
    "memberIds": ["string"]
  }
  ```

#### Remove Member from Group

- **URL**: `/channel/:channelId/members/:memberId`
- **Method**: `DELETE`
- **Auth required**: Yes

#### Change Member Role

- **URL**: `/channel/:channelId/members/:memberId/role`
- **Method**: `PATCH`
- **Auth required**: Yes
- **Input**:
  ```json
  {
    "role": "admin|member"
  }
  ```

#### Delete Group Channel

- **URL**: `/channel/:channelId`
- **Method**: `DELETE`
- **Auth required**: Yes

#### Get User Channels

- **URL**: `/channel/user`
- **Method**: `GET`
- **Auth required**: Yes

#### Get Channel Details

- **URL**: `/channel/:channelId`
- **Method**: `GET`
- **Auth required**: Yes

### Group Routes

#### Create Group

- **URL**: `/group`
- **Method**: `POST`
- **Auth required**: Yes
- **Content-Type**: `multipart/form-data`
- **Input**:
  - `name`: string
  - `description`: string
  - `privacy`: "public|private"
  - `media`: file(s) (optional)

#### Get All Groups

- **URL**: `/group`
- **Method**: `GET`
- **Auth required**: Yes

#### Get My Groups

- **URL**: `/group/my`
- **Method**: `GET`
- **Auth required**: Yes

#### Join Group

- **URL**: `/group/:groupId/join`
- **Method**: `POST`
- **Auth required**: Yes

#### Leave Group

- **URL**: `/group/:groupId/leave`
- **Method**: `POST`
- **Auth required**: Yes

### Media Routes

#### Get User Images

- **URL**: `/media/images/:userId`
- **Method**: `GET`
- **Auth required**: Yes

#### Get User Videos

- **URL**: `/media/videos/:userId`
- **Method**: `GET`
- **Auth required**: Yes

#### Get User Media Stats

- **URL**: `/media/stats/:userId`
- **Method**: `GET`
- **Auth required**: Yes

### Notification Routes

#### Get Notifications

- **URL**: `/notifications`
- **Method**: `GET`
- **Auth required**: Yes
- **Query Parameters**:
  - `page`: number (default: 1)
  - `limit`: number (default: 10)

#### Get Unread Notifications Count

- **URL**: `/notifications/unread-count`
- **Method**: `GET`
- **Auth required**: Yes

#### Mark Notification as Read

- **URL**: `/notifications/:notificationId/read`
- **Method**: `PATCH`
- **Auth required**: Yes

#### Mark All Notifications as Read

- **URL**: `/notifications/read-all`
- **Method**: `PATCH`
- **Auth required**: Yes

#### Delete Notification

- **URL**: `/notifications/:notificationId`
- **Method**: `DELETE`
- **Auth required**: Yes

### Token Routes

#### Refresh Access Token

- **URL**: `/refresh`
- **Method**: `GET`
- **Auth required**: No (requires refresh token in cookies)

## 🌐 WebSocket API

The application uses Socket.IO with namespaces for real-time communication.

### Namespaces

#### Messages Namespace (`/messages`)

Handle real-time messaging in channels.

##### Events

**Register for Messaging**

- **Event**: `register_messaging`
- **Data**:
  ```json
  {
    "userId": "string"
  }
  ```

**Join User Channels**

- **Event**: `join_channels`
- **Data**:
  ```json
  {
    "userId": "string"
  }
  ```

**Send Channel Message**

- **Event**: `send_channel_message`
- **Data**:
  ```json
  {
    "from": "string",
    "channelId": "string",
    "content": "string",
    "media": ["base64 string"] // optional
  }
  ```

**Receive Channel Message**

- **Event**: `receive_channel_message`
- **Data**:
  ```json
  {
    "message": {
      "_id": "string",
      "from": {
        "_id": "string",
        "fullName": "string",
        "avatar_url": "string"
      },
      "channelId": "string",
      "content": "string",
      "media": [],
      "messageType": "user|system",
      "createdAt": "date"
    },
    "channel": {
      "channelId": "string",
      "type": "private|group",
      "name": "string"
    }
  }
  ```

**Typing Indicators**

- **Event**: `typing_start`
- **Data**:

  ```json
  {
    "channelId": "string",
    "userId": "string",
    "userName": "string"
  }
  ```

- **Event**: `typing_stop`
- **Data**:
  ```json
  {
    "channelId": "string",
    "userId": "string"
  }
  ```

**Mark Channel as Read**

- **Event**: `mark_channel_read`
- **Data**:
  ```json
  {
    "channelId": "string",
    "userId": "string"
  }
  ```

**System Messages**

- **Event**: `send_system_message`
- **Data**:
  ```json
  {
    "channelId": "string",
    "action": "member_added|member_removed|group_renamed",
    "fromUser": "string",
    "targetUser": "string",
    "oldValue": "string",
    "newValue": "string"
  }
  ```

#### Notifications Namespace (`/notifications`)

Handle real-time notifications.

##### Events

**Register for Notifications**

- **Event**: `register_notifications`
- **Data**:
  ```json
  {
    "userId": "string"
  }
  ```

**Get Notifications**

- **Event**: `get_notifications`
- **Data**:
  ```json
  {
    "limit": 20,
    "skip": 0
  }
  ```

**Mark Notification as Read**

- **Event**: `mark_notification_read`
- **Data**:
  ```json
  {
    "notificationId": "string"
  }
  ```

**Mark All Notifications as Read**

- **Event**: `mark_all_notifications_read`

**Receive Events**

- **Event**: `notifications_list` - Array of notifications
- **Event**: `unread_count_update` - Unread count number
- **Event**: `new_notification` - New notification object

## 🗄️ Database Models

### User Model

```javascript
{
  _id: ObjectId,
  fullName: String,
  email: String (unique),
  password: String (hashed),
  avatar_url: String,
  bio: String,
  isEmailVerified: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Post Model

```javascript
{
  _id: ObjectId,
  content: String,
  author: ObjectId (ref: User),
  media: [MediaSchema],
  privacy: String (public, friends, private),
  comments_count: Number,
  shares_count: Number,
  createdAt: Date,
  updatedAt: Date,
  is_deleted: Boolean
}
```

### Channel Model

```javascript
{
  _id: ObjectId,
  channelId: String (unique),
  type: String (private, group),
  name: String, // for groups only
  avatar: String, // for groups only
  members: [{
    userId: ObjectId (ref: User),
    role: String (admin, member),
    joinedAt: Date,
    isMuted: Boolean
  }],
  createdBy: String,
  createdAt: Date,
  updatedAt: Date
}
```

### Message Model

```javascript
{
  _id: ObjectId,
  from: ObjectId (ref: User),
  channelId: String,
  content: String,
  media: [MediaSchema],
  readBy: [{
    userId: ObjectId (ref: User),
    readAt: Date
  }],
  messageType: String (user, system),
  systemMessageData: {
    action: String,
    targetUser: ObjectId (ref: User),
    oldValue: String,
    newValue: String
  },
  createdAt: Date,
  updatedAt: Date
}
```

### Notification Model

```javascript
{
  _id: ObjectId,
  user_id: ObjectId (ref: User),
  type: String,
  content: String,
  data: Object,
  is_read: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

### Additional Models

#### Comment Model

```javascript
{
  _id: ObjectId,
  user_id: ObjectId (ref: User),
  post_id: ObjectId (ref: Post),
  content: String,
  parent_comment_id: ObjectId (ref: Comment), // for replies
  media: [MediaSchema],
  isDeleted: Boolean,
  deleted_at: Date,
  createdAt: Date,
  updatedAt: Date
}
```

#### Reaction Models

```javascript
// PostReaction Model
{
  _id: ObjectId,
  user_id: ObjectId (ref: User),
  post_id: ObjectId (ref: Post),
  type: String (like, love, haha, wow, sad, angry),
  createdAt: Date
}

// CommentReaction Model
{
  _id: ObjectId,
  user_id: ObjectId (ref: User),
  comment_id: ObjectId (ref: Comment),
  type: String (like, love, haha, wow, sad, angry),
  createdAt: Date
}
```

#### Friendship Model

```javascript
{
  _id: ObjectId,
  sender_id: ObjectId (ref: User),
  receiver_id: ObjectId (ref: User),
  status: String (pending, accepted, declined, blocked),
  requested_at: Date,
  responded_at: Date,
  created_at: Date,
  updated_at: Date
}
```

#### Media Model

```javascript
{
  _id: ObjectId,
  user_id: ObjectId (ref: User),
  url: String,
  media_type: String (image, video),
  filename: String,
  size: Number,
  createdAt: Date
}
```

#### Group Model

```javascript
{
  _id: ObjectId,
  name: String,
  description: String,
  privacy: String (public, private),
  creator_id: ObjectId (ref: User),
  media: [MediaSchema],
  members: [{
    user_id: ObjectId (ref: User),
    role: String (admin, moderator, member),
    joined_at: Date
  }],
  createdAt: Date,
  updatedAt: Date
}
```

## 🚀 Deployment

### Production Environment Setup

1. **Environment Configuration**

   ```bash
   # Set NODE_ENV to production
   NODE_ENV=production

   # Use production database URLs
   DB_STRING=mongodb://your-production-mongodb-url
   REDIS_URL=redis://your-production-redis-url
   ```

2. **Security Hardening**

   ```bash
   # Generate strong JWT secrets
   JWT_SECRET=$(openssl rand -base64 64)
   JWT_REFRESH_SECRET=$(openssl rand -base64 64)

   # Use HTTPS in production
   FRONTEND_URL=https://yourdomain.com
   ```

3. **Database Setup**

   ```bash
   # MongoDB Atlas (recommended)
   DB_STRING=mongodb+srv://username:password@cluster.mongodb.net/social_media

   # Redis Cloud (recommended)
   REDIS_URL=redis://username:password@redis-host:port
   ```

### Docker Deployment

Create a `Dockerfile`:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src/ ./src/

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

EXPOSE 3000

CMD ["npm", "start"]
```

Create a `docker-compose.yml`:

```yaml
version: "3.8"

services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DB_STRING=mongodb://mongo:27017/social_media
      - REDIS_URL=redis://redis:6379
    depends_on:
      - mongo
      - redis
    volumes:
      - ./logs:/app/logs

  mongo:
    image: mongo:6
    restart: always
    volumes:
      - mongo_data:/data/db
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: password

  redis:
    image: redis:7-alpine
    restart: always
    volumes:
      - redis_data:/data

volumes:
  mongo_data:
  redis_data:
```

### PM2 Deployment

1. **Install PM2**

   ```bash
   npm install -g pm2
   ```

2. **Create ecosystem file** (`ecosystem.config.js`):

   ```javascript
   module.exports = {
     apps: [
       {
         name: "social-media-api",
         script: "src/server.js",
         instances: "max",
         exec_mode: "cluster",
         env: {
           NODE_ENV: "development",
           PORT: 3000,
         },
         env_production: {
           NODE_ENV: "production",
           PORT: 3000,
         },
         error_file: "./logs/err.log",
         out_file: "./logs/out.log",
         log_file: "./logs/combined.log",
         time: true,
       },
     ],
   };
   ```

3. **Deploy with PM2**
   ```bash
   pm2 start ecosystem.config.js --env production
   pm2 startup
   pm2 save
   ```

### Cloud Deployment Options

#### Heroku

```bash
# Install Heroku CLI and login
heroku create social-media-api

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set DB_STRING=your_mongodb_url

# Deploy
git push heroku main
```

#### Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway new
railway up
```

#### DigitalOcean App Platform

- Connect your GitHub repository
- Configure environment variables
- Deploy automatically on git push

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (development)
npm run test:watch

# Run tests with coverage report
npm run test:cov

# Run specific test file
npm test -- user.test.js

# Run tests matching pattern
npm test -- --testNamePattern="auth"
```

### Test Structure

```
src/__tests__/
├── unit/                 # Unit tests
│   ├── controllers/
│   ├── models/
│   ├── services/
│   └── utils/
├── integration/          # Integration tests
│   ├── auth.test.js
│   ├── posts.test.js
│   └── messaging.test.js
├── fixtures/            # Test data
└── helpers/             # Test utilities
```

### Writing Tests

Example test file:

```javascript
const request = require("supertest");
const app = require("../app");
const User = require("../models/user.model");

describe("User Authentication", () => {
  beforeEach(async () => {
    await User.deleteMany({});
  });

  test("should register a new user", async () => {
    const userData = {
      fullName: "Test User",
      email: "test@example.com",
      password: "password123",
    };

    const response = await request(app).post("/api/user/register").send(userData).expect(201);

    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe(userData.email);
  });
});
```

### Test Coverage Goals

- **Unit Tests**: 90%+ coverage
- **Integration Tests**: All critical API endpoints
- **E2E Tests**: Core user journeys

## 🤝 Contributing

### Development Workflow

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. **Make your changes**
4. **Write/update tests**
5. **Ensure tests pass**
   ```bash
   npm test
   ```
6. **Commit your changes**
   ```bash
   git commit -m "feat: add your feature description"
   ```
7. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```
8. **Create a Pull Request**

### Code Style Guidelines

- **ESLint**: Follow the configured ESLint rules
- **Prettier**: Code formatting with Prettier
- **Naming Conventions**:
  - Files: `kebab-case.js`
  - Variables/Functions: `camelCase`
  - Constants: `UPPER_SNAKE_CASE`
  - Classes: `PascalCase`

### Commit Message Format

```
type(scope): description

[optional body]

[optional footer]
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:

```
feat(auth): add JWT refresh token rotation
fix(posts): resolve image upload memory leak
docs(readme): update API documentation
```

### Pull Request Guidelines

- Clear description of changes
- Reference related issues
- Include tests for new features
- Update documentation if needed
- Ensure CI/CD passes

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 📞 Support & Contact

- **Issues**: [GitHub Issues](https://github.com/phuongnlh/social_media_BE/issues)
- **Documentation**: This README and inline code comments
- **Email**: support@yourdomain.com

## 🔄 Changelog

### v1.0.0 (Latest)

- Initial release with core features
- User authentication and authorization
- Real-time messaging system
- Social features (posts, comments, reactions)
- Admin dashboard
- Payment integration

### Roadmap

- [ ] Voice/Video calling integration
- [ ] Advanced content recommendation
- [ ] Multi-language support
- [ ] Mobile app APIs
- [ ] Analytics dashboard enhancements

---

**Happy Coding! 🚀**
