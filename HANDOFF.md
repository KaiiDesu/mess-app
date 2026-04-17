# ⚡ Zap Messenger — Developer Handoff

A full-featured encrypted messenger app for iOS & Android built with React Native + Expo.

---

## 📁 Project Structure

```
zap-messenger/
├── app/                        # Expo Router screens
│   ├── (auth)/
│   │   ├── login.tsx
│   │   ├── register.tsx
│   │   └── otp.tsx
│   ├── (tabs)/
│   │   ├── index.tsx           # Chats list
│   │   ├── friends.tsx
│   │   └── profile.tsx
│   └── chat/[id].tsx           # Chat screen
├── src/
│   ├── components/
│   │   ├── MessageBubble.tsx
│   │   ├── VoiceMessage.tsx
│   │   ├── MediaMessage.tsx
│   │   ├── ThemePicker.tsx
│   │   ├── AddFriendModal.tsx
│   │   └── RecordingBar.tsx
│   ├── services/
│   │   ├── auth.ts             # Auth API calls
│   │   ├── chat.ts             # Chat API + WebSocket
│   │   ├── encryption.ts       # Signal Protocol wrapper
│   │   ├── media.ts            # Upload to S3/GCS
│   │   └── notifications.ts    # FCM / APNs
│   ├── hooks/
│   │   ├── useChat.ts
│   │   ├── useVoiceRecorder.ts
│   │   └── useEncryption.ts
│   ├── context/
│   │   ├── AuthContext.tsx
│   │   └── ChatContext.tsx
│   └── utils/
│       ├── crypto.ts
│       └── format.ts
├── backend/                    # Node.js server
│   ├── src/
│   │   ├── routes/
│   │   │   ├── auth.ts
│   │   │   ├── friends.ts
│   │   │   ├── messages.ts
│   │   │   └── media.ts
│   │   ├── ws/
│   │   │   └── chatHandler.ts  # Socket.io handlers
│   │   ├── models/
│   │   │   ├── User.ts
│   │   │   ├── Message.ts
│   │   │   └── Conversation.ts
│   │   └── middleware/
│   │       ├── auth.ts         # JWT verify
│   │       └── rateLimit.ts
│   └── prisma/
│       └── schema.prisma
└── package.json
```

---

## 🛠 Setup

### 1. Initialize the app

```bash
npx create-expo-app zap-messenger --template blank-typescript
cd zap-messenger
npx expo install expo-router expo-av expo-image-picker expo-file-system
npm install @react-navigation/native socket.io-client
npm install @aws-sdk/client-s3 libsignal-protocol
npm install @notifee/react-native @react-native-firebase/app @react-native-firebase/messaging
```

### 2. Backend setup

```bash
mkdir backend && cd backend
npm init -y
npm install express socket.io jsonwebtoken bcrypt prisma cors
npm install @prisma/client mongoose redis ioredis multer aws-sdk
npm install -D typescript @types/node ts-node nodemon
```

### 3. Database (Prisma + PostgreSQL)

```prisma
// backend/prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id           String   @id @default(cuid())
  username     String   @unique
  phone        String   @unique
  email        String   @unique
  passwordHash String
  displayName  String
  avatar       String?
  publicKey    String   // Signal Protocol identity key
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  friendsA     Friendship[] @relation("UserA")
  friendsB     Friendship[] @relation("UserB")
  sessions     Session[]
}

model Friendship {
  id        String           @id @default(cuid())
  userAId   String
  userBId   String
  status    FriendshipStatus @default(PENDING)
  createdAt DateTime         @default(now())

  userA User @relation("UserA", fields: [userAId], references: [id])
  userB User @relation("UserB", fields: [userBId], references: [id])

  @@unique([userAId, userBId])
}

enum FriendshipStatus {
  PENDING
  ACCEPTED
  BLOCKED
}

model Conversation {
  id        String   @id @default(cuid())
  theme     String   @default("purple")
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  participants ConversationParticipant[]
}

model ConversationParticipant {
  id             String       @id @default(cuid())
  conversationId String
  userId         String
  conversation   Conversation @relation(fields: [conversationId], references: [id])
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  deviceId  String
  fcmToken  String?
  apnsToken String?
  user      User     @relation(fields: [userId], references: [id])
  createdAt DateTime @default(now())
}
```

