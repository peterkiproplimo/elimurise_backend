const Enrollment = require('../../models/portal/content/Enrollment');
// import {ObjectId} from 'mongodb';
const Assessment = require('../../models/portal/content/Asessment');
const Learner = require('../../models/portal/content/Learner');

const Stream = require('../../models/portal/content/Stream');

const mongoose = require('mongoose');
const GradeUserAssignment = require('../../models/portal/content/grade_teacher_asigment');
const PublishedIndicators = require('../../models/portal/content/PublishedIndicators');
const Grade = require('../../models/cms/content/grade');

class EnrollmentService {
  async getEnrollments(page = 1, limit = 10, searchQuery = {}, teacher, search) {
    try {
      if (teacher) {
        const distinctStreamIds = await GradeUserAssignment.distinct('stream', {
          user: teacher,
          session: searchQuery.session,
        });
        const streams = distinctStreamIds.map(stream => stream._id);
        searchQuery.stream = {$in: streams};
      }

      const skip = (page - 1) * limit;
      // Fetch enrollments with pagination
      if (search) {
        const query = {
          $or: [
            {first_name: {$regex: new RegExp(search, 'i')}},
            {last_name: {$regex: new RegExp(search, 'i')}},
            {surname: {$regex: new RegExp(search, 'i')}},
            {adm_no: {$regex: new RegExp(search, 'i')}},
          ],
        };
        const learners = await Learner.find(query);
        const learnerList = learners.map(learner => learner._id);
        searchQuery.learner = {$in: learnerList};
      }
      console.log(searchQuery);
      const enrollments = await Enrollment.find(searchQuery).skip(skip).limit(limit).exec();
      console.log(enrollments);
      // Count total enrollments matching the query
      const totalEnrollments = await Enrollment.countDocuments(searchQuery);

      // Calculate total pages
      const totalPages = Math.ceil(totalEnrollments / limit);

      // Return paginated result
      return {
        data: enrollments,
        pagination: {
          current_page: page,
          total: totalEnrollments,
          total_pages: totalPages,
          per_page: limit,
        },
      };
    } catch (error) {
      console.error(error);
      throw new Error('Failed to fetch enrollments');
    }
  }

  async searchEnrollments(query, page = 1, limit = 10) {
    try {
      return await this.getEnrollments(page, limit, query);
    } catch (error) {
      throw new Error('Failed to search enrollments');
    }
  }
  async getEnrollmentsByStream(stream) {
    try {
      const enrollments = await Enrollment.find({stream: stream});

      return {data: enrollments, sucsess: true};
    } catch (error) {
      throw new Error('Failed to search enrollments');
    }
  }
  async getLearnerGrades(learnerId) {
    try {
      console.log({learner: learnerId});
      const enrollments = await Enrollment.find({learner: learnerId})
        .populate('to_grade', 'name') // Populate only the to_grade field with the grade name
        .populate('to_stream', 'name') // Populate only the to_grade field with the grade name
        .sort({from_session: 1}); // Sort by session to maintain chronological order
      // Extract only the to_grade names from each enrollment
      const grades = enrollments.map(enrollment => ({
        id: enrollment.to_stream._id,
        stream: enrollment.to_stream.name || 'N/A', // Optionally include session info
        grade: enrollment.to_stream.grade.name || 'N/A', // Optionally include session info
        session: enrollment.to_session || 'N/A', // Optionally include session info
      }));
      console.log(grades);

      return grades;
    } catch (error) {
      console.error('Error fetching learner grades:', error);
      throw new Error('Failed to retrieve learner grades');
    }
  }

  async createEnrollment(data, session) {
    try {
      console.log(data);
      const enrollment = new Enrollment(data);
      const savedEnrollment = await enrollment.save({session});
      return savedEnrollment;
    } catch (error) {
      console.log(error);
      throw new Error('Failed to create enrollment' + error.message);
    }
  }

