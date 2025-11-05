const mongoose = require('mongoose');
const Enrollment = require('../../models/portal/content/Enrollment');
const SummativeAssessment = require('../../models/portal/content/SummativeAssessment');
const Test = require('../../models/portal/content/Test');

const assessmentGradingService = require('../../services/portal/AssessmentGradingService');
const PlScaleService = require('./PlScaleService');
const Stream = require('../../models/portal/content/Stream');
const {capitalizeFirstLetter, rank} = require('../../utils/helper');
const Learner = require('../../models/portal/content/Learner');
const PlScale = require('../../models/cms/content/plScale');

class SummativeAssessmentService {
  async getLearnersWithAssessmentStatus(school, stream, session, test, learning_area, adm_no) {
    try {
      const enrollment = await Enrollment.find({school, to_stream: stream, to_session: session}).populate('learner');
      // Find all enrollments for the specified criteria
      const learners_ids = enrollment.map(learner => learner.learner);
      const learnerQuery = {school, _id: {$in: learners_ids}, $or: [{status: 'D'}, {status: 'P'}]};
      if (adm_no) {
        const regex = new RegExp(adm_no.trim(), 'i'); // 'i' makes the regex case-insensitive
        learnerQuery.adm_no = regex;
      }
      // Find all learners for the specified criteria
      const learners = await Learner.find(learnerQuery).sort({first_name: 1});
      const testData = await Test.findById(test);
      // Find assessments for the specified term and indicator
      const assessments = await SummativeAssessment.find({test, learning_area, session}).populate('learner');
      // Create a map of learner IDs to their assessments
      const assessmentMap = await this.processAssessments(testData.grading, assessments);
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
      console.log(error);
      throw new Error(`Failed to retrieve learners with assessment status: ${error.message}`);
    }
  }
  async getLearnerAssessmentComparison(learner, term, session) {
    try {
      // Find all enrollments for the specified criteria
      // const enrollments = await Enrollment.findById(learner).populate('learner');
      // console.log(enrollments);

      // Extract learner IDs from the enrollments

      // Find assessments for the specified term and indicator
      // const assessments = await SummativeAssessment.aggregate([
      //   // Step 1: Match assessments for the specific learner and term
      //   {
      //     $match: {
      //       learner: new mongoose.Types.ObjectId(learner),
      //       term: term,
      //       session,
      //     },
      //   },
      //   // Step 2: Lookup to get test details
      //   {
      //     $lookup: {
      //       from: 'tests',
      //       localField: 'test',
      //       foreignField: '_id',
      //       as: 'test_info',
      //     },
      //   },
      //   {
      //     $unwind: '$test_info',
      //   },
      //   // Step 3: Lookup learning area details
      //   {
      //     $lookup: {
      //       from: 'learning_areas',
      //       localField: 'learning_area',
      //       foreignField: '_id',
      //       as: 'learning_area_info',
      //     },
      //   },
      //   {
      //     $unwind: '$learning_area_info',
      //   },
      //   // Step 4: Lookup grading criteria
      //   {
      //     $lookup: {
      //       from: 'plscales',
      //       localField: 'test_info.grading',
      //       foreignField: '_id',
      //       as: 'plscale_info',
      //     },
      //   },
      //   {
      //     $unwind: '$plscale_info',
      //   },
      //   // Step 5: Filter grading based on the learning area
      //   {
      //     $addFields: {
      //       grading: {
      //         $filter: {
      //           input: '$plscale_info.learningAreas',
      //           as: 'area',
      //           cond: {
      //             $eq: ['$$area.learning_area', '$learning_area'],
      //           },
      //         },
      //       },
      //     },
      //   },
      //   {
      //     $unwind: '$grading',
      //   },
      //   // Step 6: Find the first grading that meets the criteria (sorted by mark descending)
      //   {
      //     $addFields: {
      //       grading: {
      //         $arrayElemAt: [
      //           {
      //             $filter: {
      //               input: {
      //                 $sortArray: {
      //                   input: '$grading.gradings',
      //                   sortBy: {mark: -1},
      //                 },
      //               },
      //               as: 'grad',
      //               cond: {
      //                 $lte: ['$$grad.mark', '$score'],
      //               },
      //             },
      //           },
      //           0,
      //         ],
      //       },
      //     },
      //   },
      //   // Step 7: Group by learning area, including grading data
      //   {
      //     $group: {
      //       _id: '$learning_area_info.name',
      //       totalScore: {$sum: {$ifNull: ['$score', 0]}},
      //       averageScore: {$avg: {$ifNull: ['$score', 0]}},
      //       assessments: {
      //         $push: {
      //           test: '$test',
      //           testType: '$test_info.type',
      //           testName: '$test_info.name',
      //           score: {$ifNull: ['$score', '_']},
      //           gradingScore: {$ifNull: ['$grading.score', null]},
      //           description: {$ifNull: ['$grading.description', '']},
      //         },
      //       },
      //     },
      //   },
      //   // Step 8: Determine the maximum number of assessments
      //   {
      //     $group: {
      //       _id: null,
      //       maxAssessments: {$max: {$size: '$assessments'}},
      //       learningAreas: {
      //         $push: {
      //           learning_area: '$_id',
      //           totalScore: '$totalScore',
      //           averageScore: '$averageScore',
      //           assessments: '$assessments',
      //         },
      //       },
      //     },
      //   },
      //   // Step 9: Unwind learning areas to project the final output
      //   {
      //     $unwind: '$learningAreas',
      //   },
      //   // Step 10: Project final output fields and make assessments uniform
      //   {
      //     $project: {
      //       learning_area: '$learningAreas.learning_area',
      //       totalScore: '$learningAreas.totalScore',
      //       averageScore: '$learningAreas.averageScore',
      //       assessments: {
      //         $map: {
      //           input: {$range: [0, '$maxAssessments']}, // Create an array from 0 to maxAssessments
      //           as: 'index',
      //           in: {
      //             $cond: {
      //               if: {$lt: ['$$index', {$size: '$learningAreas.assessments'}]},
      //               then: {$arrayElemAt: ['$learningAreas.assessments', '$$index']},
      //               else: {test: null, score: null, gradingScore: null, description: ''}, // Placeholder
      //             },
      //           },
      //         },
      //       },
      //       _id: 0,
      //     },
      //   },
      // ]);
      const assessments = await SummativeAssessment.aggregate([
        // Match initial conditions
        {
          $match: {
            learner: new mongoose.Types.ObjectId(learner),
            term: term,
            session: session,
          },
        },
        // Lookup test info
        {
          $lookup: {
            from: 'tests',
            localField: 'test',
            foreignField: '_id',
            as: 'test_info',
          },
        },
        {$unwind: '$test_info'},
        // Validate testType
        {
          $addFields: {
            'test_info.type': {
              $cond: {
                if: {$and: [{$ne: ['$test_info.type', null]}, {$ne: ['$test_info.type', '']}]},
                then: '$test_info.type',
                else: 'Unknown',
              },
            },
          },
        },
        // Lookup learning area info
        {
          $lookup: {
            from: 'learning_areas',
            localField: 'learning_area',
            foreignField: '_id',
            as: 'learning_area_info',
          },
        },
        {$unwind: '$learning_area_info'},
        // Lookup grading scale info
        {
          $lookup: {
            from: 'plscales',
            localField: 'test_info.grading',
            foreignField: '_id',
            as: 'plscale_info',
          },
        },
        {$unwind: '$plscale_info'},
        // Filter grading for matching learning area
        {
          $addFields: {
            grading: {
              $filter: {
                input: '$plscale_info.learningAreas',
                as: 'area',
                cond: {$eq: ['$$area.learning_area', '$learning_area']},
              },
            },
          },
        },
        {$unwind: '$grading'},
        // Determine grading based on score
        {
          $addFields: {
            grading: {
              $arrayElemAt: [
                {
                  $filter: {
                    input: {$sortArray: {input: '$grading.gradings', sortBy: {mark: -1}}},
                    as: 'grad',
                    cond: {$lte: ['$$grad.mark', '$score']},
                  },
                },
                0,
              ],
            },
          },
        },
        // Group by learning area, preserving createdAt
        {
          $group: {
            _id: '$learning_area_info.name',
            totalScore: {$sum: {$ifNull: ['$score', 0]}},
            averageScore: {$avg: {$ifNull: ['$score', 0]}},
            assessments: {
              $push: {
                test: '$test',
                testType: '$test_info.type',
                testName: '$test_info.name',
                score: {$ifNull: ['$score', null]},
                gradingScore: {$ifNull: ['$grading.score', null]},
                description: {$ifNull: ['$grading.description', '']},
                createdAt: '$test_info.createdAt', // Preserve createdAt
              },
            },
          },
        },
        // Group to collect test types and their earliest createdAt
        {
          $group: {
            _id: null,
            maxAssessments: {$max: {$size: '$assessments'}},
            learningAreas: {
              $push: {
                learning_area: '$_id',
                totalScore: '$totalScore',
                averageScore: '$averageScore',
                assessments: '$assessments',
              },
            },
            testTypesWithCreatedAt: {
              $push: {
                $map: {
                  input: '$assessments',
                  as: 'assess',
                  in: {
                    testType: '$$assess.testType',
                    createdAt: '$$assess.createdAt',
                  },
                },
              },
            },
          },
        },
        // Project and sort test types by earliest createdAt
        {
          $project: {
            maxAssessments: 1,
            learningAreas: 1,
            allTestTypes: {
              $map: {
                input: {
                  $sortArray: {
                    input: {
                      $reduce: {
                        input: '$testTypesWithCreatedAt',
                        initialValue: [],
                        in: {$concatArrays: ['$$value', '$$this']},
                      },
                    },
                    sortBy: {createdAt: 1}, // Sort by earliest createdAt
                  },
                },
                as: 'item',
                in: '$$item.testType',
              },
            },
          },
        },
        // Remove duplicates from allTestTypes
        {
          $project: {
            maxAssessments: 1,
            learningAreas: 1,
            allTestTypes: {
              $reduce: {
                input: '$allTestTypes',
                initialValue: [],
                in: {
                  $cond: {
                    if: {$in: ['$$this', '$$value']},
                    then: '$$value',
                    else: {$concatArrays: ['$$value', ['$$this']]},
                  },
                },
              },
            },
          },
        },
        // Unwind learning areas
        {$unwind: '$learningAreas'},
        // Project final fields with aligned assessments
        {
          $project: {
            learning_area: '$learningAreas.learning_area',
            totalScore: '$learningAreas.totalScore',
            averageScore: '$learningAreas.averageScore',
            assessments: {
              $map: {
                input: '$allTestTypes',
                as: 'testType',
                in: {
                  $let: {
                    vars: {
                      matchingAssessment: {
                        $arrayElemAt: [
                          {
                            $filter: {
                              input: '$learningAreas.assessments',
                              as: 'assess',
                              cond: {$eq: ['$$assess.testType', '$$testType']},
                            },
                          },
                          0,
                        ],
                      },
                    },
                    in: {
                      testType: '$$testType',
                      test: {$ifNull: ['$$matchingAssessment.test', null]},
                      testName: {$ifNull: ['$$matchingAssessment.testName', null]},
                      score: {$ifNull: ['$$matchingAssessment.score', null]},
                      gradingScore: {$ifNull: ['$$matchingAssessment.gradingScore', null]},
                      description: {$ifNull: ['$$matchingAssessment.description', '']},
                      createdAt: {$ifNull: ['$$matchingAssessment.createdAt', null]},
                    },
                  },
                },
              },
            },
            allTestTypes: 1,
            _id: 0,
          },
        },
        // Sort by learning area name
        {
          $sort: {
            learning_area: 1,
          },
        },
      ]);
      // const assessments = await SummativeAssessment.aggregate([
      //   // Match initial conditions
      //   {
      //     $match: {
      //       learner: new mongoose.Types.ObjectId(learner),
      //       term: term,
      //       session,
      //     },
      //   },
      //   // Lookup test info
      //   {
      //     $lookup: {
      //       from: 'tests',
      //       localField: 'test',
      //       foreignField: '_id',
      //       as: 'test_info',
      //     },
      //   },
      //   {$unwind: '$test_info'},
      //   // Lookup learning area info
      //   {
      //     $lookup: {
      //       from: 'learning_areas',
      //       localField: 'learning_area',
      //       foreignField: '_id',
      //       as: 'learning_area_info',
      //     },
      //   },
      //   {$unwind: '$learning_area_info'},
      //   // Lookup grading scale info
      //   {
      //     $lookup: {
      //       from: 'plscales',
      //       localField: 'test_info.grading',
      //       foreignField: '_id',
      //       as: 'plscale_info',
      //     },
      //   },
      //   {$unwind: '$plscale_info'},
      //   // Filter grading for matching learning area
      //   {
      //     $addFields: {
      //       grading: {
      //         $filter: {
      //           input: '$plscale_info.learningAreas',
      //           as: 'area',
      //           cond: {$eq: ['$$area.learning_area', '$learning_area']},
      //         },
      //       },
      //     },
      //   },
      //   {$unwind: '$grading'},
      //   // Determine grading based on score
      //   {
      //     $addFields: {
      //       grading: {
      //         $arrayElemAt: [
      //           {
      //             $filter: {
      //               input: {$sortArray: {input: '$grading.gradings', sortBy: {mark: -1}}},
      //               as: 'grad',
      //               cond: {$lte: ['$$grad.mark', '$score']},
      //             },
      //           },
      //           0,
      //         ],
      //       },
      //     },
      //   },
      //   // NEW: Sort by test creation date before grouping
      //   {
      //     $sort: {
      //       'test_info.createdAt': -1, // Ascending order; use -1 for descending
      //     },
      //   },
      //   // Group by learning area
      //   {
      //     $group: {
      //       _id: '$learning_area_info.name',
      //       totalScore: {$sum: {$ifNull: ['$score', 0]}},
      //       averageScore: {$avg: {$ifNull: ['$score', 0]}},
      //       assessments: {
      //         $push: {
      //           test: '$test',
      //           testType: '$test_info.type',
      //           testName: '$test_info.name',
      //           score: {$ifNull: ['$score', '_']},
      //           gradingScore: {$ifNull: ['$grading.score', null]},
      //           description: {$ifNull: ['$grading.description', '']},
      //         },
      //       },
      //     },
      //   },
      //   // Group to collect test types and learning areas
      //   {
      //     $group: {
      //       _id: null,
      //       maxAssessments: {$max: {$size: '$assessments'}},
      //       learningAreas: {
      //         $push: {
      //           learning_area: '$_id',
      //           totalScore: '$totalScore',
      //           averageScore: '$averageScore',
      //           assessments: '$assessments',
      //         },
      //       },
      //       allTestTypes: {
      //         $addToSet: {
      //           $reduce: {
      //             input: '$assessments.testType',
      //             initialValue: [],
      //             in: {$concatArrays: ['$$value', {$cond: [{$isArray: '$$this'}, '$$this', ['$$this']]}]},
      //           },
      //         },
      //       },
      //     },
      //   },
      //   // Project and flatten test types
      //   {
      //     $project: {
      //       maxAssessments: 1,
      //       learningAreas: 1,
      //       allTestTypes: {
      //         $reduce: {
      //           input: '$allTestTypes',
      //           initialValue: [],
      //           in: {$setUnion: ['$$value', '$$this']},
      //         },
      //       },
      //     },
      //   },
      //   // Unwind learning areas
      //   {$unwind: '$learningAreas'},
      //   // Project final fields
      //   {
      //     $project: {
      //       learning_area: '$learningAreas.learning_area',
      //       totalScore: '$learningAreas.totalScore',
      //       averageScore: '$learningAreas.averageScore',
      //       assessments: {
      //         $map: {
      //           input: {$range: [0, '$maxAssessments']},
      //           as: 'index',
      //           in: {
      //             $cond: {
      //               if: {$lt: ['$$index', {$size: '$learningAreas.assessments'}]},
      //               then: {$arrayElemAt: ['$learningAreas.assessments', '$$index']},
      //               else: {test: null, score: null, gradingScore: null, description: ''},
      //             },
      //           },
      //         },
      //       },
      //       allTestTypes: 1,
      //       _id: 0,
      //     },
      //   },
      //   // NEW: Sort by learning area name
      //   {
      //     $sort: {
      //       learning_area: 1, // Ascending order; use -1 for descending
      //     },
      //   },
      // ]);
      // console.log(JSON.stringify(assessments));

      // Create a map of learner IDs to their assessments
      // const assessmentMap = await this.processAssessmentsForSingleLearner(testData.grading, assessments);
      // console.log(assessmentMap);
      // Build the result array with assessment status and details
      return assessments;
    } catch (error) {
      console.log(error);
      throw new Error(`Failed to retrieve learners with assessment status: ${error.message}`);
    }
  }
  // async calculatePositions(testId, learnerId, session, streamId = null, gradeId = null) {
  //   try {
  //     // Fetch all assessments for the same test, session, and either stream or grade
  //     const query = {
  //       test: testId,
  //       session: session,
  //     };
  //     if (streamId) query.stream = streamId;
  //     if (gradeId) query.grade = gradeId;

