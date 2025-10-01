const Learner = require('../../models/portal/content/Learner');
const EnrollmentService = require('../portal/EnrollmentService');
const bcrypt = require('bcryptjs');

const mongoose = require('mongoose');
const enrollmentService = new EnrollmentService();
const NotificationService = require('../../services/NotificationService');
const GradeUserAssignment = require('../../models/portal/content/grade_teacher_asigment');
const Enrollment = require('../../models/portal/content/Enrollment');
const {stream} = require('winston');
const Stream = require('../../models/portal/content/Stream');

const notificationService = new NotificationService();
class LearnerService {
  // async getLearners(page = 1, limit = 0, searchQuery = {}, is_a_teacher, teacher, session, sortQuery) {
  //   try {
  //     const skip = (page - 1) * limit;
  //     let learners = [];
  //     console.log('teacher', teacher);
  //     const streams_assigned = await Stream.find({school: searchQuery.school, class_manager: teacher._id}).select(
  //       '_id',
  //     );
  //     const streams_manager = streams_assigned.map(g => g._id);

  //     if (is_a_teacher) {
  //       const distinctStreamIds = await GradeUserAssignment.distinct('stream', {
  //         stream: searchQuery.stream ? searchQuery.stream : {$ne: null},
  //         user: teacher.teacher,
  //         session: session,
  //       });
  //       console.log('streams_manager', streams_manager);
  //       const streams = distinctStreamIds.map(stream => stream._id).concat(streams_manager);
  //       // streams = streams.concat(streams_manager);
  //       searchQuery.stream = {$in: streams};
  //       learners = await Learner.find(searchQuery)
  //         .sort(sortQuery)
  //         .populate('grade stream')
  //         .populate('guardian')
  //         .populate('guardian2')
  //         .skip(skip)
  //         .limit(limit)
  //         .exec();
  //       console.log(searchQuery);
  //     } else if (limit < 1) {
  //       learners = await Learner.find(searchQuery)
  //         .sort(sortQuery)
  //         .populate('grade stream')
  //         .populate('guardian')
  //         .populate('guardian2')
  //         // .skip(skip)
  //         // .sort({createdAt: -1})
  //         // .limit(limit)
  //         .exec();
  //     } else {
  //       learners = await Learner.find(searchQuery)
  //         .sort(sortQuery)
  //         .populate('grade stream')
  //         .populate('guardian')
  //         .populate('guardian2')
  //         .skip(skip)
  //         .sort({createdAt: -1})
  //         .limit(limit)
  //         .exec();
  //     }
  //     console.log(searchQuery);
  //     // Count total learners matching the query
  //     const totalLearners = await Learner.countDocuments(searchQuery);

  //     // Calculate total pages
  //     const totalPages = Math.ceil(totalLearners / limit);

  //     // Return paginated result
  //     return {
  //       data: learners,
  //       pagination: {
  //         current_page: page,
  //         total: totalLearners,
  //         total_pages: totalPages,
  //         per_page: limit,
  //       },
  //       searchQuery,
  //     };
  //   } catch (error) {
  //     console.error(error);
  //     throw new Error('Failed to fetch learners' + error.message);
  //   }
  // }
  // Helper function to mask sensitive guardian information
  maskGuardianInfo(guardian) {
    if (!guardian) return null;
    const maskedGuardian = {...(guardian._doc || guardian)}; // Handle both populated and plain objects

    // Mask ID number (show only last 4 characters if exists)
    if (maskedGuardian.id_no) {
      maskedGuardian.id_no = maskedGuardian.id_no.replace(/.(?=.{4})/g, '*');
    }

    // Mask email (keep domain visible)
    if (maskedGuardian.email) {
      const [local, domain] = maskedGuardian.email.split('@');
      maskedGuardian.email = `${local.slice(0, 2)}${'*'.repeat(local.length - 2)}@${domain}`;
    }

    // Mask phone (show only last 4 digits)
    if (maskedGuardian.phone) {
      maskedGuardian.phone = maskedGuardian.phone.replace(/.(?=.{4})/g, '*');
    }

    // Remove password
    delete maskedGuardian.password;

    return maskedGuardian;
  }