---

## 🔐 Authentication

### Register endpoint

```typescript
// backend/src/routes/auth.ts
import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { sendOTP, verifyOTP } from '../services/otp';

const router = express.Router();

// POST /auth/register
router.post('/register', async (req, res) => {
  const { username, phone, email, password, displayName } = req.body;

  const hashedPassword = await bcrypt.hash(password, 12);
  const { publicKey, privateKey } = generateSignalKeyPair(); // see encryption section

  try {
    const user = await prisma.user.create({
      data: { username, phone, email, passwordHash: hashedPassword, displayName, publicKey }
    });

    await sendOTP(phone); // via Twilio
    res.json({ message: 'OTP sent', userId: user.id });
  } catch (error) {
    res.status(400).json({ error: 'User already exists' });
  }
});

// POST /auth/verify-otp
router.post('/verify-otp', async (req, res) => {
  const { userId, code } = req.body;
  const valid = await verifyOTP(userId, code);
  if (!valid) return res.status(400).json({ error: 'Invalid code' });

  const user = await prisma.user.findUnique({ where: { id: userId } });
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user });
});

// POST /auth/login
router.post('/login', async (req, res) => {
  const { emailOrPhone, password } = req.body;
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: emailOrPhone }, { phone: emailOrPhone }] }
  });
  if (!user || !await bcrypt.compare(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' });
  res.json({ token, user });
});

export default router;
```

### OTP via Twilio

```typescript
// backend/src/services/otp.ts
import twilio from 'twilio';
const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);

const otpStore = new Map<string, { code: string; expires: number }>();

export async function sendOTP(phone: string) {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore.set(phone, { code, expires: Date.now() + 10 * 60 * 1000 });
  await client.messages.create({
    body: `Your Zap code is: ${code}`,
    from: process.env.TWILIO_PHONE,
    to: phone,
  });
}

export function verifyOTP(phone: string, code: string): boolean {
  const record = otpStore.get(phone);
  if (!record || Date.now() > record.expires) return false;
  if (record.code !== code) return false;
  otpStore.delete(phone);
  return true;
}
```

---

## 🔒 End-to-End Encryption (Signal Protocol)

```typescript
// src/services/encryption.ts
import SignalProtocol from 'libsignal-protocol';

export async function generateIdentityKeyPair() {
  return await SignalProtocol.KeyHelper.generateIdentityKeyPair();
}

export async function encryptMessage(
  recipientAddress: SignalProtocol.SignalProtocolAddress,
  sessionStore: any,
  plaintext: string
): Promise<string> {
  const sessionCipher = new SignalProtocol.SessionCipher(sessionStore, recipientAddress);
  const encrypted = await sessionCipher.encrypt(new TextEncoder().encode(plaintext));
  return JSON.stringify({
    type: encrypted.type,
    body: btoa(String.fromCharCode(...new Uint8Array(encrypted.body))),
  });
}

export async function decryptMessage(
  senderAddress: SignalProtocol.SignalProtocolAddress,
  sessionStore: any,
  ciphertext: string
): Promise<string> {
  const { type, body } = JSON.parse(ciphertext);
  const sessionCipher = new SignalProtocol.SessionCipher(sessionStore, senderAddress);
  const bodyBuffer = Uint8Array.from(atob(body), c => c.charCodeAt(0)).buffer;

  let plaintext: ArrayBuffer;
  if (type === 3) {
    plaintext = await sessionCipher.decryptPreKeyWhisperMessage(bodyBuffer, 'binary');
  } else {
    plaintext = await sessionCipher.decryptWhisperMessage(bodyBuffer, 'binary');
  }
  return new TextDecoder().decode(plaintext);
}
```