  // async updateEnrollment(id, data) {
  //   try {
  //     const enrollment = await Enrollment.findByIdAndUpdate(id, data, {
  //       new: true,
  //     });
  //     return enrollment;
  //   } catch (error) {
  //     throw new Error('Failed to update enrollment');
  //   }
  // }

  async fetchLearnersTransistion(data) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Build the query with an optional stream filter
      const query = {
        school: data.school,
        current_session: data.current_session,
        stream: data.from_stream,
        grade: data.from_grade,
        $or: [{status: 'D'}, {status: 'P'}],
      };
      console.log(query);
      const from_stream = await Stream.findOne({_id: data.from_stream, grade: data.from_grade}).populate('grade');
      const to_stream = await Stream.findOne({_id: data.to_stream, grade: data.to_grade}).populate('grade');

      const currentEnrollments = await Learner.find(query).session(session).populate('grade stream');
      if (currentEnrollments.length < 1) {
        return {success: false, message: 'No learners found for selected stream'};
      }
      // const newEnrollments = currentEnrollments.map(enrollment => ({
      //   school: enrollment.school,
      //   learner: enrollment.learner,
      //   session: data.nextsessionId,
      //   stream: data.nextStreamId,
      //   isTransitioned: true,
      //   originalsession: data.currentsessionId,
      //   // Include other fields that should be copied to the new enrollment
      // }));
      // Insert new enrollments
      // await Enrollment.insertMany(newEnrollments, {session});

      // Commit the transaction
      await session.commitTransaction();
      session.endSession();

