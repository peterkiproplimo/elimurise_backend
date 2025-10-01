const {exec} = require('child_process');
const {Worker} = require('bullmq');
const IORedis = require('ioredis');
const ParentService = require('../services/portal/ParentServce');
const cron = require('node-cron');
const Learner = require('../models/portal/content/Learner');
const NotificationService = require('../services/NotificationService');

const parentService = new ParentService();
const notificationService = new NotificationService();

// Start Redis Server Manually
exec('redis-server', (error, stdout, stderr) => {
  if (error) {
    console.error(`❌ Error starting Redis: ${error.message}`);
    return;
  }
  console.log(`✅ Redis started: ${stdout}`);
});

// Create a Redis connection
const redisConnection = new IORedis({
  host: '127.0.0.1',
  port: 6379,
  maxRetriesPerRequest: null, // Fixes BullMQ error
});

// Create BullMQ Worker
const emailWorker = new Worker(
  'emailQueue',
  async job => {
    try {
      const {parentId, school} = job.data;
      await parentService.triggerWelcomeEmail(parentId, school);
      console.log(`✅ Welcome email sent to parent ID: ${parentId}`);
    } catch (error) {
      console.error(`❌ Error processing job: ${error.message}`);
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
  },
);

// Event Listeners
emailWorker.on('completed', async job => {
  console.log(`✅ Job ${job.id} completed`);
  await job.remove(); // Remove job from queue after execution
});

emailWorker.on('failed', (job, err) => {
  console.error(`❌ Job ${job.id} failed: ${err.message}`);
});

// Birthday cron job: runs every day at 8:00 AM
cron.schedule('48 20 * * *', async () => {
  try {
    const today = new Date();
    const month = today.getMonth() + 1; // getMonth() is 0-based
    const day = today.getDate();

    // Find learners whose birthday is today (ignoring year)
    const learners = await Learner.find({
      dateOfBirth: {
        $exists: true,
        $ne: null,
      },
      $where: `this.dateOfBirth.getDate() == ${day} && (this.dateOfBirth.getMonth() + 1) == ${month}`,
    })
      .populate('guardian')
      .populate('school');

    for (const learner of learners) {
      // Send birthday message to learner (or their guardian)
      const name = learner.first_name || 'Learner';
      const email = learner.guardian?.email;
      if (email) {
        await notificationService.sendMail(
          name,
          email,
          'Happy Birthday!',
          `Happy Birthday from all of us at ${learner.school.name}! We wish you a wonderful year ahead.</p>`,
        );
        // console.log(`Birthday message sent to ${name} (${email})`);
      }
    }
    // console.log(`Birthday cron job completed. ${learners.length} learners found.`);
  } catch (err) {
    console.error('Error in birthday cron job:', err);
  }
});

module.exports = emailWorker;