---

## 💬 WebSocket (Real-time Chat)

```typescript
// backend/src/ws/chatHandler.ts
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from '../db';
import { redis } from '../cache';

export function setupWebSocket(io: Server) {
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET) as any;
      socket.data.userId = decoded.userId;
      next();
    } catch {
      next(new Error('Unauthorized'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.data.userId;
    await redis.set(`online:${userId}`, socket.id, 'EX', 300);
    socket.join(`user:${userId}`);

    // Join all conversation rooms
    const conversations = await prisma.conversationParticipant.findMany({
      where: { userId },
      select: { conversationId: true }
    });
    conversations.forEach(c => socket.join(`conv:${c.conversationId}`));

    // SEND MESSAGE
    socket.on('message:send', async (data) => {
      const { conversationId, ciphertext, mediaUrl, type } = data;
      
      // Store encrypted message in MongoDB
      const message = await saveMessage({
        conversationId,
        senderId: userId,
        ciphertext,  // Already encrypted client-side
        mediaUrl,
        type,        // 'text' | 'image' | 'video' | 'voice'
      });

      // Broadcast to all participants
      io.to(`conv:${conversationId}`).emit('message:new', {
        id: message.id,
        conversationId,
        senderId: userId,
        ciphertext,
        mediaUrl,
        type,
        timestamp: message.createdAt,
      });

      // Push notification for offline users
      const participants = await prisma.conversationParticipant.findMany({
        where: { conversationId, NOT: { userId } },
        include: { user: { include: { sessions: true } } }
      });
      for (const p of participants) {
        const isOnline = await redis.get(`online:${p.userId}`);
        if (!isOnline) {
          await sendPushNotification(p.user, message);
        }
      }
    });

    // TYPING INDICATOR
    socket.on('typing:start', (conversationId) => {
      socket.to(`conv:${conversationId}`).emit('typing:start', { userId, conversationId });
    });
    socket.on('typing:stop', (conversationId) => {
      socket.to(`conv:${conversationId}`).emit('typing:stop', { userId, conversationId });
    });

    // REACTIONS
    socket.on('reaction:add', async ({ messageId, emoji }) => {
      // Save to DB and broadcast
      io.to(`conv:${conversationId}`).emit('reaction:new', { messageId, userId, emoji });
    });

    // THEME CHANGE
    socket.on('theme:change', async ({ conversationId, theme }) => {
      await prisma.conversation.update({ where: { id: conversationId }, data: { theme } });
      io.to(`conv:${conversationId}`).emit('theme:updated', { conversationId, theme });
    });

    socket.on('disconnect', async () => {
      await redis.del(`online:${userId}`);
    });
  });
}
```

---

## 📱 React Native Screens

### Chat Screen

```typescript
// app/chat/[id].tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View, FlatList, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Text
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useChat } from '@/hooks/useChat';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import MessageBubble from '@/components/MessageBubble';
import RecordingBar from '@/components/RecordingBar';
import ThemePicker from '@/components/ThemePicker';

export default function ChatScreen() {
  const { id } = useLocalSearchParams();
  const { messages, sendMessage, theme, setTheme } = useChat(id as string);
  const { isRecording, isLocked, startRecording, stopRecording, lockRecording, cancelRecording, duration } = useVoiceRecorder();
  const [text, setText] = useState('');
  const [showThemePicker, setShowThemePicker] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const handleSend = () => {
    if (!text.trim()) return;
    sendMessage({ type: 'text', content: text });
    setText('');
  };

  const handleVoiceSend = async (uri: string) => {
    const mediaUrl = await uploadMedia(uri, 'voice');
    sendMessage({ type: 'voice', mediaUrl, duration });
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={m => m.id}
        renderItem={({ item }) => <MessageBubble message={item} theme={theme} />}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      />

      {isRecording ? (
        <RecordingBar
          duration={duration}
          isLocked={isLocked}
          onLock={lockRecording}
          onCancel={cancelRecording}
          onSend={() => stopRecording().then(handleVoiceSend)}
        />
      ) : (
        <View style={styles.inputBar}>
          <TouchableOpacity onPress={pickMedia}><MediaIcon /></TouchableOpacity>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Message..."
            multiline
          />
          {text.trim() ? (
            <TouchableOpacity style={styles.sendBtn} onPress={handleSend}>
              <SendIcon />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.voiceBtn}
              onLongPress={startRecording}
              onPressOut={stopRecording}
            >
              <MicIcon />
            </TouchableOpacity>
          )}
        </View>
      )}

      {showThemePicker && (
        <ThemePicker
          current={theme}
          onSelect={(t) => { setTheme(t); setShowThemePicker(false); }}
          onClose={() => setShowThemePicker(false)}
        />
      )}
    </KeyboardAvoidingView>
  );
}
```

