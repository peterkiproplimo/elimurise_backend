const {io, server} = require('../socket/server');
const Message = require('../models/portal/content/Message');
io.on('connection', socket => {
  // console.log(`✅ User connected: ${socket.id}`);

  // Register user when they join
  socket.on('register', ({userId, userType}) => {
    connectedUsers[`${userType}-${userId}`] = socket.id;
    // console.log(`📌 Registered: ${userType}-${userId} (Socket: ${socket.id})`);

    // Notify all users of new online users
    io.emit('onlineUsers', Object.keys(connectedUsers));
  });

  // Handle sending messages
  socket.on('sendMessage', async ({sender, senderModel, receiver, receiverModel, message}) => {
    try {
      const newMessage = new Message({sender, senderModel, receiver, receiverModel, message});
      await newMessage.save();

      // Emit message to receiver if they are online
      const receiverSocketId = connectedUsers[`${receiverModel}-${receiver}`];
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
    Object.keys(connectedUsers).forEach(key => {
      if (connectedUsers[key] === socket.id) {
        delete connectedUsers[key];
      }
    });

    // Notify all users of updated online list
    io.emit('onlineUsers', Object.keys(connectedUsers));
  });
});