  //     const allAssessments = await SummativeAssessment.find(query)
  //       .populate('learning_area learner stream grade')
  //       .lean(); // Use lean() for better performance

  //     // Group assessments by learning area
  //     const learningAreaScores = {};
  //     allAssessments.forEach(assessment => {
  //       const learningAreaId = assessment.learning_area._id.toString();
  //       if (!learningAreaScores[learningAreaId]) {
  //         learningAreaScores[learningAreaId] = [];
  //       }
  //       learningAreaScores[learningAreaId].push({
  //         learnerId: assessment.learner._id.toString(),
  //         score: assessment.score,
  //         learningArea: assessment.learning_area.name,
  //       });
  //     });

  //     // Calculate ranks for each learning area
  //     const positions = {};
  //     for (const [learningAreaId, scores] of Object.entries(learningAreaScores)) {
  //       // Sort scores in descending order
  //       const sortedScores = scores.sort((a, b) => b.score - a.score);
  //       // Find the learner's rank (1-based, higher score = lower rank)
  //       const learnerRank = sortedScores.findIndex(score => score.learnerId === learnerId.toString()) + 1;
  //       positions[learningAreaId] = learnerRank || null; // Null if learner not found
  //     }

  //     return positions;
  //   } catch (error) {
  //     console.error('Error calculating positions:', error);
  //     throw error;
  //   }
  // }
  // async calculatePositions(testId, learnerId, session, streamId = null, gradeId = null) {
  //   try {
  //     // Fetch all assessments for the same test, session, and either stream or grade
  //     const query = {test: testId, session: session};
  //     if (streamId) query.stream = streamId;
  //     if (gradeId) query.grade = gradeId;