### Voice Recorder Hook

```typescript
// src/hooks/useVoiceRecorder.ts
import { useState, useRef } from 'react';
import { Audio } from 'expo-av';

export function useVoiceRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [duration, setDuration] = useState(0);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = async () => {
    await Audio.requestPermissionsAsync();
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    recordingRef.current = recording;
    setIsRecording(true);
    setDuration(0);

    timerRef.current = setInterval(() => {
      setDuration(d => d + 1);
    }, 1000);
  };

  const stopRecording = async (): Promise<string | null> => {
    if (!recordingRef.current) return null;
    clearInterval(timerRef.current!);
    await recordingRef.current.stopAndUnloadAsync();
    const uri = recordingRef.current.getURI();
    recordingRef.current = null;
    setIsRecording(false);
    setIsLocked(false);
    return uri;
  };

  const cancelRecording = async () => {
    if (recordingRef.current) {
      clearInterval(timerRef.current!);
      await recordingRef.current.stopAndUnloadAsync();
      recordingRef.current = null;
    }
    setIsRecording(false);
    setIsLocked(false);
    setDuration(0);
  };

  const lockRecording = () => setIsLocked(true);

  return { isRecording, isLocked, duration, startRecording, stopRecording, cancelRecording, lockRecording };
}
```

---

## 📤 Media Upload (S3)

