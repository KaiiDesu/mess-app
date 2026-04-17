# Zap Messenger - Socket.io Real-Time Events Contract

## Connection Lifecycle

### Client → Server: `connect`
**When**: App connects to Socket.io server
**Payload**: None (Socket.io handles authentication via JWT in query params)
**Query Params**: `?token=<JWT_TOKEN>`

```javascript
// Client example
const socket = io('https://api.zap-messenger.com', {
  query: { token: jwtToken },
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 5
});
```

### Server → Client: `connect`
**When**: User successfully authenticated and connected
**Payload**:
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "connected",
  "connectedAt": "2026-04-16T10:30:00Z"
}
```

### Server → Client: `connect_error`
**When**: Connection fails (invalid token, expired token, etc.)
**Payload**:
```json
{
  "error": "Invalid token",
  "code": "AUTH_FAILED"
}
```

### Client → Server: `disconnect`
**When**: User closes app or loses connection
**Payload**: None

### Server → Client: `user:presence_update`
**When**: User comes online/offline
**Broadcast To**: All connected users who are friends
**Payload**:
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "is_online": true,
  "last_seen_at": "2026-04-16T10:30:00Z"
}
```

---

## Messaging Events

### Client → Server: `message:send`
**When**: User sends a text message
**Payload**:
```json
{
  "conversationId": "660e8400-e29b-41d4-a716-446655440000",
  "content": "Hey, how are you?",
  "contentType": "text",
  "clientMessageId": "temp-id-123" // for optimistic UI
}
```

**Server Response**: 
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440000",
  "conversationId": "660e8400-e29b-41d4-a716-446655440000",
  "senderId": "550e8400-e29b-41d4-a716-446655440000",
  "content": "Hey, how are you?",
  "contentType": "text",
  "createdAt": "2026-04-16T10:30:00Z",
  "clientMessageId": "temp-id-123"
}
```

### Server → Client: `message:received`
**When**: Recipient gets a new message
**Broadcast To**: Recipient + sender
**Payload**:
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440000",
  "conversationId": "660e8400-e29b-41d4-a716-446655440000",
  "senderId": "550e8400-e29b-41d4-a716-446655440000",
  "senderName": "Alex Rivera",
  "senderAvatar": "https://cdn.zap/avatars/550e8400.jpg",
  "content": "Hey, how are you?",
  "contentType": "text",
  "createdAt": "2026-04-16T10:30:00Z"
}
```

### Client → Server: `message:read`
**When**: User opens conversation / scrolls to message
**Payload**:
```json
{
  "conversationId": "660e8400-e29b-41d4-a716-446655440000",
  "messageIds": [
    "770e8400-e29b-41d4-a716-446655440000",
    "880e8400-e29b-41d4-a716-446655440000"
  ]
}
```

### Server → Client: `message:read_receipt`
**When**: One or more messages marked as read
**Broadcast To**: Sender only (or both, depending on app UX)
**Payload**:
```json
{
  "conversationId": "660e8400-e29b-41d4-a716-446655440000",
  "readBy": "550e8400-e29b-41d4-a716-446655440000",
  "readByName": "Alex Rivera",
  "messageIds": [
    "770e8400-e29b-41d4-a716-446655440000",
    "880e8400-e29b-41d4-a716-446655440000"
  ],
  "readAt": "2026-04-16T10:31:00Z"
}
```

### Client → Server: `message:typing`
**When**: User starts typing (debounced, send every ~500ms while typing)
**Payload**:
```json
{
  "conversationId": "660e8400-e29b-41d4-a716-446655440000"
}
```

### Server → Client: `message:typing`
**When**: Other user is typing
**Broadcast To**: Other participant in conversation
**Payload**:
```json
{
  "conversationId": "660e8400-e29b-41d4-a716-446655440000",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "userName": "Alex Rivera"
}
```

### Client → Server: `message:typing_stop`
**When**: User stops typing (on blur or after 3s of inactivity)
**Payload**:
```json
{
  "conversationId": "660e8400-e29b-41d4-a716-446655440000"
}
```