  //     const allAssessments = await SummativeAssessment.find(query)
  //       .populate('learning_area learner stream grade')
  //       .lean(); // Use lean() for better performance

  //     // Group assessments by learning area
  //     const learningAreaScores = {};
  //     allAssessments.forEach(assessment => {
  //       const learningAreaId = assessment.learning_area._id.toString();
  //       if (!learningAreaScores[learningAreaId]) {
  //         learningAreaScores[learningAreaId] = [];
  //       }
  //       learningAreaScores[learningAreaId].push({
  //         learnerId: assessment.learner._id.toString(),
  //         score: assessment.score,
  //         learningArea: assessment.learning_area.name,
  //       });
  //     });

  //     // Calculate ranks for each learning area
  //     const positions = {};
  //     for (const [learningAreaId, scores] of Object.entries(learningAreaScores)) {
  //       // Sort scores in descending order
  //       const sortedScores = scores.sort((a, b) => b.score - a.score);

  //       let rank = 0;
  //       let prevScore = null;
  //       let position = 0;

  //       const rankings = {};
  //       sortedScores.forEach((entry, index) => {
  //         if (entry.score !== prevScore) {
  //           position = index + 1; // Assign new rank
  //         }
  //         rankings[entry.learnerId] = position; // Store rank
  //         prevScore = entry.score;
  //       });

  //       // Get learner's rank if they exist in the rankings
  //       positions[learningAreaId] = rankings[learnerId.toString()] || null;
  //     }

  //     return positions;
  //   } catch (error) {
  //     console.error('Error calculating positions:', error);
  //     throw error;
  //   }
  // }
  async getLearnerAssessment(learner, test, session) {
    try {
      // console.time('getLearnerAssessment'); // Start timing
      console.log(test);
      // Fetch test data and grading scale concurrently
      const [testData, scale] = await Promise.all([
        Test.findById(test).lean(), // Use lean() for performance
        PlScale.findOne({_id: test.grading}).populate('learningAreas.learning_area').lean(),
      ]);

      if (!testData) throw new Error('Test not found');
      if (!scale) throw new Error('Grading scale not found');

      // Fetch all assessments for the test and session once
      const allAssessments = await SummativeAssessment.find({test, session})
        .populate('learning_area learner stream grade')
        .lean();
      // Filter assessments for this learner
      const learnerAssessments = allAssessments.filter(a => a.learner._id.toString() === learner._id.toString());

      // Calculate positions using the same assessment data
      const positions = await this.calculatePositions(
        test,
        learner._id,
        session,
        learner.stream._id,
        learner.grade._id,
        allAssessments,
      );

      // console.timeEnd('calculatePositions');

      // Process assessments with pre-fetched scale
      const assessmentMap = await this.processAssessmentsForSingleLearner(scale, learnerAssessments, positions);

      return {testData, assessments: assessmentMap};
    } catch (error) {
      console.error(error);
      throw new Error(`Failed to retrieve learners with assessment status: ${error.message}`);
    }
  }

  async calculatePositions(testId, learnerId, session, streamId = null, gradeId = null, allAssessments) {
    try {
      console.log(gradeId, streamId);
      // Filter assessments by stream or grade if provided
      const filteredAssessments = allAssessments.filter(assessment => {
        return (
          (!streamId || assessment.stream?._id.toString() === streamId.toString()) &&
          (!gradeId || assessment.grade?._id.toString() === gradeId.toString())
        );
      });

      // Group assessments by learning area
      const learningAreaScores = {};
      filteredAssessments.forEach(assessment => {
        const learningAreaId = assessment.learning_area._id.toString();
        if (!learningAreaScores[learningAreaId]) {
          learningAreaScores[learningAreaId] = [];
        }
        learningAreaScores[learningAreaId].push({
          learnerId: assessment.learner._id.toString(),
          score: assessment.score,
        });
      });

      // Calculate positions
      const positions = {};
      for (const [learningAreaId, scores] of Object.entries(learningAreaScores)) {
        const sortedScores = scores.sort((a, b) => b.score - a.score);
        let position = 0;
        let prevScore = null;

        const rankings = {};
        sortedScores.forEach((entry, index) => {
          if (entry.score !== prevScore) position = index + 1;
          rankings[entry.learnerId] = position;
          prevScore = entry.score;
        });

        positions[learningAreaId] = rankings[learnerId.toString()] || null;
      }
      return positions;
    } catch (error) {
      console.error('Error calculating positions:', error);
      throw error;
    }
  }
  rankSwahili(score) {
    switch (score) {
      case 4:
        return 'Kuzidisha Matarajio'; // Exceeding Expectation
      case 3:
        return 'Kufikia Matarajio'; // Meeting Expectation
      case 2:
        return 'Kukaribia Matarajio'; // Approaching Expectation
      case 1:
        return 'Mbali na Matarajio'; // Below Expectation
      case 0:
        return 'Hajahudhuria'; // Assessment not done
      default:
        return 'Haijulikani'; // Unknown
    }
  }

  async processAssessmentsForSingleLearner(scale, assessments, positions) {
    const processedAssessments = await Promise.all(
      assessments.map(async assessment => {
        try {
          const isSwahili = /kiswahili/i.test(assessment.learning_area?.name);

          const grading = this.gradeScoreSync(assessment.score, assessment.learning_area._id, scale);
          const personalized_description = grading
            ? `<b>${!isSwahili ? rank(grading.score) : this.rankSwahili(grading.score)}(${
                grading.score
              })</b>: ${grading.description.replace(
                '{{learner}}',
                capitalizeFirstLetter(assessment.learner.first_name),
              )}`
            : `Asessment Not Done`;

          return {
            ...assessment,
            grading_score: grading?.score,
            description: personalized_description,
            position: positions[assessment.learning_area._id.toString()],
          };
        } catch (error) {
          console.error(`Error processing assessment for learner:`, error);
          return {
            ...assessment,
            description: `${assessment.score} Not graded: ${error.message}`,
          };
        }
      }),
    );

    return processedAssessments;
  }