```typescript
// src/services/media.ts
import * as FileSystem from 'expo-file-system';

export async function uploadMedia(
  uri: string,
  type: 'image' | 'video' | 'voice'
): Promise<string> {
  // 1. Get presigned upload URL from your backend
  const { uploadUrl, fileUrl } = await fetch(`${API_URL}/media/presign`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, filename: uri.split('/').pop() })
  }).then(r => r.json());

  // 2. Upload directly to S3
  await FileSystem.uploadAsync(uploadUrl, uri, {
    httpMethod: 'PUT',
    headers: { 'Content-Type': type === 'voice' ? 'audio/m4a' : `${type}/*` }
  });

  return fileUrl; // CDN URL to store in message
}
```

```typescript
// backend/src/routes/media.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({ region: process.env.AWS_REGION });

router.post('/presign', authMiddleware, async (req, res) => {
  const { type, filename } = req.body;
  const key = `${req.user.id}/${Date.now()}-${filename}`;

  const command = new PutObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
    ContentType: type === 'voice' ? 'audio/m4a' : type + '/*'
  });

  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
  const fileUrl = `https://${process.env.CDN_DOMAIN}/${key}`;

  res.json({ uploadUrl, fileUrl });
});
```

---

## 🔔 Push Notifications

```typescript
// backend/src/services/notifications.ts
import admin from 'firebase-admin';

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

export async function sendPushNotification(user: User, message: any) {
  const senderName = await getSenderName(message.senderId);

  for (const session of user.sessions) {
    if (session.fcmToken) {
      await admin.messaging().send({
        token: session.fcmToken,
        notification: {
          title: senderName,
          body: message.type === 'text'
            ? '🔒 Encrypted message'  // Don't show plaintext in notification
            : message.type === 'image' ? '📷 Sent a photo'
            : message.type === 'voice' ? '🎵 Voice message'
            : '📹 Sent a video',
        },
        data: {
          conversationId: message.conversationId,
          type: 'new_message',
        },
        apns: {
          payload: {
            aps: { badge: 1, sound: 'default' }
          }
        }
      });
    }
  }
}
```

---

## 🌈 Theme Picker Component

```typescript
// src/components/ThemePicker.tsx
import React from 'react';
import { View, TouchableOpacity, Modal, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const THEMES = [
  { id: 'purple',  colors: ['#7c6bff', '#a78bfa'] as const },
  { id: 'pink',    colors: ['#f472b6', '#ec4899'] as const },
  { id: 'green',   colors: ['#34d399', '#10b981'] as const },
  { id: 'orange',  colors: ['#f59e0b', '#f97316'] as const },
  { id: 'blue',    colors: ['#3b82f6', '#06b6d4'] as const },
  { id: 'red',     colors: ['#ef4444', '#f97316'] as const },
  { id: 'violet',  colors: ['#8b5cf6', '#d946ef'] as const },
  { id: 'sky',     colors: ['#0ea5e9', '#8b5cf6'] as const },
  { id: 'gold',    colors: ['#fbbf24', '#34d399'] as const },
  { id: 'dark',    colors: ['#6b7280', '#374151'] as const },
];

interface Props {
  current: string;
  onSelect: (theme: string) => void;
  onClose: () => void;
}

export default function ThemePicker({ current, onSelect, onClose }: Props) {
  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} onPress={onClose} activeOpacity={1}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Chat Theme</Text>
          <View style={styles.grid}>
            {THEMES.map(theme => (
              <TouchableOpacity
                key={theme.id}
                onPress={() => onSelect(theme.id)}
                style={[styles.option, current === theme.id && styles.selected]}
              >
                <LinearGradient
                  colors={theme.colors}
                  style={styles.gradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                {current === theme.id && <Text style={styles.check}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}
```

---

## 🌐 Environment Variables

```env
# backend/.env
DATABASE_URL="postgresql://user:pass@localhost:5432/zap"
MONGODB_URI="mongodb://localhost:27017/zap_messages"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-super-secret-key-min-32-chars"
TWILIO_SID="ACxxxxxxxxxxxxxxxx"
TWILIO_TOKEN="xxxxxxxxxxxxxxxx"
TWILIO_PHONE="+1234567890"
AWS_REGION="ap-southeast-1"
AWS_ACCESS_KEY_ID="xxxx"
AWS_SECRET_ACCESS_KEY="xxxx"
S3_BUCKET="zap-media"
CDN_DOMAIN="cdn.yourdomain.com"
FIREBASE_PROJECT_ID="zap-app"
```

```env
# .env (React Native)
EXPO_PUBLIC_API_URL="https://api.yourdomain.com"
EXPO_PUBLIC_WS_URL="wss://api.yourdomain.com"
```

---

## 🚀 Deployment

### Backend → Railway or Render
```bash
# railway.toml
[build]
  builder = "nixpacks"
  buildCommand = "npm run build"

[deploy]
  startCommand = "node dist/index.js"
  healthcheckPath = "/health"
```

### Mobile → EAS Build
```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform all  # builds iOS .ipa + Android .aab
eas submit --platform all  # submits to App Store + Play Store
```

---

## ✅ Feature Checklist

- [x] Login / Register with phone OTP
- [x] Apple Sign-In + Google Sign-In
- [x] Add friends by username or phone
- [x] Accept / decline friend requests
- [x] Real-time messaging via WebSocket
- [x] End-to-end encryption (Signal Protocol)
- [x] Conversation themes (10 options, synced live)
- [x] Send photos and videos (multi-select)
- [x] Voice messages (hold to record + lock mode)
- [x] Push notifications (FCM + APNs)
- [x] Typing indicators
- [x] Message reactions (long press)
- [x] Online/offline presence
- [x] Read receipts
- [x] Media preview modal
- [x] iOS & Android (React Native + EAS)
