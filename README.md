# Social Media Backend API

This repository contains the backend API for a social media application. It provides endpoints for user authentication, post management, friend relationships, messaging, and more.

## Table of Contents

- [Setup](#setup)
- [Authentication](#authentication)
- [API Endpoints](#api-endpoints)
  - [User Routes](#user-routes)
  - [Post Routes](#post-routes)
  - [Comment Routes](#comment-routes)
  - [Like Routes](#like-routes)
  - [Friend & Follow Routes](#friend--follow-routes)
  - [Notification Routes](#notification-routes)
  - [Token Routes](#token-routes)
- [WebSocket API](#websocket-api)

## Setup

### Prerequisites

- Node.js
- MongoDB
- Redis
- Cloudinary account (for media uploads)

### Installation

1. Clone the repository
2. Install dependencies:
   ```
   npm install
   ```
3. Set up environment variables (create a `.env` file in the root directory)
4. Start the server:
   ```
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
    "username": "string",
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
        "username": "string",
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
        "username": "string",
        "email": "string"
      },
      "accessToken": "string",
      "refreshToken": "string"
    }
  }
  ```

#### Verify Email

- **URL**: `/user/verify-email`
- **Method**: `GET`
- **Auth required**: No
- **Query Parameters**: `token=<verification-token>`
- **Output**: Redirects to frontend with success/error message

#### Logout

- **URL**: `/user/logout`
- **Method**: `POST`
- **Auth required**: Yes
- **Output**:
  ```json
  {
    "success": true,
    "message": "Logged out successfully"
  }
  ```

#### Logout from all devices

- **URL**: `/user/logout-all`
- **Method**: `POST`
- **Auth required**: Yes
- **Output**:
  ```json
  {
    "success": true,
    "message": "Logged out from all devices"
  }
  ```

#### Change Password

- **URL**: `/user/change-password`
- **Method**: `POST`
- **Auth required**: Yes
- **Input**:
  ```json
  {
    "currentPassword": "string",
    "newPassword": "string"
  }
  ```
- **Output**:
  ```json
  {
    "success": true,
    "message": "Password changed successfully"
  }
  ```

#### Forgot Password

- **URL**: `/user/forgot-password`
- **Method**: `POST`
- **Auth required**: No
- **Input**:
  ```json
  {
    "email": "string"
  }
  ```
- **Output**:
  ```json
  {
    "success": true,
    "message": "Password reset link sent to your email"
  }
  ```

#### Reset Password

- **URL**: `/user/reset-password`
- **Method**: `POST`
- **Auth required**: No
- **Input**:
  ```json
  {
    "token": "string",
    "newPassword": "string"
  }
  ```
- **Output**:
  ```json
  {
    "success": true,
    "message": "Password reset successfully"
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
    "username": "string",
    "email": "string",
    "profilePicture": "string",
    "bio": "string",
    "createdAt": "date",
    "updatedAt": "date"
  }
  ```

### Post Routes

#### Create a Post

- **URL**: `/post`
- **Method**: `POST`
- **Auth required**: Yes
- **Content-Type**: `multipart/form-data`
- **Input**:
  - `content`: string
  - `media`: file(s) (optional, max 10)
  - `visibility`: string (public, friends, private)
- **Output**:
  ```json
  {
    "success": true,
    "message": "Post created successfully",
    "data": {
      "post": {
        "_id": "string",
        "content": "string",
        "author": "string",
        "media": ["string"],
        "visibility": "string",
        "createdAt": "date",
        "updatedAt": "date"
      }
    }
  }
  ```

#### Get All Posts by User

- **URL**: `/post`
- **Method**: `GET`
- **Auth required**: Yes
- **Query Parameters**:
  - `page`: number (default: 1)
  - `limit`: number (default: 10)
- **Output**:
  ```json
  {
    "success": true,
    "data": {
      "posts": [
        {
          "_id": "string",
          "content": "string",
          "author": {
            "_id": "string",
            "username": "string",
            "profilePicture": "string"
          },
          "media": ["string"],
          "visibility": "string",
          "createdAt": "date",
          "updatedAt": "date"
        }
      ],
      "pagination": {
        "totalPosts": "number",
        "totalPages": "number",
        "currentPage": "number",
        "limit": "number"
      }
    }
  }
  ```

#### Get Post by ID

- **URL**: `/post/:id`
- **Method**: `GET`
- **Auth required**: Yes
- **Output**:
  ```json
  {
    "success": true,
    "data": {
      "post": {
        "_id": "string",
        "content": "string",
        "author": {
          "_id": "string",
          "username": "string",
          "profilePicture": "string"
        },
        "media": ["string"],
        "visibility": "string",
        "createdAt": "date",
        "updatedAt": "date"
      }
    }
  }
  ```

#### Update Post

- **URL**: `/post/:id`
- **Method**: `PUT`
- **Auth required**: Yes
- **Input**:
  ```json
  {
    "content": "string",
    "visibility": "string"
  }
  ```
- **Output**:
  ```json
  {
    "success": true,
    "message": "Post updated successfully",
    "data": {
      "post": {
        "_id": "string",
        "content": "string",
        "author": "string",
        "media": ["string"],
        "visibility": "string",
        "updatedAt": "date"
      }
    }
  }
  ```

#### Soft Delete Post

- **URL**: `/post/:id`
- **Method**: `DELETE`
- **Auth required**: Yes
- **Output**:
  ```json
  {
    "success": true,
    "message": "Post moved to trash"
  }
  ```

#### Restore Post from Trash

- **URL**: `/post/:id/restore`
- **Method**: `PATCH`
- **Auth required**: Yes
- **Output**:
  ```json
  {
    "success": true,
    "message": "Post restored successfully"
  }
  ```

#### Get Trashed Posts

- **URL**: `/post/trash`
- **Method**: `GET`
- **Auth required**: Yes
- **Output**:
  ```json
  {
    "success": true,
    "data": {
      "posts": [
        {
          "_id": "string",
          "content": "string",
          "author": "string",
          "media": ["string"],
          "visibility": "string",
          "deletedAt": "date"
        }
      ]
    }
  }
  ```

### Comment Routes

#### Create a Comment

- **URL**: `/comments`
- **Method**: `POST`
- **Auth required**: Yes
- **Input**:
  ```json
  {
    "postId": "string",
    "content": "string",
    "parentId": "string" // Optional, for replies
  }
  ```
- **Output**:
  ```json
  {
    "success": true,
    "message": "Comment created successfully",
    "data": {
      "comment": {
        "_id": "string",
        "post_id": "string",
        "user_id": {
          "_id": "string",
          "username": "string",
          "avatar_url": "string"
        },
        "content": "string",
        "parent_id": "string or null",
        "created_at": "date",
        "updated_at": "date"
      }
    }
  }
  ```

#### Get Comments for a Post

- **URL**: `/comments/post/:postId`
- **Method**: `GET`
- **Auth required**: Yes
- **Query Parameters**:
  - `page`: number (default: 1)
  - `limit`: number (default: 10)
- **Output**:
  ```json
  {
    "success": true,
    "data": {
      "comments": [
        {
          "_id": "string",
          "post_id": "string",
          "user_id": {
            "_id": "string",
            "username": "string",
            "avatar_url": "string"
          },
          "content": "string",
          "created_at": "date",
          "updated_at": "date",
          "replies": [
            {
              "_id": "string",
              "post_id": "string",
              "user_id": {
                "_id": "string",
                "username": "string",
                "avatar_url": "string"
              },
              "content": "string",
              "parent_id": "string",
              "created_at": "date",
              "updated_at": "date"
            }
          ]
        }
      ],
      "pagination": {
        "total": "number",
        "page": "number",
        "limit": "number",
        "pages": "number"
      }
    }
  }
  ```

#### Update a Comment

- **URL**: `/comments/:commentId`
- **Method**: `PUT`
- **Auth required**: Yes
- **Input**:
  ```json
  {
    "content": "string"
  }
  ```
- **Output**:
  ```json
  {
    "success": true,
    "message": "Comment updated successfully",
    "data": {
      "comment": {
        "_id": "string",
        "content": "string",
        "updated_at": "date"
      }
    }
  }
  ```

#### Delete a Comment

- **URL**: `/comments/:commentId`
- **Method**: `DELETE`
- **Auth required**: Yes
- **Output**:
  ```json
  {
    "success": true,
    "message": "Comment deleted successfully"
  }
  ```

### Like Routes

#### Like a Post

- **URL**: `/likes/post`
- **Method**: `POST`
- **Auth required**: Yes
- **Input**:
  ```json
  {
    "postId": "string"
  }
  ```
- **Output**:
  ```json
  {
    "success": true,
    "message": "Post liked successfully",
    "data": {
      "likesCount": "number"
    }
  }
  ```

#### Unlike a Post

- **URL**: `/likes/post/:postId`
- **Method**: `DELETE`
- **Auth required**: Yes
- **Output**:
  ```json
  {
    "success": true,
    "message": "Post unliked successfully",
    "data": {
      "likesCount": "number"
    }
  }
  ```

#### Get Users Who Liked a Post

- **URL**: `/likes/post/:postId`
- **Method**: `GET`
- **Auth required**: Yes
- **Query Parameters**:
  - `page`: number (default: 1)
  - `limit`: number (default: 10)
- **Output**:
  ```json
  {
    "success": true,
    "data": {
      "likes": [
        {
          "_id": "string",
          "username": "string",
          "avatar_url": "string"
        }
      ],
      "pagination": {
        "total": "number",
        "page": "number",
        "limit": "number",
        "pages": "number"
      }
    }
  }
  ```

#### Like a Comment

- **URL**: `/likes/comment`
- **Method**: `POST`
- **Auth required**: Yes
- **Input**:
  ```json
  {
    "commentId": "string"
  }
  ```
- **Output**:
  ```json
  {
    "success": true,
    "message": "Comment liked successfully",
    "data": {
      "likesCount": "number"
    }
  }
  ```

#### Unlike a Comment

- **URL**: `/likes/comment/:commentId`
- **Method**: `DELETE`
- **Auth required**: Yes
- **Output**:
  ```json
  {
    "success": true,
    "message": "Comment unliked successfully",
    "data": {
      "likesCount": "number"
    }
  }
  ```

#### Get Users Who Liked a Comment

- **URL**: `/likes/comment/:commentId`
- **Method**: `GET`
- **Auth required**: Yes
- **Query Parameters**:
  - `page`: number (default: 1)
  - `limit`: number (default: 10)
- **Output**:
  ```json
  {
    "success": true,
    "data": {
      "likes": [
        {
          "_id": "string",
          "username": "string",
          "avatar_url": "string"
        }
      ],
      "pagination": {
        "total": "number",
        "page": "number",
        "limit": "number",
        "pages": "number"
      }
    }
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
    "receiverId": "string"
  }
  ```
- **Output**:
  ```json
  {
    "success": true,
    "message": "Friend request sent",
    "data": {
      "friendship": {
        "_id": "string",
        "sender": "string",
        "receiver": "string",
        "status": "pending",
        "createdAt": "date"
      }
    }
  }
  ```

#### Respond to Friend Request

- **URL**: `/friend-request/:friendshipId`
- **Method**: `PATCH`
- **Auth required**: Yes
- **Input**:
  ```json
  {
    "status": "accepted" | "rejected"
  }
  ```
- **Output**:
  ```json
  {
    "success": true,
    "message": "Friend request accepted/rejected",
    "data": {
      "friendship": {
        "_id": "string",
        "sender": "string",
        "receiver": "string",
        "status": "string",
        "updatedAt": "date"
      }
    }
  }
  ```

#### Follow User

- **URL**: `/follow`
- **Method**: `POST`
- **Auth required**: Yes
- **Input**:
  ```json
  {
    "userId": "string"
  }
  ```
- **Output**:
  ```json
  {
    "success": true,
    "message": "User followed successfully",
    "data": {
      "follower": {
        "_id": "string",
        "follower": "string",
        "following": "string",
        "createdAt": "date"
      }
    }
  }
  ```

#### Unfollow User

- **URL**: `/unfollow`
- **Method**: `DELETE`
- **Auth required**: Yes
- **Input**:
  ```json
  {
    "userId": "string"
  }
  ```
- **Output**:
  ```json
  {
    "success": true,
    "message": "User unfollowed successfully"
  }
  ```

#### Get Friends List

- **URL**: `/friends`
- **Method**: `GET`
- **Auth required**: Yes
- **Output**:
  ```json
  {
    "success": true,
    "data": {
      "friends": [
        {
          "_id": "string",
          "username": "string",
          "email": "string",
          "profilePicture": "string"
        }
      ]
    }
  }
  ```

#### Get Incoming Friend Requests

- **URL**: `/friend-requests/incoming`
- **Method**: `GET`
- **Auth required**: Yes
- **Output**:
  ```json
  {
    "success": true,
    "data": {
      "requests": [
        {
          "_id": "string",
          "sender": {
            "_id": "string",
            "username": "string",
            "profilePicture": "string"
          },
          "status": "pending",
          "createdAt": "date"
        }
      ]
    }
  }
  ```

#### Get Followers

- **URL**: `/followers`
- **Method**: `GET`
- **Auth required**: Yes
- **Output**:
  ```json
  {
    "success": true,
    "data": {
      "followers": [
        {
          "_id": "string",
          "username": "string",
          "email": "string",
          "profilePicture": "string"
        }
      ]
    }
  }
  ```

#### Get Followings

- **URL**: `/followings`
- **Method**: `GET`
- **Auth required**: Yes
- **Output**:
  ```json
  {
    "success": true,
    "data": {
      "followings": [
        {
          "_id": "string",
          "username": "string",
          "email": "string",
          "profilePicture": "string"
        }
      ]
    }
  }
  ```

### Notification Routes

#### Get Notifications

- **URL**: `/notifications`
- **Method**: `GET`
- **Auth required**: Yes
- **Query Parameters**:
  - `page`: number (default: 1)
  - `limit`: number (default: 10)
- **Output**:
  ```json
  {
    "success": true,
    "data": {
      "notifications": [
        {
          "_id": "string",
          "user_id": "string",
          "type": "string",
          "content": "string",
          "is_read": false,
          "createdAt": "date",
          "updatedAt": "date"
        }
      ],
      "pagination": {
        "total": "number",
        "page": "number",
        "limit": "number",
        "pages": "number"
      }
    }
  }
  ```

#### Get Unread Notifications Count

- **URL**: `/notifications/unread-count`
- **Method**: `GET`
- **Auth required**: Yes
- **Output**:
  ```json
  {
    "success": true,
    "data": {
      "count": "number"
    }
  }
  ```

#### Mark Notification as Read

- **URL**: `/notifications/:notificationId/read`
- **Method**: `PATCH`
- **Auth required**: Yes
- **Output**:
  ```json
  {
    "success": true,
    "message": "Notification marked as read",
    "data": {
      "notification": {
        "_id": "string",
        "user_id": "string",
        "type": "string",
        "content": "string",
        "is_read": true,
        "updatedAt": "date"
      }
    }
  }
  ```

#### Mark All Notifications as Read

- **URL**: `/notifications/read-all`
- **Method**: `PATCH`
- **Auth required**: Yes
- **Output**:
  ```json
  {
    "success": true,
    "message": "All notifications marked as read"
  }
  ```

#### Delete Notification

- **URL**: `/notifications/:notificationId`
- **Method**: `DELETE`
- **Auth required**: Yes
- **Output**:
  ```json
  {
    "success": true,
    "message": "Notification deleted successfully"
  }
  ```

### Token Routes

#### Refresh Access Token

- **URL**: `/refresh`
- **Method**: `GET`
- **Auth required**: No (requires refresh token in cookies)
- **Output**:
  ```json
  {
    "success": true,
    "data": {
      "accessToken": "string"
    }
  }
  ```

## WebSocket API

The application uses Socket.IO for real-time communication features.

### Connection

- Connect to the socket server:
  ```javascript
  const socket = io("server-url");
  ```

### Events

#### Register User

- **Event**: `register`
- **Data**:
  ```json
  {
    "userId": "string"
  }
  ```

#### Send Message

- **Event**: `send-message`
- **Data**:
  ```json
  {
    "from": "string (userId)",
    "to": "string (userId)",
    "content": "string",
    "media": ["base64 encoded string"] // optional
  }
  ```

#### Receive Message

- **Event**: `receive_message`
- **Data**:
  ```json
  {
    "_id": "string",
    "from": "string (userId)",
    "to": "string (userId)",
    "content": "string",
    "media": ["string (urls)"],
    "createdAt": "date"
  }
  ```

#### Message Sent Confirmation

- **Event**: `message-sent`
- **Data**: Same as `receive_message`

#### Error Message

- **Event**: `error-message`
- **Data**: `string` (error message)

#### Send Notification
- **Event**: `send-notification`
- **Data**:
  ```json
  {
    "userId": "string",
    "type": "string",
    "content": "string"
  }
  ```

#### New Notification
- **Event**: `new-notification`
- **Data**:
  ```json
  {
    "_id": "string",
    "user_id": "string",
    "type": "string",
    "content": "string",
    "is_read": false,
    "createdAt": "date"
  }
  ```

#### Notification Sent Confirmation
- **Event**: `notification-sent`
- **Data**:
  ```json
  {
    "success": true,
    "notification": {
      "_id": "string",
      "user_id": "string",
      "type": "string",
      "content": "string",
      "is_read": false,
      "createdAt": "date"
    }
  }
  ```

#### Mark Notification as Read
- **Event**: `mark-notification-read`
- **Data**:
  ```json
  {
    "notificationId": "string"
  }
  ```

#### Notification Updated
- **Event**: `notification-updated`
- **Data**: Notification object with updated fields

#### Mark All Notifications as Read
- **Event**: `mark-all-notifications-read`
- **Data**:
  ```json
  {
    "userId": "string"
  }
  ```

#### All Notifications Updated
- **Event**: `all-notifications-updated`
- **Data**:
  ```json
  {
    "success": true
  }
  ```

#### Get Notifications
- **Event**: `get-notifications`
- **Data**:
  ```json
  {
    "userId": "string"
  }
  ```

#### Notifications List
- **Event**: `notifications-list`
- **Data**: Array of notification objects

#### Error Notification
- **Event**: `error-notification`
- **Data**: `string` (error message)

#### Notifications Refresh Needed
- **Event**: `notifications-refresh-needed`
- **Description**: Notifies client to refresh notifications list

#### Disconnect

- **Event**: `disconnect`
- **Description**: Automatically handles cleaning up socket connections when a user disconnects

## License

This project is licensed under the MIT License.