  // Synchronous grading function (no DB query)
  gradeScoreSync(score, learningAreaId, scale) {
    for (const learningArea of scale.learningAreas) {
      if (learningArea.learning_area._id.toString() === learningAreaId.toString()) {
        const sortedGradings = learningArea.gradings.sort((a, b) => b.score - a.score);
        for (const grading of sortedGradings) {
          if (score >= grading.mark) return grading;
        }
      }
    }
    return null; // Return null instead of string to simplify logic
  }

  // async getLearnerAssessment(learner, test, session) {
  //   try {
  //     // console.log(test);
  //     // Find all enrollments for the specified criteria
  //     // const enrollments = await Enrollment.findById(learner).populate('learner');
  //     // console.log(enrollments);

  //     // Extract learner IDs from the enrollments

  //     const testData = await Test.findById(test);
  //     if (!testData) {
  //       throw new Error(`Test not found`);
  //     }
  //     // Find assessments for the specified term and indicator
  //     const assessments = await SummativeAssessment.find({
  //       test,
  //       learner: learner._id,
  //       session,
  //       // $or: [{status: 'D'}, {status: 'P'}],
  //     }).populate('test  learning_area learner');
  //     const positions = await this.calculatePositions(test, learner._id, session, learner.stream, learner.grade);
  //     // Merge positions into learner data
  //     // const finalData = {
  //     //   ...learnerData,
  //     //   positions: positions,
  //     // };
  //     // Create a map of learner IDs to their assessments
  //     const assessmentMap = await this.processAssessmentsForSingleLearner(testData.grading, assessments, positions);
  //     // console.log(assessmentMap);
  //     // Build the result array with assessment status and details
  //     return {testData, assessments: assessmentMap};
  //   } catch (error) {
  //     console.log(error);
  //     throw new Error(`Failed to retrieve learners with assessment status: ${error.message}`);
  //   }
  // }
  async processAssessments(scaleId, assessments) {
    const assessmentMap = {};

    for (const assessment of assessments) {
      const learnerId = assessment?.learner?._id?.toString();

      if (learnerId) {
        try {
          // console.log({
          //   learning_area: assessment.learning_area,
          //   score: assessment.score,
          // });
          const grading = await PlScaleService.gradeScore(assessment.score, assessment.learning_area, scaleId);

          const personalized_description = grading
            ? `${grading?.description?.replace('{{learner}}', capitalizeFirstLetter(assessment?.learner.first_name))}`
            : `${capitalizeFirstLetter(assessment?.learner.first_name)} Not graded yet`;

          assessmentMap[learnerId] = {
            ...assessment.toObject(),
            description: personalized_description,
            grading_score: grading.score,
          };
        } catch (error) {
          console.error(`Error processing assessment for learner ${learnerId}:`, error);
          assessmentMap[learnerId] = {
            ...assessment.toObject(),
            description: `Not graded` + error.message,
            grading_score: 0,
          };
        }
      }
    }
    //ss
    return assessmentMap;
  }
  // async processAssessmentsForSingleLearner(scaleId, assessments, positions) {
  //   const processedAssessments = [];

  //   for (const assessment of assessments) {
  //     try {
  //       const grading = await PlScaleService.gradeScore(assessment.score, assessment.learning_area._id, scaleId);

  //       const personalized_description = grading
  //         ? `<b>${rank(grading.score)}(${grading.score})</b>: ${grading?.description?.replace(
  //             '{{learner}}',
  //             capitalizeFirstLetter(assessment?.learner?.first_name),
  //           )}`
  //         : `${assessment.score} Not graded yet`;
  //       // console.log('pos', assessment.learning_area._id.toString());

  //       // console.log('pos', positions[assessment.learning_area._id.toString()]);
  //       // console.log('pos', assessment.learning_area._id.toString);
  //       // Add the processed assessment to the array
  //       processedAssessments.push({
  //         ...assessment,
  //         grading_score: grading.score,
  //         description: personalized_description,
  //         position: positions[assessment.learning_area._id.toString()],
  //       });
  //     } catch (error) {
  //       console.error(`Error processing assessment for learner :`, error);

  //       // Add the processed assessment with error description to the array
  //       processedAssessments.push({
  //         ...assessment.toObject(),
  //         description: `${assessment.score} Not graded` + error.message,
  //       });
  //     }
  //   }
  //   return processedAssessments;
  // }

  // async generateBroadsheet(school, grade, stream, term, test, session) {
  //   try {
  //     console.log({school, grade, stream, term, test, session});

  //     const testId = new mongoose.Types.ObjectId(test);
  //     const streamId = stream ? new mongoose.Types.ObjectId(stream) : null;
  //     let matchStage = {};

  //     if (!grade) {
  //       if (!stream) throw new Error('Stream is required if grade is not provided');
  //       matchStage = {
  //         test: testId,
  //         term: term,
  //         stream: streamId,
  //       };
  //     } else {
  //       const streams = await Stream.find({school, grade});
  //       const streamIds = streams.map(s => s._id);
  //       matchStage = {
  //         test: testId,
  //         stream: {$in: streamIds},
  //         term: term,
  //         session,
  //       };
  //       console.log(matchStage);
  //     }
  //     const learnerPipeline = [
  //       {
  //         $lookup: {
  //           from: 'learners',
  //           localField: 'learner',
  //           foreignField: '_id',
  //           as: 'learnerInfo',
  //         },
  //       },
  //       {$unwind: {path: '$learnerInfo', preserveNullAndEmptyArrays: true}},
  //       {
  //         $lookup: {
  //           from: 'streams',
  //           localField: 'learnerInfo.stream',
  //           foreignField: '_id',
  //           as: 'streamInfo',
  //         },
  //       },
  //       {$unwind: {path: '$streamInfo', preserveNullAndEmptyArrays: true}},
  //       {
  //         $lookup: {
  //           from: 'learning_areas',
  //           localField: 'learning_area',
  //           foreignField: '_id',
  //           as: 'learningAreaInfo',
  //         },
  //       },
  //       {$unwind: {path: '$learningAreaInfo', preserveNullAndEmptyArrays: true}},
  //       {
  //         $lookup: {
  //           from: 'tests',
  //           localField: 'test',
  //           foreignField: '_id',
  //           as: 'testInfo',
  //         },
  //       },
  //       {$unwind: {path: '$testInfo', preserveNullAndEmptyArrays: true}},
  //       {
  //         $match: matchStage,
  //       },
  //       {
  //         $group: {
  //           _id: {
  //             learner: '$learnerInfo',
  //             stream: '$streamInfo.name',
  //             learning_area: '$learningAreaInfo.short_name',
  //           },
  //           score: {$first: '$score'},
  //         },
  //       },
  //       {
  //         $group: {
  //           _id: {
  //             learner: '$_id.learner',
  //             stream: '$_id.stream',
  //           },
  //           assessments: {
  //             $push: {
  //               learning_area: '$_id.learning_area',
  //               score: {$ifNull: ['$score', 0]},
  //             },
  //           },
  //           totalScore: {$sum: '$score'},
  //           averageScore: {$avg: '$score'},
  //         },
  //       },
  //       {
  //         $project: {
  //           _id: 0,
  //           learner: '$_id.learner',
  //           stream: '$_id.stream',
  //           assessments: {
  //             $arrayToObject: {
  //               $map: {
  //                 input: {
  //                   $filter: {
  //                     input: '$assessments',
  //                     cond: {
  //                       $and: [
  //                         {$ne: ['$$this.learning_area', null]},
  //                         {$ne: ['$$this.learning_area', undefined]},
  //                         {$ne: ['$$this.learning_area', '']},
  //                         {$ne: ['$$this.score', null]},
  //                         {$ne: ['$$this.score', undefined]},
  //                         {$gt: [{$type: '$$this.score'}, 'null']},
  //                       ],
  //                     },
  //                   },
  //                 },
  //                 as: 'item',
  //                 in: {
  //                   k: {$ifNull: ['$$item.learning_area', 'unknown']},
  //                   v: {$ifNull: ['$$item.score', 0]},
  //                 },
  //               },
  //             },
  //           },
  //           totalScore: 1,
  //           averageScore: {$round: ['$averageScore', 1]},
  //         },
  //       },
  //       {$sort: {averageScore: -1}},
  //       {
  //         $setWindowFields: {
  //           sortBy: {averageScore: -1},
  //           output: {rank: {$rank: {}}},
  //         },
  //       },
  //     ];

