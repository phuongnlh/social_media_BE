# Social Media Backend API

This repository contains the backend API for a social media application with channel-based messaging system. It provides endpoints for user authentication, post management, friend relationships, channel messaging, group management, and real-time notifications.

## Table of Contents

- [Setup](#setup)
- [Authentication](#authentication)
- [API Endpoints](#api-endpoints)
  - [User Routes](#user-routes)
  - [Post Routes](#post-routes)
  - [Comment Routes](#comment-routes)
  - [Reaction Routes](#reaction-routes)
  - [Friend & Follow Routes](#friend--follow-routes)
  - [Channel & Chat Routes](#channel--chat-routes)
  - [Group Routes](#group-routes)
  - [Media Routes](#media-routes)
  - [Notification Routes](#notification-routes)
  - [Token Routes](#token-routes)
- [WebSocket API](#websocket-api)
- [Models](#models)

## Setup

### Prerequisites

- Node.js (v14 or higher)
- MongoDB
- Redis
- Cloudinary account (for media uploads)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables (create a `.env` file in the root directory):
   ```env
   PORT=3000
   MONGODB_URI=mongodb://localhost:27017/social_media
   REDIS_URL=redis://localhost:6379
   JWT_SECRET=your_jwt_secret
   JWT_REFRESH_SECRET=your_refresh_secret
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret
   EMAIL_HOST=smtp.gmail.com
   EMAIL_PORT=587
   EMAIL_USER=your_email
   EMAIL_PASS=your_password
   ```
4. Start the server:
   ```bash
   npm start
   ```

## Authentication

Most endpoints require authentication using JWT (JSON Web Token).
To authenticate, include the token in the Authorization header as a Bearer token:

```
Authorization: Bearer <your-token>
```

The token is obtained by logging in or registering a new user.

## API Endpoints

### User Routes

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

## WebSocket API

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

## Models

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

## License

This project is licensed under the MIT License.