  async getLearners(page = 1, limit = 0, searchQuery = {}, is_a_teacher, teacher, session, sortQuery) {
    try {
      const skip = (page - 1) * limit;
      let learners = [];
      console.log('teacher', teacher);
      const streams_assigned = await Stream.find({
        school: searchQuery.school,
        $or: [{class_manager: teacher._id}, {section_head: teacher._id}],
      });
      const streams_manager = streams_assigned.map(g => g._id);

      if (is_a_teacher) {
        const distinctStreamIds = await GradeUserAssignment.distinct('stream', {
          stream: searchQuery.stream ? searchQuery.stream : {$ne: null},
          user: teacher.teacher,
          session: session,
        });
        console.log('streams_manager', streams_manager);
        const streams = distinctStreamIds.map(stream => stream._id).concat(streams_manager);
        searchQuery.stream = {$in: streams};
        learners = await Learner.find(searchQuery)
          .sort(sortQuery)
          .populate('grade stream')
          .populate('guardian')
          .populate('guardian2')
          .skip(skip)
          .limit(limit)
          .lean() // Added lean() for performance with transformation
          .exec();

        // Mask guardian information only when user is a teacher
        learners = learners.map(learner => ({
          ...learner,
          guardian: this.maskGuardianInfo(learner.guardian),
          guardian2: this.maskGuardianInfo(learner.guardian2),
        }));
        console.log(searchQuery);
      } else if (limit < 1) {
        learners = await Learner.find(searchQuery)
          .sort(sortQuery)
          .populate('grade stream')
          .populate('guardian')
          .populate('guardian2')
          .exec();
      } else {
        learners = await Learner.find(searchQuery)
          .sort(sortQuery)
          .populate('grade stream')
          .populate('guardian')
          .populate('guardian2')
          .skip(skip)
          .sort({createdAt: -1})
          .limit(limit)
          .exec();
      }
      console.log(searchQuery);
      // Count total learners matching the query
      const totalLearners = await Learner.countDocuments(searchQuery);

      // Calculate total pages
      const totalPages = Math.ceil(totalLearners / limit);

      // Return paginated result
      return {
        data: learners,
        pagination: {
          current_page: page,
          total: totalLearners,
          total_pages: totalPages,
          per_page: limit,
        },
        searchQuery,
      };
    } catch (error) {
      console.error(error);
      throw new Error('Failed to fetch learners' + error.message);
    }
  }
  async getAllLearners(query) {
    try {
      // const history = await Enrollment.find({})
      const learners = await Learner.find(query)
        .populate('grade stream')
        .populate('guardian')
        .populate('guardian2')
        .exec();

      // Count total learners matching the query
      // Return paginated result
      return {
        data: learners,
      };
    } catch (error) {
      console.error(error);
      throw new Error('Failed to fetch learners');
    }
  }
  async getLearnerHistory(learner) {
    try {
      const history = await Enrollment.find({learner})
        .populate('from_grade to_grade from_stream to_stream school learner')
        .exec();

      // Count total learners matching the query
      // Return paginated result
      return {
        data: history,
      };
    } catch (error) {
      console.error(error);
      throw new Error('Failed to fetch learners');
    }
  }
  async searchLearners(query, page = 1, limit = 10) {
    try {
      const searchRegex = new RegExp(query, 'i');
      const searchQuery = {
        $or: [
          {first_name: {$regex: searchRegex}},
          {last_name: {$regex: searchRegex}},
          {surname: {$regex: searchRegex}},
          // Add more fields to search here
        ],
      };
      return await this.getLearners(page, limit, searchQuery);
    } catch (error) {
      throw new Error('Failed to search learners');
    }
  }

