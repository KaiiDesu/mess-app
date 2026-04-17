#!/bin/bash
# Zap Messenger Backend - Project Setup

# Create folder structure
mkdir -p server/{config,controllers,middleware,services,utils,routes,sockets}
mkdir -p server/models
mkdir -p server/tests

# Initialize Node project
cd server
npm init -y

# Install dependencies
npm install express socket.io dotenv cors pg supabase-js jsonwebtoken bcrypt uuid
npm install --save-dev nodemon jest supertest

# Create environment file
cat > .env << 'EOF'
# Server
NODE_ENV=development
PORT=3000
API_URL=http://localhost:3000

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# JWT
JWT_SECRET=your_jwt_secret_key_change_me
JWT_EXPIRES_IN=7d

# Socket.io
SOCKET_IO_CORS=http://localhost:3000,http://localhost:5173

# Media Storage (S3 or equivalent)
S3_BUCKET=zap-messenger-media
S3_REGION=us-east-1
S3_ACCESS_KEY=your_access_key
S3_SECRET_KEY=your_secret_key

# Push Notifications
FCM_PROJECT_ID=your_firebase_project
FCM_PRIVATE_KEY=your_firebase_key
APNS_KEY_ID=your_apns_key
APNS_TEAM_ID=your_apple_team_id

# Logging
LOG_LEVEL=info
EOF

echo "✅ Backend structure created!"
echo "📁 Navigate to: cd server"
echo "🚀 Start dev: npm run dev"