  //     const learningAreaPipeline = [
  //       {$lookup: {from: 'learners', localField: 'learner', foreignField: '_id', as: 'learnerInfo'}},
  //       {$unwind: {path: '$learnerInfo', preserveNullAndEmptyArrays: true}},
  //       {$lookup: {from: 'streams', localField: 'learnerInfo.stream', foreignField: '_id', as: 'streamInfo'}},
  //       {$unwind: {path: '$streamInfo', preserveNullAndEmptyArrays: true}},
  //       {$lookup: {from: 'learning_areas', localField: 'learning_area', foreignField: '_id', as: 'learningAreaInfo'}},
  //       {$unwind: {path: '$learningAreaInfo', preserveNullAndEmptyArrays: true}},
  //       {$lookup: {from: 'tests', localField: 'test', foreignField: '_id', as: 'testInfo'}},
  //       {$unwind: {path: '$testInfo', preserveNullAndEmptyArrays: true}},
  //       {$match: matchStage},
  //       {
  //         $group: {
  //           _id: '$learningAreaInfo.short_name',
  //           averageScore: {$avg: '$score'},
  //           totalScore: {$sum: '$score'},
  //           count: {$sum: 1},
  //         },
  //       },
  //       {
  //         $project: {
  //           _id: 0,
  //           learning_area: '$_id',
  //           averageScore: {$round: ['$averageScore', 1]},
  //           totalScore: 1,
  //           count: 1,
  //         },
  //       },
  //       {$sort: {learning_area: 1}},
  //     ];

  //     const subjectRankPipeline = [
  //       {$lookup: {from: 'learners', localField: 'learner', foreignField: '_id', as: 'learnerInfo'}},
  //       {$unwind: {path: '$learnerInfo', preserveNullAndEmptyArrays: true}},
  //       {$lookup: {from: 'streams', localField: 'learnerInfo.stream', foreignField: '_id', as: 'streamInfo'}},
  //       {$unwind: {path: '$streamInfo', preserveNullAndEmptyArrays: true}},
  //       {$lookup: {from: 'learning_areas', localField: 'learning_area', foreignField: '_id', as: 'learningAreaInfo'}},
  //       {$unwind: {path: '$learningAreaInfo', preserveNullAndEmptyArrays: true}},
  //       {$lookup: {from: 'tests', localField: 'test', foreignField: '_id', as: 'testInfo'}},
  //       {$unwind: {path: '$testInfo', preserveNullAndEmptyArrays: true}},
  //       {$match: matchStage},
  //       {
  //         $group: {
  //           _id: {
  //             learnerId: '$learnerInfo._id',
  //             learning_area: '$learningAreaInfo.short_name',
  //           },
  //           score: {$first: '$score'},
  //         },
  //       },
  //       {$sort: {'_id.learning_area': 1, score: -1}},
  //       {
  //         $setWindowFields: {
  //           partitionBy: '$_id.learning_area',
  //           sortBy: {score: -1},
  //           output: {subjectRank: {$rank: {}}},
  //         },
  //       },
  //       {
  //         $project: {
  //           _id: 0,
  //           learnerId: '$_id.learnerId',
  //           learning_area: '$_id.learning_area',
  //           score: 1,
  //           subjectRank: 1,
  //         },
  //       },
  //     ];

  //     const [learnerResults, learningAreaAverages, subjectRanks] = await Promise.all([
  //       SummativeAssessment.aggregate(learnerPipeline),
  //       SummativeAssessment.aggregate(learningAreaPipeline),
  //       SummativeAssessment.aggregate(subjectRankPipeline),
  //     ]);

  //     // console.log('Learner Results:', JSON.stringify(learnerResults, null, 2));
  //     // console.log('Learning Area Averages:', JSON.stringify(learningAreaAverages, null, 2));
  //     // console.log('Subject Ranks:', JSON.stringify(subjectRanks, null, 2));

  //     const learnerResultsWithRanks = learnerResults.map(learner => {
  //       const learnerId = learner.learner?._id?.toString();
  //       const subjectRankMap = {};
  //       subjectRanks
  //         .filter(rank => rank.learnerId?.toString() === learnerId)
  //         .forEach(rank => {
  //           subjectRankMap[rank.learning_area] = rank.subjectRank;
  //         });

  //       const updatedAssessments = {};
  //       for (const [subject, score] of Object.entries(learner.assessments || {})) {
  //         updatedAssessments[subject] = {
  //           score: Number(score),
  //           rank: subjectRankMap[subject] || null,
  //         };
  //       }

  //       return {
  //         ...learner,
  //         assessments: updatedAssessments,
  //       };
  //     });

  //     const result = {
  //       broadsheet: learnerResultsWithRanks,
  //       learningAreaSummary: learningAreaAverages,
  //     };

  //     //console.log('Final Result:', JSON.stringify(result, null, 2));
  //     return result;
  //   } catch (error) {
  //     console.error('Error generating broadsheet:', error);
  //     throw error;
  //   }
  // }
  async generateBroadsheet(school, grade, stream, term, test, session) {
    try {
      console.log({school, grade, stream, term, test, session});

      const testId = new mongoose.Types.ObjectId(test);
      const streamId = new mongoose.Types.ObjectId(stream);
      let matchStage = {};
      if (!grade) {
        matchStage = {
          test: testId,
          term: term,
          stream: streamId,
        };
      } else {
        const streams = await Stream.find({school, grade});
        const stream_ids = streams.map(stream => stream._id);
        matchStage = {
          test: testId,
          stream: {$in: stream_ids},
          term: term,
          session,
        };
      }

      // Common lookup stages for both pipelines
      const commonLookups = [
        {
          $lookup: {
            from: 'learners',
            localField: 'learner',
            foreignField: '_id',
            as: 'learnerInfo',
          },
        },
        {$unwind: '$learnerInfo'},
        {
          $lookup: {
            from: 'streams',
            localField: 'learnerInfo.stream',
            foreignField: '_id',
            as: 'streamInfo',
          },
        },
        {$unwind: '$streamInfo'},
        {
          $lookup: {
            from: 'learning_areas',
            localField: 'learning_area',
            foreignField: '_id',
            as: 'learningAreaInfo',
          },
        },
        {$unwind: '$learningAreaInfo'},
        {
          $lookup: {
            from: 'tests',
            localField: 'test',
            foreignField: '_id',
            as: 'testInfo',
          },
        },
        {$unwind: '$testInfo'},
        {$match: matchStage},
      ];

      // Pipeline for learner-based broadsheet
      const learnerPipeline = [
        ...commonLookups,
        {
          $group: {
            _id: {
              learner: '$learnerInfo',
              stream: '$streamInfo.name',
              learning_area: '$learningAreaInfo.short_name',
            },
            score: {$first: '$score'},
          },
        },
        {
          $group: {
            _id: {
              learner: '$_id.learner',
              stream: '$_id.stream',
            },
            assessments: {
              $push: {
                learning_area: '$_id.learning_area',
                score: '$score',
              },
            },
            totalScore: {$sum: '$score'},
            averageScore: {$avg: '$score'},
          },
        },
        {
          $project: {
            _id: 0,
            learner: '$_id.learner',
            stream: '$_id.stream',
            assessments: {
              $arrayToObject: {
                $map: {
                  input: '$assessments',
                  as: 'item',
                  in: {
                    k: {$ifNull: ['$$item.learning_area', 'Unknown']},
                    v: {$ifNull: ['$$item.score', 0]},
                  },
                },
              },
            },
            totalScore: 1,
            averageScore: {$round: ['$averageScore', 1]},
          },
        },
        {$sort: {averageScore: -1}},
        {
          $setWindowFields: {
            sortBy: {averageScore: -1},
            output: {rank: {$rank: {}}},
          },
        },
      ];

      // Pipeline for learning area averages with overall position
      const areaPipeline = [
        ...commonLookups,
        // Filter out learners who scored 0 (absent)
        {
          $match: {
            score: {$gt: 0}
          }
        },
        {
          $group: {
            _id: '$learningAreaInfo.short_name',
            totalScore: {$sum: '$score'},
            averageScore: {$avg: '$score'},
            numberOfScores: {$sum: 1},
          },
        },
        {
          $project: {
            _id: 0,
            learning_area: '$_id',
            totalScore: 1,
            averageScore: {$round: ['$averageScore', 1]},
            numberOfScores: 1,
          },
        },
        {$sort: {averageScore: -1}},
        {
          $setWindowFields: {
            sortBy: {averageScore: -1},
            output: {
              position: {$rank: {}},
            },
          },
        },
      ];

      // Run both aggregations in parallel
      const [learnerResults, areaResults] = await Promise.all([
        SummativeAssessment.aggregate(learnerPipeline),
        SummativeAssessment.aggregate(areaPipeline),
      ]);

      console.log('Learner Results:', learnerResults);
      console.log('Area Averages with Positions:', areaResults);

      // Return combined results
      return {
        data: learnerResults,
        learningAreaStats: areaResults,
      };
    } catch (error) {
      console.error('Error generating broadsheet:', error);
      throw error;
    }
  }
  // async generateBroadsheet(school, grade, stream, term, test, session) {
  //   try {
  //     console.log({school, grade, stream, term, test, session});
  //     // const gradeId = new mongoose.Types.ObjectId(grade);

