const express = require('express');
const router = express.Router();
const Message = require('../../../models/portal/content/Message');
const Parent = require('../../../models/portal/content/Parent');
const PortalUser = require('../../../models/portal/auth/User');
const {io, server, userSocketMap} = require('../../../socket/server');
const Notification = require('../../../models/portal/content/Notifications');
const multer = require('multer');
const path = require('path');
const Learner = require('../../../models/portal/content/Learner');
const mongoose = require('mongoose');

// Send a message
// Assuming userSocketMap is managed in the WebSocket setup
// Configure multer for file uploads with local storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, '/hero/'); // Store files in /attachments/ directory
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // Unique filename with timestamp
  },
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    // Allow common file types (e.g., images, PDFs, docs)
    const filetypes = /jpeg|jpg|png|pdf|doc|docx/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Error: Only images, PDFs, and Word documents are allowed!'));
    }
  },
  limits: {fileSize: 10 * 1024 * 1024}, // Optional: Limit file size to 10MB
});

router.post('/send', upload.array('attachments'), async (req, res) => {
  try {
    let {learner, sender, senderModel, receiver, receiverModel, message} = req.body;

    // Validate sender and receiver models
    if (!['PortalUser', 'Parent'].includes(senderModel) || !['PortalUser', 'Parent'].includes(receiverModel)) {
      return res.status(400).json({error: 'Invalid sender or receiver model'});
    }
    console.log(req.school);
    if (sender == req.school) {
      senderModel = 'School';
    }
    if (receiver == req.school) {
      receiverModel = 'School';
    }
    // Handle file uploads
    let attachments = [];
    if (req.files && req.files.length > 0) {
      attachments = req.files.map(file => ({
        url: file.path, // Local file path (e.g., "attachments/1234567890-image.jpg")
        fileName: file.originalname, // Original filename (e.g., "image.jpg")
        fileType: file.mimetype, // MIME type (e.g., "image/jpeg")
        fileSize: file.size, // Size in bytes
      }));
    }

    // Create and save the message
    const newMessage = new Message({
      learner,
      sender,
      senderModel,
      receiver,
      receiverModel,
      message: message || '', // Allow empty message if attachments exist
      attachments, // Include attachments if any
    });
    await newMessage.save();

    // Save notification for the receiver
    await Notification.create({
      user: receiver,
      type: 'info',
      title: `New message from ${senderModel} (${sender})`,
      message: message || 'Attachment received', // Fallback if no text
    });

    // Emit event via WebSockets if the receiver is online
    const receiverSocketId = userSocketMap[receiver];
    if (receiverSocketId) {
      io.to(receiverSocketId).emit('receiveMessage', newMessage);
      console.log(`📨 Real-time message sent to ${receiverModel} - ${receiver}`);
    } else {
      console.log(`⚠️ User ${receiverModel} - ${receiver} is offline`);
    }

    res.status(201).json({message: 'Message sent successfully', data: newMessage});
  } catch (error) {
    console.error('❌ Error sending message:', error);
    res.status(500).json({error: error.message});
  }
});

// router.post('/send', async (req, res) => {
//   try {
//     const {sender, senderModel, receiver, receiverModel, message} = req.body;

//     // Validate sender and receiver models
//     if (!['PortalUser', 'Parent'].includes(senderModel) || !['PortalUser', 'Parent'].includes(receiverModel)) {
//       return res.status(400).json({error: 'Invalid sender or receiver model'});
//     }

//     const newMessage = new Message({sender, senderModel, receiver, receiverModel, message});
//     await newMessage.save();