      console.log('Transition successful');
      return {
        success: true,
        data: {learners: currentEnrollments, from_stream, to_stream},
        message: 'Learners promoted successfully',
      };
    } catch (error) {
      // Rollback the transaction in case of an error
      await session.abortTransaction();
      session.endSession();

      console.error('Transition failed, rolling back', error);
      return {success: false, message: 'Failed to fetch learner'};
    }
  }
  async transitionLearners(data) {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      // Build the query with an optional stream filter
      const query = {
        school: data.school,
        current_session: data.current_session,
        stream: data.from_stream,
        grade: data.from_grade,
      };
      console.log(query);

      const from_stream = await Stream.findOne({_id: data.from_stream, grade: data.from_grade}).populate('grade');
      const to_stream = await Stream.findOne({_id: data.to_stream, grade: data.to_grade}).populate('grade');
      const enrollments = [];

      if (Array.isArray(data.learners)) {
        for (let i = 0; i < data.learners.length; i++) {
          const learnerData = data.learners[i];

          const learner = await Learner.findOne({...query, _id: learnerData.id}).session(session);
          if (learner) {
            // Update the original enrollment to set grad: 1
            await Enrollment.updateMany(
              {
                learner: learner._id,
                school: data.school,
                to_grade: learner.grade,
                // to_stream: data.from_stream,
                // to_session: data.current_session,
              },
              {$set: {grad: 1}},
              {session},
            );
            const isSameGradeAndStream = data.from_grade === data.to_grade && data.from_stream === data.to_stream;

            if (learnerData.status !== 'G' && !isSameGradeAndStream) {
              // Create new enrollment for the transition
              enrollments.push({
                school: data.school,
                learner: learner._id,
                from_grade: from_stream?.grade?._id,
                from_stream: from_stream?._id,
                to_grade: learnerData.status === 'G' ? from_stream?.grade?._id : to_stream?.grade?._id,
                to_stream: learnerData.status === 'G' ? from_stream?._id : to_stream?._id,
                from_session: query.current_session,
                to_session: learnerData.status === 'G' ? query.current_session : data.next_session,
                grad: learnerData.status === 'G' ? 1 : 0,
                status: learnerData.status,
              });
            }
            // Update learner details
            learner.current_session = learnerData.status === 'G' ? query.current_session : data.next_session;
            learner.stream = learnerData.status === 'G' ? from_stream?._id : to_stream?._id;
            learner.grade = learnerData.status === 'G' ? from_stream?.grade?._id : to_stream?.grade?._id;
            if (learnerData.status === 'G') {
              learner.status = 'G';
              learner.grad_date = Date.now();
            }
            if (learnerData.status === 'L') {
              learner.status = 'L';
              learner.left_date = Date.now();
            }
            if (learnerData.status === 'P') {
              learner.status = 'P';
              learner.left_date = undefined;
            }
            await learner.save({session});
          }
        }
      }

      // if (enrollments.length < 1) {
      //   return {success: false, message: 'No learners found for transition'};
      // }

      // Insert new enrollments
      const results = await Enrollment.insertMany(enrollments, {session});
      // Commit the transaction
      await session.commitTransaction();
      return {
        success: true,
        data: {enrollments: results},
        message: 'Learners promoted successfully',
      };
    } catch (error) {
      // Rollback the transaction in case of an error
      await session.abortTransaction();
      return {success: false, message: `Failed to transition learners: ${error.message}`};
    } finally {
      session.endSession();
    }
  }

  async rollbackTransitionLearners(
    school,
    currentsessionId,
    nextsessionId,
    currentStreamId = null,
    nextStreamId = null,
  ) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Build the query with an optional stream filter
      const query = {school: school, session: currentsessionId, streamId: currentStreamId};

      const currentEnrollments = await Enrollment.find(query).session(session);

      const newEnrollments = currentEnrollments.map(enrollment => ({
        school: enrollment.school,
        learner: enrollment.learner,
        session: nextsessionId,
        stream: nextStreamId,
        isTransitioned: true,
        originalsession: currentsessionId,
        // Include other fields that should be copied to the new enrollment
      }));

      // Insert new enrollments
      await Enrollment.insertMany(newEnrollments, {session});

      // Commit the transaction
      await session.commitTransaction();
      session.endSession();

      console.log('Transition successful');
      return {success: true};
    } catch (error) {
      // Rollback the transaction in case of an error
      await session.abortTransaction();
      session.endSession();

      console.error('Transition failed, rolling back', error);
      return {success: false, error};
    }
  }
  async getNotAssessedLearners(school, stream, session, term, indicator) {
    try {
      // Find all enrollments for the specified criteria
      const enrollments = await Enrollment.find({school, stream, session}).populate('learner');

      // Extract learner IDs from the enrollments
      const learnerIds = enrollments.map(enrollment => enrollment.learner._id);

      // Find assessments for the specified term and indicator
      const assessments = await Assessment.find({term, indicator}).populate('enrollment');

      // Extract learner IDs from the assessments
      const assessedLearnerIds = assessments.map(assessment => assessment.enrollment.learner.toString());

      // Find learners who have not been assessed
      const notAssessedLearners = learnerIds.filter(id => !assessedLearnerIds.includes(id.toString()));

      // Fetch learner details for the not assessed learners
      const notAssessedLearnerDetails = await Enrollment.find({
        learner: {$in: notAssessedLearners},
        school,
        stream,
        session,
      }).populate('learner');

      return notAssessedLearnerDetails;
    } catch (error) {
      throw new Error(`Failed to retrieve not assessed learners: ${error.message}`);
    }
  }
  async getLearnersWithAssessmentStatus(school, stream, session, term, indicator, adm_no) {
    try {
      const enrollment = await Enrollment.find({school, to_stream: stream, to_session: session});
      // Find all enrollments for the specified criteria
      const learners_ids = enrollment.map(learner => learner.learner);
      const learnerQuery = {school, _id: {$in: learners_ids}, $or: [{status: 'D'}, {status: 'P'}]};

      // Build query for finding learners, adding an optional admission number filter
      // const learnerQuery = {school, stream, current_session: session};
      if (adm_no) {
        const regex = new RegExp(adm_no.trim(), 'i'); // 'i' makes the regex case-insensitive
        learnerQuery.adm_no = regex;
      }

      // Find all learners for the specified criteria
      const learners = await Learner.find(learnerQuery).sort({first_name: 1});
      // Find assessments for the specified term and indicator
      const assessments = await Assessment.find({term, indicator}).populate('learner');

      // Create a map of learner IDs to their assessments
      const assessmentMap = {};
      assessments.forEach(assessment => {
        const learnerId = assessment?.learner?._id?.toString();
        if (learnerId) {
          assessmentMap[learnerId] = assessment;
        }
      });

      // Build the result array with assessment status and details
      const result = learners.map(learner => {
        const learnerId = learner?._id?.toString();
        const assessment = assessmentMap[learnerId];

        return {
          learner,
          assessed: !!assessment,
          assessmentDetails: assessment || null,
        };
      });

      return result;
    } catch (error) {
      console.error(`Error retrieving learners with assessment status: ${error.message}`);
      throw new Error(`Failed to retrieve learners with assessment status: ${error.message}`);
    }
  }

  // async deleteEnrollment(id) {
  //   try {
  //     const deletedEnrollment = await Enrollment.findByIdAndDelete(id);
  //     return deletedEnrollment;
  //   } catch (error) {
  //     throw new Error('Failed to delete enrollment');
  //   }
  // }
  async getEnrollmentsByParent(parentId, session) {
    try {
      // Find learners where the parent is either guardian or guardian2
      const learners = await Learner.find({$or: [{guardian: parentId}, {guardian2: parentId}]})
        .select('_id') // Selecting only learner IDs
        .lean(); // Converting Mongoose documents to plain JavaScript objects

      // Extract learner IDs from the result
      const learnerIds = learners.map(learner => learner._id);

      // Find enrollments where the learner ID is in the learnerIds array
      const enrollments = await Enrollment.find({learner: {$in: learnerIds}, session})
        .populate('school', 'name')
        .populate('learner')
        .populate('session')
        .populate('stream')
        .populate('originalsession')
        .lean(); // Converting Mongoose documents to plain JavaScript objects

      return enrollments;
    } catch (error) {
      console.error('Error fetching enrollments:', error);
      throw error;
    }
  }
  async createAndPublishIndicator({term, stream, indicator}) {
    try {
      console.log('error');
      // Create a new PublishedIndicators document
      const existingIndicator = await PublishedIndicators.findOne({
        term,
        stream,
        indicator,
      });

      if (existingIndicator) {
        return existingIndicator;
      }

      const newIndicator = new PublishedIndicators({
        term,
        stream,
        indicator,
        status: 'Unpublished',
      });

      // Save the new document
      const result = await newIndicator.save();

      return result;
    } catch (error) {
      console.error('Error creating and publishing indicator:', error);
      throw error;
    }
  }
  async unpublishIndicator(term, indicatorId) {
    try {
      const result = await PublishedIndicators.findOneAndUpdate(
        {indicator: indicatorId, term: term},
        {status: 'Unpublished'},
        {new: true, runValidators: true},
      );

      if (!result) {
        throw new Error('Indicator not found');
      }

      return result;
    } catch (error) {
      console.error('Error unpublishing indicator:', error);
      throw error;
    }
  }
  async publishIndicator(term, indicatorId) {
    try {
      const result = await PublishedIndicators.findOneAndUpdate(
        {indicator: indicatorId, term: term},
        {status: 'Published'},
        {new: true, runValidators: true},
      );

      if (!result) {
        throw new Error('Indicator not found');
      }

      return result;
    } catch (error) {
      console.error('Error unpublishing indicator:', error);
      throw error;
    }
  }
  async toggleIndicatorStatus(term, indicatorId) {
    try {
      // Find the indicator by ID and term
      const indicator = await PublishedIndicators.findOne({indicator: indicatorId, term: term});

      if (!indicator) {
        throw new Error('Indicator not found');
      }

      // Toggle the status
      const newStatus = indicator.status === 'Published' ? 'Unpublished' : 'Published';

      // Update the indicator with the new status
      const result = await PublishedIndicators.findOneAndUpdate(
        {indicator: indicatorId, term: term},
        {status: newStatus},
        {new: true, runValidators: true},
      );

      return result;
    } catch (error) {
      console.error('Error toggling indicator status:', error);
      throw error;
    }
  }
}

module.exports = EnrollmentService;