  //     const testId = new mongoose.Types.ObjectId(test);
  //     const streamId = new mongoose.Types.ObjectId(stream);
  //     let matchStage = {};
  //     if (!grade) {
  //       matchStage = {
  //         test: testId,
  //         term: term,
  //         stream: streamId,
  //         // $or: [{status: 'D'}, {status: 'P'}],
  //         // score: {$gt: 0},
  //       };
  //     } else {
  //       const streams = await Stream.find({school, grade});
  //       const steam_ids = streams.map(stream => stream._id);
  //       matchStage = {
  //         test: testId,
  //         stream: {$in: steam_ids},
  //         term: term,
  //         session,
  //       };
  //     }

  //     const pipeline = [
  //       // Lookup enrollment information
  //       {
  //         $lookup: {
  //           from: 'learners',
  //           localField: 'learner',
  //           foreignField: '_id',
  //           as: 'learnerInfo',
  //         },
  //       },
  //       {$unwind: '$learnerInfo'},

  //       // Lookup stream information from enrollment
  //       {
  //         $lookup: {
  //           from: 'streams',
  //           localField: 'learnerInfo.stream',
  //           foreignField: '_id',
  //           as: 'streamInfo',
  //         },
  //       },
  //       {$unwind: '$streamInfo'},

  //       // Lookup learning area information
  //       {
  //         $lookup: {
  //           from: 'learning_areas',
  //           localField: 'learning_area',
  //           foreignField: '_id',
  //           as: 'learningAreaInfo',
  //         },
  //       },
  //       {$unwind: '$learningAreaInfo'},

  //       // Lookup test information
  //       {
  //         $lookup: {
  //           from: 'tests',
  //           localField: 'test',
  //           foreignField: '_id',
  //           as: 'testInfo',
  //         },
  //       },
  //       {$unwind: '$testInfo'},

  //       // Filter by test ID (specified test)
  //       {$match: matchStage},

  //       // Group by learner and learning area
  //       {
  //         $group: {
  //           _id: {
  //             learner: '$learnerInfo',
  //             stream: '$streamInfo.name',
  //             learning_area: '$learningAreaInfo.short_name',
  //           },
  //           score: {$first: '$score'},
  //         },
  //       },

  //       // Group by learner to accumulate assessments and calculate total & average score
  //       {
  //         $group: {
  //           _id: {
  //             learner: '$_id.learner',
  //             stream: '$_id.stream',
  //           },
  //           assessments: {
  //             $push: {
  //               learning_area: '$_id.learning_area',
  //               score: '$score',
  //             },
  //           },
  //           totalScore: {$sum: '$score'},
  //           averageScore: {$avg: '$score'},
  //         },
  //       },

  //       // Restructure the output to include learner, assessments, totalScore, and rounded averageScore
  //       {
  //         $project: {
  //           _id: 0,
  //           learner: '$_id.learner',
  //           stream: '$_id.stream',
  //           assessments: {
  //             $arrayToObject: {
  //               $map: {
  //                 input: '$assessments',
  //                 as: 'item',
  //                 in: {
  //                   k: {$ifNull: ['$$item.learning_area', 'Unknown']}, // Fallback for missing learning_area
  //                   v: {$ifNull: ['$$item.score', 0]}, // Fallback for missing score
  //                 },
  //               },
  //             },
  //           },
  //           totalScore: 1,
  //           averageScore: {$round: ['$averageScore', 1]},
  //         },
  //       },

  //       // Sort by averageScore in descending order (best to least)
  //       {
  //         $sort: {averageScore: -1},
  //       },

