# API Routes Summary

## Chat Routes (`/api/chat`)

### Channel Operations

- `GET /chat-list` - Lấy danh sách channels với tin nhắn cuối cùng
- `GET /channels/:channelId/messages` - Lấy tin nhắn của một channel
- `GET /channels/:channelId/info` - Lấy thông tin chi tiết channel
- `GET /channels/:channelId/statistics` - Lấy thống kê channel
- `POST /channels/:channelId/mark-read` - Đánh dấu channel đã đọc
- `POST /channels/private/:partnerId` - Tạo hoặc lấy private channel

### Search & Friends

- `GET /search?query=...` - Tìm kiếm users và groups
- `GET /friends` - Lấy danh sách bạn bè

### Backward Compatibility

- `GET /messages/:userId` - Lấy tin nhắn với user (deprecated)
- `POST /mark-as-read/:partnerId` - Đánh dấu đã đọc (deprecated)

## Channel Management Routes (`/api/channels`)

### Basic Channel Operations

- `POST /private` - Tạo private channel 1-1
- `POST /group` - Tạo group channel
- `GET /` - Lấy danh sách channels của user
- `GET /:channelId` - Lấy chi tiết channel

### Group Management

- `PUT /:channelId/name` - Đổi tên group
- `PUT /:channelId/avatar` - Đổi avatar group
- `POST /:channelId/members` - Thêm thành viên vào group
- `DELETE /:channelId/members/:memberId` - Xóa thành viên khỏi group
- `POST /:channelId/leave` - Rời khỏi group
- `PUT /:channelId/members/:memberId/role` - Thay đổi role thành viên
- `DELETE /:channelId` - Xóa group channel

## Request/Response Examples

### Create Group Channel

```json
POST /api/channels/group
{
  "name": "Project Team",
  "memberIds": ["user1", "user2", "user3"],
  "avatar": "https://example.com/avatar.jpg"
}
```

### Search Users and Groups

```json
GET /api/chat/search?query=john

Response:
{
  "success": true,
  "data": {
    "friends": [...],
    "groups": [...]
  }
}
```

### Get Chat List

```json
GET /api/chat/chat-list

Response:
{
  "success": true,
  "data": [
    {
      "channelId": "private-user1-user2",
      "type": "private",
      "name": "John Doe",
      "avatar": "...",
      "lastMessage": {...},
      "unreadCount": 5
    }
  ]
}
```

### Channel Statistics

```json
GET /api/chat/channels/:channelId/statistics

Response:
{
  "success": true,
  "data": {
    "channel": {...},
    "statistics": {
      "totalMessages": 150,
      "memberMessageCounts": [...],
      "firstMessage": {...}
    }
  }
}
```

## Middleware Requirements

- All routes require `isLogin` middleware for authentication
- User information available in `req.user`

## Error Responses

All endpoints return consistent error format:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

## Socket.IO Events (Related)

- `join_channel` - Join a channel room
- `leave_channel` - Leave a channel room
- `new_message` - New message in channel
- `message_read` - Message read status update
- `channel_updated` - Channel information updated