### Server → Client: `message:typing_stop`
**When**: Other user stopped typing
**Broadcast To**: Other participant
**Payload**:
```json
{
  "conversationId": "660e8400-e29b-41d4-a716-446655440000",
  "userId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### Client → Server: `message:send_media`
**When**: User sends image/video/audio
**Payload**:
```json
{
  "conversationId": "660e8400-e29b-41d4-a716-446655440000",
  "contentType": "image",
  "mediaId": "990e8400-e29b-41d4-a716-446655440000",
  "mediaUrl": "https://cdn.zap/messages/550e8400/image-123.jpg",
  "thumbnail": "https://cdn.zap/messages/550e8400/image-123-thumb.jpg",
  "fileName": "photo.jpg",
  "clientMessageId": "temp-id-456"
}
```

**Server Response**:
```json
{
  "id": "aa0e8400-e29b-41d4-a716-446655440000",
  "conversationId": "660e8400-e29b-41d4-a716-446655440000",
  "senderId": "550e8400-e29b-41d4-a716-446655440000",
  "contentType": "image",
  "mediaId": "990e8400-e29b-41d4-a716-446655440000",
  "mediaUrl": "https://cdn.zap/messages/550e8400/image-123.jpg",
  "createdAt": "2026-04-16T10:30:00Z",
  "clientMessageId": "temp-id-456"
}
```

### Server → Client: `message:media_received`
**When**: Recipient gets media message
**Payload**:
```json
{
  "id": "aa0e8400-e29b-41d4-a716-446655440000",
  "conversationId": "660e8400-e29b-41d4-a716-446655440000",
  "senderId": "550e8400-e29b-41d4-a716-446655440000",
  "senderName": "Alex Rivera",
  "contentType": "image",
  "mediaUrl": "https://cdn.zap/messages/550e8400/image-123.jpg",
  "thumbnail": "https://cdn.zap/messages/550e8400/image-123-thumb.jpg",
  "createdAt": "2026-04-16T10:30:00Z"
}
```

### Client → Server: `message:react`
**When**: User adds emoji reaction to message
**Payload**:
```json
{
  "messageId": "770e8400-e29b-41d4-a716-446655440000",
  "emoji": "❤️"
}
```

### Server → Client: `message:reaction_added`
**When**: Reaction added to message
**Broadcast To**: Both conversation participants
**Payload**:
```json
{
  "messageId": "770e8400-e29b-41d4-a716-446655440000",
  "conversationId": "660e8400-e29b-41d4-a716-446655440000",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "userName": "Alex Rivera",
  "emoji": "❤️",
  "totalReactions": 1
}
```

### Client → Server: `message:react_remove`
**When**: User removes emoji reaction
**Payload**:
```json
{
  "messageId": "770e8400-e29b-41d4-a716-446655440000",
  "emoji": "❤️"
}
```

### Server → Client: `message:reaction_removed`
**When**: Reaction removed
**Broadcast To**: Both participants
**Payload**:
```json
{
  "messageId": "770e8400-e29b-41d4-a716-446655440000",
  "conversationId": "660e8400-e29b-41d4-a716-446655440000",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "emoji": "❤️",
  "totalReactions": 0
}
```

---

## Friendship Events

### Client → Server: `friendship:request_send`
**When**: User sends friend request
**Payload**:
```json
{
  "toUserId": "550e8400-e29b-41d4-a716-446655440001"
}
```

**Server Response**:
```json
{
  "id": "bb0e8400-e29b-41d4-a716-446655440000",
  "senderId": "550e8400-e29b-41d4-a716-446655440000",
  "receiverId": "550e8400-e29b-41d4-a716-446655440001",
  "status": "pending",
  "createdAt": "2026-04-16T10:30:00Z"
}
```

### Server → Client: `friendship:request_received`
**When**: User receives friend request
**Broadcast To**: Receiver only
**Payload**:
```json
{
  "id": "bb0e8400-e29b-41d4-a716-446655440000",
  "fromUserId": "550e8400-e29b-41d4-a716-446655440000",
  "fromUserName": "Alex Rivera",
  "fromUserAvatar": "https://cdn.zap/avatars/550e8400.jpg",
  "createdAt": "2026-04-16T10:30:00Z"
}
```

### Client → Server: `friendship:request_accept`
**When**: User accepts friend request
**Payload**:
```json
{
  "friendshipId": "bb0e8400-e29b-41d4-a716-446655440000"
}
```

### Server → Client: `friendship:request_accepted`
**When**: Friend request accepted
**Broadcast To**: Both users
**Payload**:
```json
{
  "id": "bb0e8400-e29b-41d4-a716-446655440000",
  "userId": "550e8400-e29b-41d4-a716-446655440001",
  "userName": "Alex Rivera",
  "userAvatar": "https://cdn.zap/avatars/550e8400.jpg",
  "status": "accepted",
  "createdAt": "2026-04-16T10:30:00Z"
}
```

### Client → Server: `friendship:request_decline`
**When**: User declines friend request
**Payload**:
```json
{
  "friendshipId": "bb0e8400-e29b-41d4-a716-446655440000"
}
```

### Server → Client: `friendship:request_declined`
**When**: Friend request declined
**Broadcast To**: Sender only
**Payload**:
```json
{
  "id": "bb0e8400-e29b-41d4-a716-446655440000",
  "status": "declined"
}
```

---

## Conversation/Theme Events

### Client → Server: `conversation:theme_update`
**When**: User changes chat theme
**Payload**:
```json
{
  "conversationId": "660e8400-e29b-41d4-a716-446655440000",
  "themeName": "pink",
  "themeGradient": "linear-gradient(135deg,#f472b6,#ec4899)"
}
```

### Server → Client: `conversation:theme_updated`
**When**: Theme changed
**Broadcast To**: Both conversation participants
**Payload**:
```json
{
  "conversationId": "660e8400-e29b-41d4-a716-446655440000",
  "themeName": "pink",
  "themeGradient": "linear-gradient(135deg,#f472b6,#ec4899)",
  "changedBy": "550e8400-e29b-41d4-a716-446655440000",
  "changedByName": "Alex Rivera",
  "updatedAt": "2026-04-16T10:30:00Z"
}
```

### Client → Server: `conversation:mute`
**When**: User mutes conversation
**Payload**:
```json
{
  "conversationId": "660e8400-e29b-41d4-a716-446655440000",
  "duration": 3600 // seconds, null = muted forever
}
```

### Client → Server: `conversation:archive`
**When**: User archives conversation
**Payload**:
```json
{
  "conversationId": "660e8400-e29b-41d4-a716-446655440000",
  "isArchived": true
}
```

---

## Error Handling

### Server → Client: `error`
**When**: Any error occurs
**Payload**:
```json
{
  "code": "MESSAGE_SEND_FAILED",
  "message": "Failed to send message",
  "details": {
    "conversationId": "660e8400-e29b-41d4-a716-446655440000",
    "clientMessageId": "temp-id-123"
  }
}
```

### Error Codes:
- `AUTH_FAILED` - Authentication failed
- `MESSAGE_SEND_FAILED` - Message send failed
- `FRIENDSHIP_REQUEST_FAILED` - Friend request failed
- `CONVERSATION_NOT_FOUND` - Conversation doesn't exist
- `USER_NOT_FOUND` - User doesn't exist
- `RATE_LIMIT_EXCEEDED` - Too many requests
- `MEDIA_UPLOAD_FAILED` - Media upload failed
- `INTERNAL_ERROR` - Server error

---

## Best Practices

### Client Implementation
1. **Reconnection**: Use exponential backoff (1s → 5s max)
2. **Debounce typing**: Send typing event every 500ms, not on every keystroke
3. **Optimistic UI**: Show message immediately, sync when server confirms with `clientMessageId`
4. **Error handling**: Retry with backoff before showing error to user
5. **Memory**: Clean up event listeners on unmount

### Server Implementation
1. **Validation**: Always validate user permissions (RLS + code-level checks)
2. **Rate limiting**: 100 messages/min per user, 30 friend requests/day
3. **Presence**: Update presence on connect/disconnect, store last_seen
4. **Cleanup**: Remove typing indicators after 3s of inactivity
5. **Logging**: Log all critical events (send, receive, errors) for debugging

---

## Example Client Flow (React)

```javascript
// Connect
const socket = io(API_URL, { query: { token: jwtToken } });

// Send message
socket.emit('message:send', {
  conversationId: 'convo-id',
  content: 'Hello!',
  clientMessageId: uuid()
});

// Listen for responses
socket.on('message:received', (msg) => {
  // Update UI
});

// Listen for errors
socket.on('error', (err) => {
  console.error(err.code, err.message);
});

// Cleanup
socket.disconnect();
```

---

## Test Checklist

- [ ] Connect without token → `connect_error`
- [ ] Connect with valid token → `connect` success
- [ ] Send message → receives `message:received`
- [ ] Mark read → other user gets `message:read_receipt`
- [ ] Type → other user gets `message:typing`
- [ ] Stop typing → other user gets `message:typing_stop`
- [ ] React with emoji → other user gets `message:reaction_added`
- [ ] Send friend request → receiver gets `friendship:request_received`
- [ ] Accept request → sender gets `friendship:request_accepted`
- [ ] Change theme → other user gets `conversation:theme_updated`
- [ ] Disconnect → `user:presence_update` with is_online=false