  //       // Add rank field using setWindowFields
  //       {
  //         $setWindowFields: {
  //           sortBy: {averageScore: -1},
  //           output: {
  //             rank: {$rank: {}},
  //           },
  //         },
  //       },
  //     ];
  //     // Run the aggregation
  //     const result = await SummativeAssessment.aggregate(pipeline);
  //     console.log(result);
  //     return result;
  //   } catch (error) {
  //     console.error('Error generating broadsheet:', error);
  //     throw error;
  //   }
  // }
  async analyzePerformance(grade, stream, term, test, school, session) {
    try {
      const testId = new mongoose.Types.ObjectId(test);
      const streamId = new mongoose.Types.ObjectId(stream);
      // let query = {$or: [{status: 'D'}, {status: 'P'}]};
      // Find all enrollments for the specified criteria
      // const learners_ids = enrollment.map(learner => learner.learner);
      // let query = {school, _id: {$in: learners_ids}};
      let enrollment = [];
      if (grade) {
        const stream = await Stream.find({grade, school: school}).select('_id');
        enrollment = await Enrollment.find({school, to_stream: {$in: stream}, to_session: session}).populate('learner');

        // query = {...query, stream: {$in: stream.map(stream => stream._id)}, school: school};
      } else {
        enrollment = await Enrollment.find({school, to_stream: stream, to_session: session}).populate('learner');
      }
      // console.log(query);
      // const learners = await Learner.find(query).select('_id');
      const learners = enrollment.map(enrollment => enrollment.learner);
      if (learners.length === 0) {
        console.log('No enrollments found for the specified stream.');
        return [];
      }
      // console.log({$in: enrollments.map(enrollment => enrollment._id)});

      // Step 1: Fetch assessments for the given term
      const assessments = await SummativeAssessment.find({
        term: term,
        test: test,

        learner: {$in: learners.map(learner => learner._id)},
      }).populate('learning_area test'); // Populate fields if necessary

      if (!assessments.length) {
        return [];
      }
      const testData = await Test.findById(test);

      const scales = await PlScaleService.getGradingScaleById(testData.grading, school);

      // Step 2: Initialize an object to hold the results grouped by learning area
      const resultsMap = {};

      // Step 3: Initialize all grading scores for each learning area
      scales.learningAreas.forEach(learningArea => {
        const learningAreaName = learningArea.learning_area.name; // Get the learning area name

        // Initialize an entry in resultsMap for each learning area
        resultsMap[learningAreaName] = {
          learning_area: learningAreaName,
          analysis: learningArea.gradings.map(grading => ({
            score: grading.score, // Grading score
            description: grading.description || '', // Grading description or an empty string
            mark: grading.mark,
            count: 0, // Initialize count to 0
          })),
        };
      });

      // Step 4: Loop through each assessment to analyze performance
      assessments.forEach(assessment => {
        const learningAreaId = assessment.learning_area._id.toString();
        const assessmentScore = assessment.score; // This is the assessment score

        // Find the corresponding grading description using the scales
        for (const learningArea of scales.learningAreas) {
          if (learningArea.learning_area._id.toString() === learningAreaId) {
            const learningAreaName = learningArea.learning_area.name; // Get the learning area name

            // Sort gradings by mark in descending order (highest mark first)
            const sortedGradings = learningArea.gradings.sort((a, b) => b.mark - a.mark);

            // Loop through the sorted gradings to find the correct grading score and description
            for (const grading of sortedGradings) {
              if (assessmentScore >= grading.mark) {
                // Check if this grading score already exists in the analysis for the learning area
                const existingAnalysis = resultsMap[learningAreaName].analysis.find(a => a.score === grading.score);

                if (existingAnalysis) {
                  // If the grading score already exists, increment the count
                  existingAnalysis.count += 1;
                }

                // Exit the grading loop once the correct grading is found
                break;
              }
            }
            // Exit the learning area loop once the correct learning area is found
            break;
          }
        }
      });

      // Convert the results map to an array
      const results = Object.values(resultsMap);

      // Return the array of grouped results
      return results;
    } catch (error) {
      console.error('Error analyzing performance:', error);
      throw error; // Re-throw the error for higher-level handling
    }
  }
  async analyzeStreamsAndLearners(grade, term, test, school, session) {
    try {
      const testId = new mongoose.Types.ObjectId(test);

      // Step 1: Fetch all streams for the grade and school
      const streams = await Stream.find({grade, school}).select('_id name');
      if (!streams.length) {
        console.log('No streams found for the specified grade and school.');
        return {
          streamRankings: [],
          bestLearners: {},
        };
      }

      // Step 2: Initialize results
      const streamResults = []; // To store mean scores per stream
      const learningAreaBest = {}; // To track best learner per learning area

      // Step 3: Process each stream
      for (const stream of streams) {
        // Fetch enrollments for the stream
        const enrollment = await Enrollment.find({
          school,
          to_stream: stream._id,
          to_session: session,
        }).populate('learner');

        const learners = enrollment.map(en => en.learner);
        if (!learners.length) {
          console.log(`No enrollments found for stream ${stream.name}.`);
          streamResults.push({
            stream: stream.name,
            meanScore: 0,
            learnerCount: 0,
          });
          continue;
        }

        // Fetch assessments
        const assessments = await SummativeAssessment.find({
          term,
          test: testId,
          learner: {$in: learners.map(learner => learner._id)},
        }).populate('learning_area learner');

        if (!assessments.length) {
          console.log(`No assessments found for stream ${stream.name}.`);
          streamResults.push({
            stream: stream.name,
            meanScore: 0,
            learnerCount: learners.length,
          });
          continue;
        }

        // Step 4: Calculate mean score and track best learners
        let totalScore = 0;
        let scoreCount = 0;

        assessments.forEach(assessment => {
          totalScore += assessment.score;
          scoreCount++;

          // Track best learner per learning area
          const learningAreaName = assessment.learning_area.name;
          const learnerName = assessment.learner; // Assuming learner has a name field
          const score = assessment.score;

          if (!learningAreaBest[learningAreaName]) {
            learningAreaBest[learningAreaName] = {
              learner: learnerName,
              score,
              stream: stream.name,
            };
          } else if (score > learningAreaBest[learningAreaName].score) {
            learningAreaBest[learningAreaName] = {
              learner: learnerName,
              score,
              stream: stream.name,
            };
          }
        });

        const meanScore = scoreCount > 0 ? totalScore / scoreCount : 0;
        streamResults.push({
          stream: stream.name,
          meanScore,
          learnerCount: learners.length,
        });
      }

      // Step 5: Sort streams by mean score (descending) for ranking
      streamResults.sort((a, b) => {
        if (b.meanScore !== a.meanScore) {
          return b.meanScore - a.meanScore; // Higher mean score first
        }
        return a.stream.localeCompare(b.stream); // Tiebreaker: alphabetical
      });

      // Step 6: Add rank to streams
      const streamRankings = streamResults.map((result, index) => ({
        rank: index + 1,
        stream: result.stream,
        meanScore: result.meanScore.toFixed(2),
        learnerCount: result.learnerCount,
      }));

      // Step 7: Convert best learners to array for consistent output
      const bestLearners = Object.entries(learningAreaBest).map(([learningArea, data]) => ({
        learningArea,
        learner: data.learner,
        score: data.score.toFixed(2),
        stream: data.stream,
      }));

      // Step 8: Return combined results
      return {
        streamRankings,
        bestLearners,
      };
    } catch (error) {
      console.error('Error analyzing streams and learners:', error);
      throw error;
    }
  }
  async generateAssessmentComparisonReport({term, learner, stream, current_session, user}) {
    try {
      // Validate required parameters
      if (!term || !learner) {
        throw new Error('Term and Learner are required');
      }

      // Build query
      const query = {term};

      // Fetch learner data
      const learner_data = await Learner.findById(learner).populate('grade stream');
      if (!learner_data) {
        throw new Error('Enrollment not found');
      }
      query.enrollment = learner_data._id;

      // Load images and convert to base64
      const loadImageToBase64 = filePath => {
        if (filePath && fs.existsSync(filePath)) {
          const imageBuffer = fs.readFileSync(filePath);
          return `data:image/png;base64,${imageBuffer.toString('base64')}`;
        }
        console.warn('Image file not found:', filePath);
        return '';
      };

      const imageDataUrl = loadImageToBase64(learner_data.photo);
      const school = user?.school || {};
      const logoDataUrl = loadImageToBase64(school.logo);
      const elimuriselogoDataUrl = loadImageToBase64('logo.png');
      const schoolStampDataUrl = loadImageToBase64(school.school_stamp);
      const headteacherSignatureDataUrl = loadImageToBase64(school.signatory_signature);

      // Signature details
      const signatoryRole = school.signatory_role || 'Head Teacher';
      const signatoryName = school.signatory_name || '';
      const signatorySignatureUrl = school.signatory_signature ? headteacherSignatureDataUrl : '';

      // Fetch comments
      const [teacher_comment, head_comment] = await Promise.all([
        Comments.findOne({
          type: 'teacher',
          session: current_session,
          term,
          learner,
          stream,
        }).populate('learner'),
        Comments.findOne({
          type: 'head',
          session: current_session,
          term,
          learner,
          stream,
        }).populate('learner'),
      ]);

      // Fetch assessments
      const assessments = await summativeAssessment.getLearnerAssessmentComparison(learner_data, term, current_session);

      // Generate HTML (keeping your existing HTML structure)
      let html = generateReportHTML({
        school,
        term,
        current_session,
        learner_data,
        assessments,
        imageDataUrl,
        logoDataUrl,
        schoolStampDataUrl,
        signatorySignatureUrl,
        signatoryRole,
        signatoryName,
        teacher_comment,
        descriptors: await PlDescriptorService.getAllDescriptorsByLanguage(),
      });

      if (!html) {
        throw new Error('Failed to generate HTML content');
      }

      // PDF generation options
      const options = {
        format: 'A4',
        border: {
          top: '0.15in',
          right: '0.25in',
          bottom: '0.1in',
          left: '0.25in',
        },
        footer: {
          height: '15mm',
          contents: `<hr style="border:1px solid black; margin: 0;"><div style="display: flex; align-items: center; justify-content: center; padding: 2px 0;"><img src="${elimuriselogoDataUrl}" alt="Elimurise Logo" style="width:30px; border-radius:3px; margin-right: 5px;">Powered By Elimurise. <span style="margin-left: 10px; color:#444;">{{page}}/{{pages}}</span></div>`,
        },
        childProcessOptions: {
          env: {OPENSSL_CONF: '/dev/null'},
        },
      };

      return {html, options}; // Return for further processing (e.g., streaming to response)
    } catch (err) {
      throw new Error(err.message);
    }
  }

