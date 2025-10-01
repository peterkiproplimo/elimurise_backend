const http = require('http');
const express = require('express');
const Message = require('../models/portal/content/Message');
const jwt = require('jsonwebtoken');
const notification = require('../models/portal/content/Notifications');
const app = express();

const server = http.createServer(app);
const socketIO = require('socket.io');

const io = socketIO(server, {
  cors: {
    origin: '*', // Replace with your frontend URL
    methods: ['GET', 'POST'],
    allowedHeaders: ['my-custom-header'],
    credentials: true,
  },
});
const userSocketMap = {}; // {userId: socketId}

// Secret key for JWT, now from environment variables
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware to authenticate JWT
const authenticateSocket = (socket, next) => {
  // Extract token from the Authorization header
  const checktoken = socket.handshake.auth.token;
  if (!checktoken || !checktoken.startsWith('Bearer ')) {
    return next(new Error('Authentication error'));
  }

  const token = checktoken.split(' ')[1]; // Get token part after 'Bearer'

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return next(new Error('Authentication error'));
    }
    socket.user = decoded; // Store user information in the socket object
    next();
  });
};

// Use the authenticateSocket middleware for every connection
io.use(authenticateSocket);
io.on('connection', socket => {
  // Now that the socket is authenticated, you can access socket.user
  const {_id, role} = socket.user.AuthUser;
  // console.log(socket.user.AuthUser);
  const userId = _id;
  // console.log(`✅ User connected: ${userId} (Socket: ${socket.id})`);

  // Register user when they join
  socket.on('register', () => {
    userSocketMap[`${userId}`] = socket.id;
    // console.log(`📌 Registered:${userId} (Socket: ${socket.id})`);
    if (role) {
      userSocketMap[`${socket.user.AuthUser.school._id}`] = socket.id;
      // console.log(`📌 Registered:${socket.user.AuthUser.school._id} (Socket: ${socket.id})`);
    }
    // Notify all users of new online users
    io.emit('onlineUsers', Object.keys(userSocketMap));
  });

  // Handle sending messages
  socket.on('sendMessage', async ({senderModel, receiver, receiverModel, message}) => {
    try {
      const newMessage = new Message({sender: userId, senderModel, receiver, receiverModel, message});
      // console.log(newMessage);
      await newMessage.save();
      // console.log(socket.user.AuthUser);
      notification.create({
        user: receiver,
        type: 'info',
        title: 'Message from ' + (socket.user.AuthUser.firstname || socket.user.AuthUser.first_name),
        message: message,
      });
      // Emit message to receiver if they are online
      const receiverSocketId = userSocketMap[`${receiver}`];
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('receiveMessage', newMessage);
        // console.log(`📨 Message sent to ${receiverModel}-${receiver}`);
      } else {
        // console.log(`⚠️ User ${receiverModel}-${receiver} is offline`);
      }

      // Acknowledge sender
      socket.emit('messageSent', newMessage);
    } catch (error) {
      // console.error('❌ Error sending message:', error);
      socket.emit('error', {error: 'Message not sent'});
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    // console.log(`❌ User disconnected: ${socket.id}`);

    // Remove user from connected users
    Object.keys(userSocketMap).forEach(key => {
      if (userSocketMap[key] === socket.id) {
        delete userSocketMap[key];
      }
    });

    // Notify all users of updated online list
    io.emit('onlineUsers', Object.keys(userSocketMap));
  });
});

module.exports = {app, io, server, userSocketMap};