//     res.status(201).json({message: 'Message sent successfully', data: newMessage});
//   } catch (error) {
//     res.status(500).json({error: error.message});
//   }
// });
router.get('/chat-heads', async (req, res) => {
  try {
    // const {userId, userModel} = req.user; // Assuming you extract user info from auth middleware

    const userId = req.user._id; // Parent's ID
    const schoolId = req.user.school._id; // Admin ID from school
    const schoolName = req.user.school.name || 'School Admin'; // School name from req.user.school

    // Step 1: Fetch admin chat details (Message collection)
    const adminChat = await Message.aggregate([
      {
        $match: {
          $or: [
            {sender: userId, receiver: schoolId},
            {sender: schoolId, receiver: userId},
          ],
        },
      },
      {
        $sort: {createdAt: -1}, // Latest message first
      },
      {
        $group: {
          _id: null,
          lastMessage: {$first: '$message'},
          lastMessageAt: {$first: '$createdAt'},
          messages: {$push: '$$ROOT'},
        },
      },
      {
        $project: {
          learnerId: schoolId, // Renamed from _id to learnerId
          lastMessage: {$ifNull: ['$lastMessage', 'No messages']},
          lastMessageAt: '$lastMessageAt',
          unreadCount: {
            $sum: {
              $map: {
                input: '$messages',
                in: {
                  $cond: [
                    {
                      $and: [{$eq: ['$$this.receiver', userId]}, {$eq: ['$$this.read', false]}],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        },
      },
    ]);

    // Step 2: Fetch learner chat heads (your original pipeline)
    const learnerChats = await Learner.aggregate([
      {
        $match: {
          $or: [{guardian: userId}, {guardian2: userId}],
        },
      },
      {
        $lookup: {
          from: 'streams',
          localField: 'stream',
          foreignField: '_id',
          as: 'streamInfo',
        },
      },
      {
        $unwind: '$streamInfo',
      },
      {
        $lookup: {
          from: 'messages',
          let: {learnerId: '$_id'},
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    {$eq: ['$learner', '$$learnerId']},
                    {$or: [{$eq: ['$sender', userId]}, {$eq: ['$receiver', userId]}]},
                  ],
                },
              },
            },
            {
              $sort: {createdAt: -1},
            },
          ],
          as: 'messages',
        },
      },
      {
        $lookup: {
          from: 'portalusers',
          localField: 'streamInfo.class_manager',
          foreignField: '_id',
          as: 'classManagerInfo',
        },
      },
      {
        $unwind: {
          path: '$classManagerInfo',
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          learnerId: '$_id',
          learnerName: {$concat: ['$first_name', ' ', '$last_name']},
          streamId: '$stream',
          streamName: '$streamInfo.name',
          classManagerId: '$streamInfo.class_manager',
          classManagerName: {
            $concat: [
              {$ifNull: ['$classManagerInfo.firstname', '']},
              ' ',
              {$ifNull: ['$classManagerInfo.lastname', '']},
            ],
          },
          lastMessage: {
            $cond: {
              if: {$gt: [{$size: '$messages'}, 0]},
              then: {$arrayElemAt: ['$messages.message', 0]},
              else: 'No messages',
            },
          },
          lastMessageAt: {
            $cond: {
              if: {$gt: [{$size: '$messages'}, 0]},
              then: {$arrayElemAt: ['$messages.createdAt', 0]},
              else: null,
            },
          },
          unreadCount: {
            $sum: {
              $map: {
                input: '$messages',
                in: {
                  $cond: [
                    {
                      $and: [{$eq: ['$$this.receiver', userId]}, {$eq: ['$$this.read', false]}],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        },
      },
      {
        $sort: {lastMessageAt: -1, learnerName: 1},
      },
    ]);

    // Step 3: Combine admin chat with learner chats with consistent fields
    const adminChatHead =
      adminChat.length > 0
        ? {
            learnerId: schoolId, // Renamed from id to learnerId
            learnerName: `${schoolName} (Admin)`, // Renamed from name to learnerName
            streamName: null, // No stream for admin
            classManagerId: schoolId, // No class manager for admin
            classManagerName: 'School Admin', // Default value
            lastMessage: adminChat[0].lastMessage,
            lastMessageAt: adminChat[0].lastMessageAt ? new Date(adminChat[0].lastMessageAt) : null,
            unreadCount: adminChat[0].unreadCount,
            avatar: req.user.school.avatar || 'default-school-avatar-url',
          }
        : {
            learnerId: schoolId, // Renamed from id to learnerId
            learnerName: `${schoolName} (Admin)`, // Renamed from name to learnerName
            streamName: null, // No stream for admin
            classManagerId: schoolId, // No class manager for admin
            classManagerName: 'School Admin', // Default value
            lastMessage: 'No messages',
            lastMessageAt: null,
            unreadCount: 0,
            avatar: req.user.school.avatar || 'default-school-avatar-url',
          };

    const learnerChatHeads = learnerChats.map(chat => ({
      learnerId: chat.learnerId.toString(),
      learnerName: chat.learnerName,
      streamName: chat.streamName,
      classManagerId: chat.classManagerId ? chat.classManagerId.toString() : null,
      classManagerName: chat.classManagerName.trim() || 'Not assigned',
      lastMessage: chat.lastMessage,
      lastMessageAt: chat.lastMessageAt ? new Date(chat.lastMessageAt) : null,
      unreadCount: chat.unreadCount,
      avatar: chat.avatar || 'default-learner-avatar-url',
    }));

    // Combine: Admin chat first, then learner chats
    const chatHeads = [adminChatHead, ...learnerChatHeads];

    res.status(200).json({success: true, chatHeads});
  } catch (error) {
    console.error('Error fetching chat heads:', error);
    res.status(500).json({success: false, message: 'Server error'});
  }
});

router.get('/chat-heads-admin', async (req, res) => {
  try {
    const schoolId = req.user.school._id; // School ID from req.user.school
    const schoolName = req.user.school.name || 'School Admin'; // School name
    console.log({sender: schoolId, senderModel: 'School'}, {receiver: schoolId, receiverModel: 'School'});

    // Step 1: Aggregate chat heads from Message collection where school is sender or receiver
    const chatHeadsAgg = await Message.aggregate([
      {
        $match: {
          $or: [
            {sender: new mongoose.Types.ObjectId(schoolId), senderModel: 'School'}, // School sent the message
            {receiver: new mongoose.Types.ObjectId(schoolId), receiverModel: 'School'}, // School received the message
          ],
        },
      },
      {
        $group: {
          _id: {
            $cond: [
              {$eq: ['$sender', new mongoose.Types.ObjectId(schoolId)]},
              '$receiver', // If school is sender, group by receiver (parent)
              '$sender', // If school is receiver, group by sender (parent)
            ],
          },
          senderModel: {$first: '$senderModel'},
          receiverModel: {$first: '$receiverModel'},
          lastMessage: {$first: '$message'},
          lastMessageAt: {$first: '$createdAt'},
          messages: {$push: '$$ROOT'},
        },
      },
      {
        $lookup: {
          from: 'parents', // Fetch parent details from parents collection
          localField: '_id',
          foreignField: '_id',
          as: 'parentInfo',
        },
      },
      {
        $unwind: '$parentInfo', // Unwind parent info
      },
      {
        $project: {
          parentId: '$_id', // Parent's ID
          parentName: {
            $concat: [{$ifNull: ['$parentInfo.first_name', '']}, ' ', {$ifNull: ['$parentInfo.last_name', '']}],
          },
          lastMessage: {$ifNull: ['$lastMessage', 'No messages']},
          lastMessageAt: '$lastMessageAt',
          unreadCount: {
            $sum: {
              $map: {
                input: '$messages',
                in: {
                  $cond: [
                    {
                      $and: [
                        {$eq: ['$$this.receiver', schoolId]},
                        {$eq: ['$$this.receiverModel', 'School']},
                        {$eq: ['$$this.read', false]},
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
          avatar: {$ifNull: ['$parentInfo.avatar', 'default-parent-avatar-url']},
        },
      },
      {
        $sort: {lastMessageAt: -1, name: 1}, // Sort by last message (latest first), then name
      },
    ]);

    // Step 2: Count total chat heads
    const totalChatHeads = chatHeadsAgg.length;

    // Step 3: Return response with chat heads and count
    res.status(200).json({
      success: true,
      chatHeads: chatHeadsAgg,
      total: totalChatHeads,
    });
  } catch (error) {
    console.error('Error fetching chat heads:', error);
    res.status(500).json({success: false, message: 'Server error'});
  }
});
// Fetch messages between user and parent
router.get('/:parentId', async (req, res) => {
  try {
    const {userModel, parentId} = req.params;
    const {learner} = req.query; // Assuming learner comes from query params

    const userId = req.user._id;
    const learnerId = mongoose.Types.ObjectId.isValid(learner) ? new mongoose.Types.ObjectId(learner) : null;
    const parent = mongoose.Types.ObjectId.isValid(parentId) ? new mongoose.Types.ObjectId(parentId) : null;

    if (!learnerId || !parent) {
      return res.status(400).json({error: 'Invalid learner or parent ID'});
    }

    const query = {
      $or: [
        {learner: learnerId, receiver: parent, receiverModel: 'Parent'},
        {learner: learnerId, sender: parent, senderModel: 'Parent'},
      ],
    };

    console.log(query);

    // Fetch messages
    const messages = await Message.find(query).sort({createdAt: 1});

    // Update `read` to true for messages where the parent is the receiver and read is false
    await Message.updateMany(
      {
        learner: learnerId,
        receiver: parent,
        receiverModel: 'Parent',
        read: false,
      },
      {$set: {read: true}},
    );

    res.status(200).json({data: messages});
  } catch (error) {
    console.error('Error fetching messages:', error);
    res.status(500).json({error: error.message});
  }
});

router.get('/admin-messages/:parentId', async (req, res) => {
  try {
    const schoolId = req.user.school; // School ID from req.user.school
    const {parentId} = req.params; // Parent ID from route params

    // Validate parentId
    if (!mongoose.Types.ObjectId.isValid(parentId)) {
      return res.status(400).json({error: 'Invalid parent ID'});
    }
    const parentObjectId = new mongoose.Types.ObjectId(parentId);

    const query = {
      $or: [
        {sender: schoolId, senderModel: 'School', receiver: parentObjectId, receiverModel: 'Parent'},
        {sender: parentObjectId, senderModel: 'Parent', receiver: schoolId, receiverModel: 'School'},
      ],
    };

    // Log the query for debugging
    console.log(query);

    // Fetch messages
    const messages = await Message.find(query).sort({createdAt: 1});

    // Update `read` to true for messages where the school is the receiver and read is false
    await Message.updateMany(
      {
        sender: parentObjectId,
        senderModel: 'Parent',
        receiver: schoolId,
        receiverModel: 'School',
        read: false,
      },
      {$set: {read: true}},
    );

    res.status(200).json({data: messages});
  } catch (error) {
    console.error('Error fetching admin messages:', error);
    res.status(500).json({error: error.message});
  }
});
// router.get('/:parentId', async (req, res) => {
//   try {
//     const {userModel, parentId, parentModel} = req.params;
//     const userId = req.user._id;
//     console.log({sender: userId, senderModel: userModel, receiver: parentId, receiverModel: parentModel});
//     const messages = await Message.find({
//       $or: [
//         {sender: userId, senderModel: 'Parent', receiver: parentId, receiverModel: 'Parent'},
//         {sender: parentId, senderModel: 'Parent', receiver: userId, receiverModel: 'Parent'},
//       ],
//     }).sort({createdAt: 1});

//     res.status(200).json({data: messages});
//   } catch (error) {
//     res.status(500).json({error: error.message});
//   }
// });

// Mark message as read
router.put('/read/:messageId', async (req, res) => {
  try {
    const {messageId} = req.params;
    const userId = req.user._id; // Assuming user ID is available in req.user
    const userSchoolId = req.user.school; // Optional: School ID for admin/school users

    // Validate messageId
    if (!mongoose.Types.ObjectId.isValid(messageId)) {
      return res.status(400).json({error: 'Invalid message ID'});
    }
    const messageObjectId = new mongoose.Types.ObjectId(messageId);

    // Find the message
    const message = await Message.findById(messageObjectId);
    if (!message) {
      return res.status(404).json({error: 'Message not found'});
    }

    // Check if the user is the receiver
    const isReceiver =
      (message.receiverModel === 'Parent' && message.receiver.equals(userId)) ||
      (message.receiverModel === 'School' && userSchoolId && message.receiver.equals(userSchoolId));

    if (!isReceiver) {
      return res.status(403).json({error: 'Unauthorized: You are not the receiver of this message'});
    }

    // Update the message's read status
    const updatedMessage = await Message.findByIdAndUpdate(messageObjectId, {read: true}, {new: true});

    res.status(200).json({message: 'Message marked as read', data: updatedMessage});
  } catch (error) {
    console.error('Error marking message as read:', error);
    res.status(500).json({error: error.message});
  }
});

module.exports = router;