  // Separate function for HTML generation (for better organization)
  async generateReportHTML({
    school,
    term,
    current_session,
    learner_data,
    assessments,
    imageDataUrl,
    logoDataUrl,
    schoolStampDataUrl,
    signatorySignatureUrl,
    signatoryRole,
    signatoryName,
    teacher_comment,
    descriptors,
  }) {
    const gradingMap = {
      4: {abbr: 'EE', full: 'Exceeding Expectation'},
      3: {abbr: 'ME', full: 'Meeting Expectation'},
      2: {abbr: 'AE', full: 'Approaching Expectation'},
      1: {abbr: 'BE', full: 'Below Expectation'},
    };

    let html = `<!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="description" content="Assessment Comparison Report for ${school.name || ''}">
      <meta name="author" content="${school.name || ''}">
      <title>Assessment Comparison - ${school.name || ''}</title>
      <style>
  :root {
      --primary-color: #ff3333;
      --secondary-color: #33cc33;
      ${
        school.primaryColor
          ? schoolleda.primaryColor.toLowerCase() === '#ffffff' || school.primaryColor.toLowerCase() === 'white'
            ? '--primary-color: #ff6666;'
            : `--primary-color: ${school.primaryColor};`
          : ''
      }
      ${
        school.secondaryColor
          ? school.secondaryColor.toLowerCase() === '#ffffff' || school.secondaryColor.toLowerCase() === 'white'
            ? '--secondary-color: #66cc66;'
            : `--secondary-color: ${school.secondaryColor};`
          : ''
      }
      --accent1: #0066ff;
      --accent2: #ffcc00;
  }
  
  body {
      font-family: 'Comic Sans MS', cursive, sans-serif;
      background: #ffffff;
      margin: 0;
      padding: 0;
      color: #333;
      font-size: 1em;
  }
  
  .watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 5em;
      color: rgba(0, 0, 0, 0.1);
      z-index: -1;
  }
  
  .page {
      width: 90%;
      margin: 40px auto;
      background: white;
      border: 5px solid var(--primary-color);
      border-radius: 15px;
      padding: 20px;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
      position: relative;
  }
  
  /* Rest of your CSS styles remain unchanged... */
  .letterhead {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 5px;
      background: var(--primary-color);
      color: white;
      border-radius: 10px 10px 0 0;
      border-bottom: 3px dashed var(--secondary-color);
      max-height: 150px;
      overflow: hidden;
      position: relative;
  }
  
  .letterhead img {
      width: 120px;
      height: auto;
      background: white;
      padding: 2px;
      border-radius: 10px;
      margin-left: 10px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
  
  .school-info {
      text-align: center;
      margin-left: 10px;
  }
  
  .school-name {
      font-size: 2em;
      font-weight: bold;
      text-transform: uppercase;
      margin: 0;
      line-height: 1.3;
  }
  
  .address {
      font-size: 0.9em;
      font-style: italic;
      margin: 3px 0 0 0;
      line-height: 1.3;
  }
  
  .report-title {
      text-align: center;
      font-size: 1.8em;
      font-weight: bold;
      color: var(--primary-color);
      margin: 7px 0;
      text-transform: uppercase;
      line-height: 1.3;
      position: relative;
  }
  
  .info-container {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin: 7px 0;
      max-height: 120px;
      border-bottom: 2px dotted var(--primary-color);
      padding-bottom: 7px;
  }
  
  .info-container img {
      width: 100px;
      height: auto;
      border: 2px solid var(--primary-color);
      border-radius: 10px;
      background: white;
  }
  
  .info-table {
      margin-left: 10px;
      width: 65%;
      border-collapse: collapse;
  }
  
  .info-table td {
      padding: 2px;
      font-size: 1.2em;
      color: #000;
      border-bottom: 1px dashed var(--primary-color);
      line-height: 1.3;
  }
  
  .label {
      font-weight: bold;
      color: var(--primary-color);
  }
  
  .result {
      width: 100%;
      border-collapse: collapse;
      margin-top: 15px;
      background: white;
  }
  
  .result th, .result td {
      border: 2px solid var(--primary-color);
      padding: 2px;
      text-align: left;
      font-size: 1.2em;
      color: #333;
      line-height: 1.3;
  }
  
  .result th {
      background: var(--primary-color);
      color: white;
      text-transform: uppercase;
  }
  
  .result tr:nth-child(even) {
      background: #f9f9f9;
  }
  
  .key-section {
      margin: 0;
      background: #f9f9f9;
  }
  
  .key-section h3 {
      font-size: 1.2em;
      color: var(--primary-color);
      margin: 0 0 12px 0;
      text-align: left;
      text-transform: uppercase;
  }
  
  .key-table {
      width: 100%;
      margin: 0 auto;
      border-collapse: collapse;
  }
  
  .key-table th, .key-table td {
      border: 2px solid var(--primary-color);
      text-align: left;
      font-size: 1em;
      color: #333;
      font-style: italic;
      padding: 2px;
  }
  
  .key-table th {
      background: var(--primary-color);
      color: white;
      text-transform: uppercase;
  }
  
  .key-table tr:nth-child(even) {
      background: #fff;
  }
  
  .comments {
      font-size: 1.2em;
      padding: 7px 10px;
      margin: 2px 0;
      border: 2px solid var(--primary-color);
      background: #fff;
      color: #000;
      border-radius: 10px;
      line-height: 1;
      position: relative;
      margin-left: 20px;
  }
  
  .comments::before {
      content: '';
      position: absolute;
      top: 10px;
      left: -20px;
      width: 0;
      height: 0;
      border: 10px solid transparent;
      border-right-color: var(--primary-color);
  }
  
  .comments::after {
      content: '';
      position: absolute;
      top: 12px;
      left: -16px;
      width: 0;
      height: 0;
      border: 8px solid transparent;
      border-right-color: #fff;
  }
  
  .signature img {
      width: 100px;
      height: auto;
      border: none;
      border-radius: 5px;
  }
  
  .signature-label {
      font-size: 1em;
      font-weight: bold;
      text-transform: uppercase;
      color: var(--primary-color);
      line-height: 1.3;
  }
  
  .signature-section {
      text-align: center;
      border-top: 2px solid var(--primary-color);
  }
  
  .signature {
      display: flex;
      flex-direction: column;
      align-items: center;
      width: 300px;
      margin: auto;
  }
  
  .signature img {
      width: 100px;
      height: auto;
      border: none;
      border-radius: 5px;
  }
  
  .signature-label {
      font-size: 1.0em;
      font-weight: bold;
      text-transform: uppercase;
      color: var(--primary-color);
      line-height: 1.1;
  }
      </style>
  </head>
  <body>
      <div class="watermark">${school.name || ''}</div>
      <div class="page">
          <div class="letterhead">
              <img src="${logoDataUrl}" alt="School Logo">
              <div class="school-info">
                  <div class="school-name">${school.name || ''}</div>
                  <div class="address">${school.address || ''}</div>
              </div>
              <div style="width: 90px; margin: 0 7.5px;"></div>
          </div>
          <div class="report-title">Summative Assessment REPORT - Term ${term} - ${current_session}</div>
  
          <div class="info-container">
              <img src="${imageDataUrl}" alt="Learner's Profile Picture">
              <table class="info-table">
                  <tr>
                      <td><span class="label">NAME:</span> ${learner_data.first_name} ${learner_data.last_name} ${
      learner_data.surname || ''
    }</td>
                  </tr>
                  <tr>
                      <td><span class="label">ADM NO:</span> ${learner_data.adm_no || ''}</td>
                  </tr>
                  <tr>
                      <td><span class="label">CLASS:</span> ${learner_data.stream?.grade?.name || ''}</td>
                  </tr>
                  <tr>
                      <td><span class="label">STREAM:</span> ${learner_data.stream?.name || ''}</td>
                  </tr>
              </table>
          </div>
          <table class="result">
              <tr>
                  <th>LEARNING AREA</th>`;

    if (assessments.length > 0 && assessments[0].allTestTypes) {
      assessments[0].allTestTypes.forEach(testType => {
        html += `<th><b>${testType}</b></th><th><b>DESC</b></th>`;
      });
    }

    html += `</tr>`;
    assessments?.forEach(assessment => {
      html += `
        <tr>
          <td>${assessment?.learning_area || ''}</td>`;
      assessment.assessments.forEach(assessment => {
        html += `<td><b>${assessment.score ?? '_'}</b></td>`;
        html += `<td><b>${assessment.gradingScore ? gradingMap[assessment.gradingScore]?.abbr || '_' : '_'}</b></td>`;
      });
      html += `</tr>`;
    });

    html += `
      </table>
      <div class="key-section">
        <h3>Grading Key</h3>
        <table class="key-table">
          <tr>
            <th>Abbreviation</th>
            <th>Description</th>
          </tr>`;

    descriptors.forEach(descriptor => {
      const abbreviation = gradingMap[descriptor.score] || {abbr: '-', full: '-'};
      const description = descriptor.description.replace(/{{learner}}/g, 'Learner');
      html += `
        <tr>
          <td><b>${abbreviation.abbr}</b></td>
          <td><b>${abbreviation.full}</b>: ${description}</td>
        </tr>`;
    });

    html += `
        </table>
      </div>
      <div class="comments">
        <div><b>Facilitator's Comment:</b></div>
        <p>${teacher_comment?.comment || ''}</p>
      </div>
      <div class="signature-section">
        <div class="signature">
          <img src="${schoolStampDataUrl}" alt="School Stamp">
          <img src="${signatorySignatureUrl}" alt="Signature">
          <div class="signature-label">${signatoryRole}: ${signatoryName}</div>
        </div>
      </div>
    </div>
  </body>
  </html>`;

    return html;
  }

  // Example usage
}
module.exports = new SummativeAssessmentService();