  async generateRandomPassword(length) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let password = '';
    for (let i = 0; i < length; i++) {
      password += chars[Math.floor(Math.random() * chars.length)];
    }
    return password;
  }

  // async createLearner(data) {
  //   const session = await mongoose.startSession();
  //   session.startTransaction();

  //   try {
  //     const {
  //       school,
  //       stream,
  //       grade,
  //       gender,
  //       current_session,
  //       first_name,
  //       last_name,
  //       surname,
  //       adm_no,
  //       nemis_no,
  //       status,
  //       guardian,
  //       guardian_relationship,
  //       guardian2,
  //       guardian2_relationship,
  //       image,
  //     } = data;
  //     const g2_relationship = guardian2 == '' ? undefined : guardian2_relationship;

  //     // const password_text = await this.generateRandomPassword(8); // Generate an 8-character random password
  //     // console.log(password_text);
  //     // const password = await bcrypt.hash(password_text, 12);
  //     // await notificationService.sendMail(
  //     //   guardian_first_name,
  //     //   guardian_email,
  //     //   'Student Portal',
  //     //   `Your password is,
  //     //   <center><h1>${password_text}</h1></center>,<br/>
  //     //     <center><h1><a href="http://localhost:5134/parent>Click here to login</a>"</h1></center>,<br/>
  //     //    Please Do not share with any one.
  //     //    <br/>If you didn't request for password reset
  //     //    please ignore this mail`,
  //     // );

  //     const guardian_2 = guardian2 == '' ? undefined : guardian2;
  //     // Set the OTP and its expiration time
  //     const learner = new Learner({
  //       school,
  //       stream,
  //       current_session,
  //       grade,
  //       gender,
  //       first_name,
  //       last_name,
  //       surname,
  //       adm_no,
  //       nemis_no,
  //       status,
  //       guardian,
  //       guardian_relationship,
  //       guardian2: guardian_2,
  //       guardian2_relationship: g2_relationship,
  //       photo: image,
  //     });
  //     const savedLearner = await learner.save({session});

  //     await enrollmentService.createEnrollment(
  //       {
  //         school: school,
  //         learner: savedLearner._id,
  //         to_grade: grade, // Use optional chaining
  //         to_stream: stream, // Use optional chaining
  //         to_session: current_session,
  //         grad: 0,
  //         status: 'P',
  //       },
  //       session,
  //     );

  //     await session.commitTransaction();
  //     session.endSession();
  //     return savedLearner;
  //   } catch (error) {
  //     await session.abortTransaction();
  //     session.endSession();
  //     throw new Error('Failed to create learner' + error.message);
  //   }
  // }
  async createLearner(data) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const {
        school,
        stream,
        grade,
        gender,
        current_session,
        first_name,
        last_name,
        surname,
        adm_no,
        nemis_no,
        assessment_no,
        status,
        guardian,
        guardian_relationship,
        guardian2,
        guardian2_relationship,
        image,
        dateOfBirth,
        religion,
      } = data;

      if (!school || !grade || !stream || !current_session || !first_name || !adm_no) {
        throw new Error('Missing required fields');
      }

      const learner = new Learner({
        school,
        stream,
        current_session,
        grade,
        gender,
        first_name,
        last_name,
        surname,
        adm_no,
        nemis_no,
        assessment_no,
        status,
        guardian,
        guardian_relationship,
        guardian2: guardian2 || undefined,
        guardian2_relationship: guardian2 ? guardian2_relationship : undefined,
        photo: image,
        dateOfBirth,
        religion,
      });

      const savedLearner = await learner.save({session});

      await enrollmentService.createEnrollment(
        {
          school,
          learner: savedLearner._id,
          to_grade: grade,
          to_stream: stream,
          to_session: current_session,
          grad: 0,
          status: 'P',
        },
        session,
      );

      await session.commitTransaction();
      return savedLearner;
    } catch (error) {
      await session.abortTransaction();
      throw new Error(`Failed to create learner: ${error.message}`);
    } finally {
      session.endSession();
    }
  }

  async updateLearner(id, data) {
    try {
      console.log(data);
      const {
        school,
        first_name,
        last_name,
        surname,
        adm_no,
        nemis_no,
        status,
        guardian,
        guardian2,
        image,
        gender,
        guardian_relationship,
        guardian2_relationship,
        dateOfBirth,
        religion,
      } = data;
      const guardian_2 = guardian2 == '' ? undefined : guardian2;
      const g2_relationship = guardian2 == '' ? undefined : guardian2_relationship;

      const updateData = {
        school,
        first_name,
        last_name,
        surname,
        adm_no,
        nemis_no,
        status,
        guardian,
        guardian2: guardian_2,
        gender,
        guardian_relationship,
        guardian2_relationship: g2_relationship,
        dateOfBirth,
        religion,
      };
      if (updateData.guardian2 === undefined) {
        updateData.$unset = {guardian2: 1, guardian2_relationship: 1};
      }

      // Only include the photo field if it is provided
      if (image) {
        updateData.photo = image;
      }

      const learner = await Learner.findByIdAndUpdate(
        id,
        updateData,
        {new: true}, // Return the updated document
      );
      console.log(updateData);
      console.log(learner);
      return learner;
    } catch (error) {
      console.log(error);
      throw new Error('Failed to update learner');
    }
  }

  async deleteLearner(id, school) {
    try {
      const deletedLearner = await Learner.findOneAndDelete({_id: id, school: school});

      return deletedLearner;
    } catch (error) {
      throw new Error('Failed to delete learner');
    }
  }
  async disableLearner(id, school) {
    try {
      const learner = await Learner.findOne({_id: id, school});
      if (!learner) {
        throw new Error('Failed to change learner status');
      }
      if (learner.status == 'P') {
        learner.status = 'D';
      } else {
        learner.status = 'P';
      }

      return await learner.save();
    } catch (error) {
      console.log(error);
      throw new Error('Failed to change learner status');
    }
  }
  async importData() {
    const learners = [];

    // Read and parse CSV
    fs.createReadStream('learners.csv') // Update with your CSV file path
      .pipe(csv())
      .on('data', row => {
        // Convert `row` fields if necessary, e.g., Date fields

        learners.push(row);
      })
      .on('end', async () => {
        try {
          await Learner.insertMany(learners);
          console.log('Learners data imported successfully');
        } catch (error) {
          console.error('Error importing data:', error);
        } finally {
          mongoose.connection.close();
        }
      });
  }

  async sendOTP(email, adm_no) {
    try {
      // Find user by email
      const user = await Learner.findOne({guardian_email: email, adm_no});

      if (!user) {
        throw new Error('Provided email is not registered in our system');
      }

      // Generate a random OTP
      const OTP = Math.floor(100000 + Math.random() * 900000).toString();
      await notificationService.sendMail(
        user.guardian_email,
        email,
        'One Time Password(OTP)',
        `Your one time password is,
        <center><h1>${OTP}</h1></center>,<br/>
         Please Do not share with any one.
         <br/>If you didn't request for password reset 
         please ignore this mail`,
      );

      // Set the OTP and its expiration time
      user.otp = OTP;
      user.otp_expires_in = Date.now() + 600000; // OTP expires in 10 minutes
      // Save the user with the OTP details
      await user.save();

      return 'OTP sent successfully ' + OTP;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = LearnerService;
