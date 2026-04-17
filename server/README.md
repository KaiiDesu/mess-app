# Zap Messenger Backend - README

## Quick Start

```bash
# 1. Setup
bash setup-backend.sh
cd server

# 2. Configure
# Edit .env with your Supabase URL, keys, and JWT secret

# 3. Install dependencies
npm install

# 4. Run development server
npm run dev

# 5. Server running on http://localhost:3000
```

## Project Structure

```
server/
├── index.js                           # Main entry point
├── .env                               # Environment variables
├── package.json                       # Dependencies
│
├── config/
│   └── supabase.js                   # Supabase client
│
├── middleware/
│   └── auth.js                       # JWT authentication
│
├── sockets/
│   ├── index.js                      # Socket.io setup
│   └── handlers/
│       ├── message.js                # Message events
│       ├── friendship.js             # Friendship events
│       ├── conversation.js           # Conversation events
│       └── presence.js               # User presence
│
├── routes/
│   ├── auth.js                       # Auth endpoints (login, register)
│   ├── users.js                      # User profile endpoints
│   ├── conversations.js              # Conversation endpoints
│   ├── media.js                      # Media upload/download
│   └── friendships.js                # Friend endpoints
│
├── controllers/
│   ├── authController.js             # Auth logic
│   ├── userController.js             # User logic
│   ├── messageController.js          # Message logic
│   └── mediaController.js            # Media logic
│
├── services/
│   ├── userService.js                # User business logic
│   ├── messageService.js             # Message business logic
│   ├── mediaService.js               # Media handling
│   └── notificationService.js        # Push notifications
│
├── utils/
│   ├── logger.js                     # Logging
│   ├── validators.js                 # Input validation
│   └── errors.js                     # Error handling
│
└── tests/
    ├── auth.test.js
    ├── messages.test.js
    └── socket.test.js
```

## API Endpoints (Sample)

### Authentication
```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
```

### Users
```
GET    /api/users/me                  # Current user profile
GET    /api/users/search?q=alex       # Search users
GET    /api/users/:id                 # Get user profile
PUT    /api/users/me                  # Update profile
```

### Conversations
```
GET    /api/conversations              # List conversations
GET    /api/conversations/:id         # Get conversation
POST   /api/conversations             # Create conversation
PUT    /api/conversations/:id         # Update conversation
GET    /api/conversations/:id/messages # Get messages
```

### Friendships
```
GET    /api/friendships               # List friendships
GET    /api/friendships/requests      # Pending requests
```

## Socket.io Events

See [SOCKETIO-EVENTS.md](../../SOCKETIO-EVENTS.md) for full documentation.

### Key Events
- `message:send` - Send text message
- `message:read` - Mark messages as read
- `message:typing` - Show typing indicator
- `friendship:request_send` - Send friend request
- `conversation:theme_update` - Change chat theme

## Environment Variables

```env
NODE_ENV=development
PORT=3000

# Supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyxxx...
SUPABASE_SERVICE_ROLE_KEY=eyxxx...

# JWT
JWT_SECRET=your_secret_key_change_me
JWT_EXPIRES_IN=7d

# Socket.io CORS
SOCKET_IO_CORS=http://localhost:3000,http://localhost:5173

# Logging
LOG_LEVEL=info
```

## Development

```bash
# Watch mode (auto-restart on file changes)
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

## Deployment (Railway / Heroku / Vercel)

```bash
# Build
npm run build

# Start
npm start
```

### Environment Variables for Production
- Set all env vars in deployment platform dashboard
- Use strong JWT_SECRET
- Enable HTTPS only
- Set restrictive CORS origins

## Testing Socket.io Locally

```javascript
// browser console or Node.js script
const io = require('socket.io-client');
const socket = io('http://localhost:3000', {
  query: { token: 'YOUR_JWT_TOKEN' }
});

socket.on('connect', () => console.log('Connected'));
socket.on('error', (err) => console.error(err));

// Send a message
socket.emit('message:send', {
  conversationId: 'convo-uuid',
  content: 'Hello!',
  contentType: 'text'
});
```

## Monitoring & Logging

Logs are printed to stdout in JSON format for easy parsing:

```json
{
  "timestamp": "2026-04-16T10:30:00.123Z",
  "level": "INFO",
  "message": "User connected",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "socketId": "abc123"
}
```

Pipe to external logging service (DataDog, Sentry, LogRocket) in production.

## Next Steps

1. **Implement REST endpoints** for auth, users, conversations
2. **Add rate limiting** (express-rate-limit)
3. **Add input validation** (joi or zod)
4. **Implement media upload** to Supabase Storage or S3
5. **Add push notifications** (FCM + APNs)
6. **Write unit tests** for services and controllers
7. **Add error tracking** (Sentry integration)
