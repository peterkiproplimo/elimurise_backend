// controllers/portfolioSummaryController.js
const ProjectEvidence = require("../../models/frontoffice/ProjectEvidence");
const Student = require("../../models/frontoffice/Student");
const Competency = require("../../models/frontoffice/Competency");
const Certificate = require("../../models/frontoffice/Certificate");

/**
 * @desc Generate portfolio summary data for a student
 * @route GET /api/portfolio-summary/:studentId
 * @access Authenticated
 */
// const generatePortfolioSummary = async (req, res) => {
//   try {
//     const { studentId } = req.params;
//     const { 
//       academicYear = new Date().getFullYear().toString(),
//       term = "All",
//       includeReflections = true,
//       includeTeacherFeedback = true,
//       includeCompetencies = true,
//       includeEvidence = true
//     } = req.query;

//     // Determine auth header: prefer Authorization header, else use accessToken from body
//     const incomingBearer = req.headers.authorization || (req.body?.accessToken ? `Bearer ${req.body.accessToken}` : '');

//     // Fetch student information from external API
//       let student = null;
//       let guardian = null;
//       let grade = null;
//       let stream = null;

    
//     try {
//       console.log(`Fetching student data for ID: ${studentId}`);
//       const studentResponse = await fetch(`https://demo.elimurise.com/api/portal/learners/${studentId}/history`, {
//         headers: {
//           'Authorization': incomingBearer,
//           'Content-Type': 'application/json'
//         }
//       });
      
//       console.log(`Student API response status: ${studentResponse.status}`);
      
//       if (studentResponse.ok) {
//         const studentData = await studentResponse.json();
//         console.log('Student API response data:', JSON.stringify(studentData, null, 2));
        
//         // Extract student info from the response
//         const primary = Array.isArray(studentData?.data) ? studentData.data[0] : studentData?.data;
//         const learner = primary?.learner || primary || {};
//         const toGrade = primary?.to_grade || {};
//         const toStream = primary?.to_stream || {};
//         const school = primary?.school || {};

//         student = {
//           _id: studentId,
//           adm_no: learner.adm_no || '',
//           first_name: learner.first_name || '',
//           last_name: learner.last_name || '',
//           surname: learner.surname || '',
//           fullName: `${learner.first_name || ''} ${learner.last_name || ''} ${learner.surname || ''}`.trim(),
//           current_session: learner.current_session,
//           grade: toGrade?._id ? { _id: toGrade._id, name: toGrade.name, level: toGrade.level } : undefined,
//           stream: toStream?._id ? { _id: toStream._id, name: toStream.name } : undefined,
//           school: school?.name || undefined,
   
//           guardian_relationship: learner.guardian_relationship
//         };

        
//         guardian =  {
//           _id: learner.guardian._id,
//           school: learner.guardian.school,
//           first_name: learner.guardian.first_name,
//           surname: learner.guardian.surname,
//           last_name: learner.guardian.last_name,
//           id_no: learner.guardian.id_no,
//           email: learner.guardian.email,
//           phone: learner.guardian.phone,
//           gender: learner.guardian.gender,
//           schoolCode: learner.guardian.schoolCode,
//           status: learner.guardian.status,
//           createdAt: learner.guardian.createdAt,
//           updatedAt: learner.guardian.updatedAt,
//           guardian_relationship: learner.guardian_relationship
//         };
 

//         grade = {
//           _id: studentId,
//           adm_no: learner.adm_no || '',
//           first_name: learner.first_name || '',
//         };

//         stream = {
//           _id: studentId,
//           adm_no: learner.adm_no || '',
//           first_name: learner.first_name || '',
//         };
//         console.log('Extracted student info:', student);
//       } else {
//         const errorText = await studentResponse.text();
//         console.error(`Student API error (${studentResponse.status}):`, errorText);
//       }
//     } catch (error) {
//       console.error('Error fetching student from external API:', error);
//     }

//     if (!student) {
//       return res.status(404).json({ message: 'Student not found' });
//     }

//     // Build date filter for academic year
//     const yearStart = new Date(`${academicYear}-01-01`);
//     const yearEnd = new Date(`${academicYear}-12-31`);

//     // Fetch project evidences for the student
//     // Query using both student and studentId fields to ensure we get all records
//     let evidenceQuery = { 
//       $or: [
//         { student: studentId },
//         { studentId: studentId }
//       ],
//       status: { $in: ['reviewed', 'approved'] }
//     };

//     if (term !== "All") {
//       // Add term filter if needed (you may need to adjust this based on your data structure)
//       evidenceQuery.submittedAt = {
//         $gte: yearStart,
//         $lte: yearEnd
//       };
//     }

//     console.log(`Fetching project evidence for student ID: ${studentId}`);
//     const projectEvidences = await ProjectEvidence.find(evidenceQuery)
//       .populate('competency', 'name code')
//       .populate('teacherFeedback.feedbackBy', 'name')
//       .sort({ submittedAt: -1 });
    
//     console.log(`Found ${projectEvidences.length} project evidence records for student ${studentId}`);

//     // Fetch learning areas from the main API
//     let learningAreas = [];
//     try {
//       const learningAreasResponse = await fetch(`https://demo.elimurise.com/api/portal/learning-areas?gradeId=65dc82fc14736ba5fcadf989&limit=1000&status=active`, {
//         headers: {
//           'Authorization': incomingBearer,
//           'Content-Type': 'application/json'
//         }
//       });
      
//       if (learningAreasResponse.ok) {
//         const learningAreasData = await learningAreasResponse.json();
//         learningAreas = learningAreasData.data || learningAreasData.learningAreas || [];
//       }
//     } catch (error) {
//       console.error('Error fetching learning areas:', error);
//     }

//     // Calculate competencies achieved
//     const competenciesAchieved = {};
//     const learningAreasCovered = {};
//     const evidenceByType = { photo: 0, video: 0 };
//     const reflections = [];
//     const teacherFeedbacks = [];

//     projectEvidences.forEach(evidence => {
//       // Count competencies
//       if (evidence.competency) {
//         const compKey = evidence.competency._id;
//         if (!competenciesAchieved[compKey]) {
//           competenciesAchieved[compKey] = {
//             competency: evidence.competency,
//             count: 0,
//             evidences: []
//           };
//         }
//         competenciesAchieved[compKey].count++;
//         competenciesAchieved[compKey].evidences.push(evidence);
//       }

//       // Count learning areas
//       if (evidence.learningArea) {
//         // Find the learning area from the fetched data
//         const learningArea = learningAreas.find(la => la._id === evidence.learningArea);
//         if (learningArea) {
//           const laKey = learningArea._id;
//           if (!learningAreasCovered[laKey]) {
//             learningAreasCovered[laKey] = {
//               learningArea: learningArea,
//               count: 0,
//               evidences: []
//             };
//           }
//           learningAreasCovered[laKey].count++;
//           learningAreasCovered[laKey].evidences.push(evidence);
//         }
//       }

//       // Count evidence types
//       evidenceByType[evidence.evidenceType]++;

//       // Collect reflections
//       if (includeReflections && evidence.reflection) {
//         const learningArea = learningAreas.find(la => la._id === evidence.learningArea);
//         reflections.push({
//           title: evidence.title,
//           reflection: evidence.reflection,
//           learningArea: learningArea?.name || 'N/A',
//           competency: evidence.competency?.name || 'N/A',
//           date: evidence.submittedAt
//         });
//       }

//       // Collect teacher feedback
//       if (includeTeacherFeedback && evidence.teacherFeedback) {
//         evidence.teacherFeedback.forEach(feedback => {
//           teacherFeedbacks.push({
//             evidenceTitle: evidence.title,
//             comment: feedback.comment,
//             rating: feedback.rating,
//             feedbackBy: feedback.feedbackBy?.name || feedback.feedbackBy_name,
//             date: feedback.feedbackDate,
//             authenticityApproved: feedback.authenticityApproved
//           });
//         });
//       }
//     });

//     // Calculate statistics
//     const totalEvidences = projectEvidences.length;
//     const totalCompetencies = Object.keys(competenciesAchieved).length;
//     const totalLearningAreas = Object.keys(learningAreasCovered).length;
//     const averageRating = teacherFeedbacks.length > 0 
//       ? teacherFeedbacks.reduce((sum, fb) => sum + fb.rating, 0) / teacherFeedbacks.length 
//       : 0;

//     // Generate strengths and improvements based on data
//     const strengths = generateStrengths(competenciesAchieved, teacherFeedbacks, evidenceByType);
//     const improvements = generateImprovements(competenciesAchieved, teacherFeedbacks, reflections);

//     // Fetch certificates for the student
//     let certificates = [];
//     let awards = [];
//     try {
//       console.log(`Fetching certificates for student ID: ${studentId}`);
//       const studentCertificates = await Certificate.find({ 
//         studentId: studentId,
//         status: 'Active'
//       }).sort({ issueDate: -1 });
      
//       console.log(`Found ${studentCertificates.length} total certificates (Active status) for student ${studentId}`);
      
//       // Separate certificates and awards based on certificateType
//       certificates = studentCertificates.filter(cert => 
//         cert.certificateType && !['Awards', 'Recognitions'].includes(cert.certificateType)
//       );
      
//       awards = studentCertificates.filter(cert => 
//         cert.certificateType && ['Awards', 'Recognitions'].includes(cert.certificateType)
//       );
      
//       console.log(`Separated into ${certificates.length} certificates and ${awards.length} awards for student ${studentId}`);
//     } catch (error) {
//       console.error('Error fetching certificates:', error);
//       console.error('Error details:', error.message);
//     }

//     // Prepare summary data
//     const portfolioSummary = {
//       student,
//       guardian,
//       grade,
//       stream,
//       academicYear,
//       term,
//       generatedAt: new Date(),
//       statistics: {
//         totalEvidences,
//         totalCompetencies,
//         totalLearningAreas,
//         averageRating: Math.round(averageRating * 10) / 10,
//         evidenceByType,
//         photoCount: evidenceByType.photo,
//         videoCount: evidenceByType.video
//       },
//       competenciesAchieved: Object.values(competenciesAchieved),
//       learningAreasCovered: Object.values(learningAreasCovered),
//       reflections: reflections.slice(0, 10), // Limit to recent 10 reflections
//       teacherFeedbacks: teacherFeedbacks.slice(0, 15), // Limit to recent 15 feedbacks
//       strengths,
//       improvements,
//       projectEvidences: includeEvidence ? projectEvidences.map((ev) => ({
//         _id: ev._id,
//         title: ev.title,
//         caption: ev.caption,
//         description: ev.description,
//         reflection: ev.reflection,
//         evidenceType: ev.evidenceType,
//         mediaUrl: ev.mediaUrl,
//         thumbnailUrl: ev.thumbnailUrl,
//         pci: ev.pci,
//         competency: ev.competency ? { _id: ev.competency._id, name: ev.competency.name, code: ev.competency.code } : null,
//         learningArea: ev.learningArea || null,
//         submittedAt: ev.submittedAt,
//         status: ev.status,
//         googleDriveFiles: ev.googleDriveFiles || [],
//         googleDriveUrl: ev.googleDriveUrl,
//         googleDriveFileId: ev.googleDriveFileId,
//         teacherFeedback: Array.isArray(ev.teacherFeedback) ? ev.teacherFeedback.map((fb) => ({
//           comment: fb.comment,
//           rating: fb.rating,
//           authenticityApproved: fb.authenticityApproved,
//           feedbackBy: fb.feedbackBy?.name || fb.feedbackBy_name,
//           feedbackDate: fb.feedbackDate,
//         })) : []
//       })) : [],
//       certificates: certificates,
//       awards: awards,
//       summaryInsights: {
//         mostActiveLearningArea: Object.values(learningAreasCovered)
//           .sort((a, b) => b.count - a.count)[0]?.learningArea?.name || 'N/A',
//         topCompetency: Object.values(competenciesAchieved)
//           .sort((a, b) => b.count - a.count)[0]?.competency?.name || 'N/A',
//         recentActivity: projectEvidences.length > 0 ? projectEvidences[0].submittedAt : null
//       }
//     };

//     res.json(portfolioSummary);
    
//   } catch (error) {
//     console.error('Error generating portfolio summary:', error);
//     res.status(500).json({ 
//       message: 'Error generating portfolio summary', 
//       error: error.message 
//     });
//   }
// };


const generatePortfolioSummaryNew = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { 
      academicYear = new Date().getFullYear().toString(),
      term = "All",
      includeReflections = true,
      includeTeacherFeedback = true,
      includeCompetencies = true,
      includeEvidence = true
    } = req.query;

    // Determine auth header: prefer Authorization header, else use accessToken from body
    const incomingBearer = req.headers.authorization || (req.body?.accessToken ? `Bearer ${req.body.accessToken}` : '');

    // Fetch student information from external API
      let student = null;
      let guardian = null;
      let grade = null;
      let stream = null;

    
    try {
      console.log(`Fetching student data for ID: ${studentId}`);
      const studentResponse = await fetch(`https://demo.elimurise.com/api/portal/learners/${studentId}/history`, {
        headers: {
          'Authorization': incomingBearer,
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`Student API response status: ${studentResponse.status}`);
      
      if (studentResponse.ok) {
        const studentData = await studentResponse.json();
        console.log('Student API response data:', JSON.stringify(studentData, null, 2));
        
        // Extract student info from the response
        const primary = Array.isArray(studentData?.data) ? studentData.data[0] : studentData?.data;
        const learner = primary?.learner || primary || {};
    
    
   
        console.log('Extracted student info:', student);
      } else {
        const errorText = await studentResponse.text();
        console.error(`Student API error (${studentResponse.status}):`, errorText);
      }
    } catch (error) {
      console.error('Error fetching student from external API:', error);
    }

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    // Build date filter for academic year
    const yearStart = new Date(`${academicYear}-01-01`);
    const yearEnd = new Date(`${academicYear}-12-31`);

    // Fetch project evidences for the student
    // Query using both student and studentId fields to ensure we get all records
    let evidenceQuery = { 
      $or: [
        { student: studentId },
        { studentId: studentId }
      ],
      status: { $in: ['reviewed', 'approved'] }
    };

    if (term !== "All") {
      // Add term filter if needed (you may need to adjust this based on your data structure)
      evidenceQuery.submittedAt = {
        $gte: yearStart,
        $lte: yearEnd
      };
    }

    console.log(`Fetching project evidence for student ID: ${studentId}`);
    const projectEvidences = await ProjectEvidence.find(evidenceQuery)
      .populate('competency', 'name code')
      .populate('teacherFeedback.feedbackBy', 'name')
      .sort({ submittedAt: -1 });
    
    console.log(`Found ${projectEvidences.length} project evidence records for student ${studentId}`);

    // Fetch learning areas from the main API
    let learningAreas = [];
    try {
      const learningAreasResponse = await fetch(`https://demo.elimurise.com/api/portal/learning-areas?gradeId=65dc82fc14736ba5fcadf989&limit=1000&status=active`, {
        headers: {
          'Authorization': incomingBearer,
          'Content-Type': 'application/json'
        }
      });
      
      if (learningAreasResponse.ok) {
        const learningAreasData = await learningAreasResponse.json();
        learningAreas = learningAreasData.data || learningAreasData.learningAreas || [];
      }
    } catch (error) {
      console.error('Error fetching learning areas:', error);
    }

    // Calculate competencies achieved
    const competenciesAchieved = {};
    const learningAreasCovered = {};
    const evidenceByType = { photo: 0, video: 0 };
    const reflections = [];
    const teacherFeedbacks = [];

    projectEvidences.forEach(evidence => {
      // Count competencies
      if (evidence.competency) {
        const compKey = evidence.competency._id;
        if (!competenciesAchieved[compKey]) {
          competenciesAchieved[compKey] = {
            competency: evidence.competency,
            count: 0,
            evidences: []
          };
        }
        competenciesAchieved[compKey].count++;
        competenciesAchieved[compKey].evidences.push(evidence);
      }

      // Count learning areas
      if (evidence.learningArea) {
        // Find the learning area from the fetched data
        const learningArea = learningAreas.find(la => la._id === evidence.learningArea);
        if (learningArea) {
          const laKey = learningArea._id;
          if (!learningAreasCovered[laKey]) {
            learningAreasCovered[laKey] = {
              learningArea: learningArea,
              count: 0,
              evidences: []
            };
          }
          learningAreasCovered[laKey].count++;
          learningAreasCovered[laKey].evidences.push(evidence);
        }
      }

      // Count evidence types
      evidenceByType[evidence.evidenceType]++;

      // Collect reflections
      if (includeReflections && evidence.reflection) {
        const learningArea = learningAreas.find(la => la._id === evidence.learningArea);
        reflections.push({
          title: evidence.title,
          reflection: evidence.reflection,
          learningArea: learningArea?.name || 'N/A',
          competency: evidence.competency?.name || 'N/A',
          date: evidence.submittedAt
        });
      }

      // Collect teacher feedback
      if (includeTeacherFeedback && evidence.teacherFeedback) {
        evidence.teacherFeedback.forEach(feedback => {
          teacherFeedbacks.push({
            evidenceTitle: evidence.title,
            comment: feedback.comment,
            rating: feedback.rating,
            feedbackBy: feedback.feedbackBy?.name || feedback.feedbackBy_name,
            date: feedback.feedbackDate,
            authenticityApproved: feedback.authenticityApproved
          });
        });
      }
    });

    // Calculate statistics
    const totalEvidences = projectEvidences.length;
    const totalCompetencies = Object.keys(competenciesAchieved).length;
    const totalLearningAreas = Object.keys(learningAreasCovered).length;
    const averageRating = teacherFeedbacks.length > 0 
      ? teacherFeedbacks.reduce((sum, fb) => sum + fb.rating, 0) / teacherFeedbacks.length 
      : 0;

    // Generate strengths and improvements based on data
    const strengths = generateStrengths(competenciesAchieved, teacherFeedbacks, evidenceByType);
    const improvements = generateImprovements(competenciesAchieved, teacherFeedbacks, reflections);

    // Fetch certificates for the student
    let certificates = [];
    let awards = [];
    try {
      console.log(`Fetching certificates for student ID: ${studentId}`);
      const studentCertificates = await Certificate.find({ 
        studentId: studentId,
        status: 'Active'
      }).sort({ issueDate: -1 });
      
      console.log(`Found ${studentCertificates.length} total certificates (Active status) for student ${studentId}`);
      
      // Separate certificates and awards based on certificateType
      certificates = studentCertificates.filter(cert => 
        cert.certificateType && !['Awards', 'Recognitions'].includes(cert.certificateType)
      );
      
      awards = studentCertificates.filter(cert => 
        cert.certificateType && ['Awards', 'Recognitions'].includes(cert.certificateType)
      );
      
      console.log(`Separated into ${certificates.length} certificates and ${awards.length} awards for student ${studentId}`);
    } catch (error) {
      console.error('Error fetching certificates:', error);
      console.error('Error details:', error.message);
    }

    // Prepare summary data
    const portfolioSummary = {
  
    
      certificates: certificates,
  
    };

    res.json(portfolioSummary);
    
  } catch (error) {
    console.error('Error generating portfolio summary:', error);
    res.status(500).json({ 
      message: 'Error generating portfolio summary', 
      error: error.message 
    });
  }
};

/**
 * @desc Generate PDF portfolio summary (returns data for frontend PDF generation)
 * @route POST /api/portfolio-summary/:studentId/pdf
 * @access Authenticated
 */
const generatePortfolioPDF = async (req, res) => {
  try {
    const { studentId } = req.params;
    const { 
      academicYear = new Date().getFullYear().toString(),
      term = "All",
      includeReflections = true,
      includeTeacherFeedback = true,
      includeCompetencies = true,
      includeEvidence = true,
      customTitle = "",
      customIntroduction = ""
    } = req.body;

    // Generate portfolio summary data
    const summaryData = await generatePortfolioSummaryData(studentId, {
      academicYear,
      term,
      includeReflections,
      includeTeacherFeedback,
      includeCompetencies,
      includeEvidence
    }, req);

    // Add custom title and introduction to the data
    summaryData.customTitle = customTitle;
    summaryData.customIntroduction = customIntroduction;

    // Return the data for frontend PDF generation
    res.json({
      message: 'Portfolio summary data generated successfully',
      data: summaryData,
      filename: `portfolio-summary-${summaryData.student.adm_no}-${academicYear}.pdf`
    });
  } catch (error) {
    console.error('Error generating portfolio PDF data:', error);
    res.status(500).json({ 
      message: 'Error generating portfolio PDF data', 
      error: error.message 
    });
  }
};

// Helper function to generate portfolio summary data
async function generatePortfolioSummaryData(studentId, options, req) {
  const { 
    academicYear = new Date().getFullYear().toString(), 
    term = "All",
    includeReflections = true,
    includeTeacherFeedback = true,
    includeCompetencies = true,
    includeEvidence = true 
  } = options || {};

  // Determine auth header: prefer Authorization header, else use accessToken from body
  const incomingBearer = req.headers.authorization || (req.body?.accessToken ? `Bearer ${req.body.accessToken}` : '');

  // Fetch student information from external API
  let student = null;
  try {
    console.log(`Fetching student data for ID: ${studentId}`);
    const studentResponse = await fetch(`https://demo.elimurise.com/api/portal/learners/${studentId}/history`, {
      headers: {
        'Authorization': incomingBearer,
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Student API response status: ${studentResponse.status}`);
    
    if (studentResponse.ok) {
      const studentData = await studentResponse.json();
      console.log('Student API response data:', JSON.stringify(studentData, null, 2));
      
      // Extract student info from the response
      const primary = Array.isArray(studentData?.data) ? studentData.data[0] : studentData?.data;
      const learner = primary?.learner || primary || {};
      const toGrade = primary?.to_grade || {};
      const toStream = primary?.to_stream || {};
      const school = primary?.school || {};

      student = {
        _id: studentId,
        adm_no: learner.adm_no || '',
        first_name: learner.first_name || '',
        last_name: learner.last_name || '',
        surname: learner.surname || '',
        fullName: `${learner.first_name || ''} ${learner.last_name || ''} ${learner.surname || ''}`.trim(),
        current_session: learner.current_session,
        grade: toGrade?._id ? { _id: toGrade._id, name: toGrade.name, level: toGrade.level } : undefined,
        stream: toStream?._id ? { _id: toStream._id, name: toStream.name } : undefined,
        school: school?.name || undefined,
        guardian: learner?.guardian ? {
          _id: learner.guardian._id,
          school: learner.guardian.school,
          first_name: learner.guardian.first_name,
          surname: learner.guardian.surname,
          last_name: learner.guardian.last_name,
          id_no: learner.guardian.id_no,
          email: learner.guardian.email,
          phone: learner.guardian.phone,
          gender: learner.guardian.gender,
          schoolCode: learner.guardian.schoolCode,
          status: learner.guardian.status,
          createdAt: learner.guardian.createdAt,
          updatedAt: learner.guardian.updatedAt
        } : undefined,
        guardian_relationship: learner.guardian_relationship
      };
      
      console.log('Extracted student info:', student);
    } else {
      const errorText = await studentResponse.text();
      console.error(`Student API error (${studentResponse.status}):`, errorText);
    }
  } catch (error) {
    console.error('Error fetching student from external API:', error);
  }

  if (!student) {
    throw new Error('Student not found');
  }

  // Build date filter
  const yearStart = new Date(`${academicYear}-01-01`);
  const yearEnd = new Date(`${academicYear}-12-31`);

  // Fetch project evidences
  // Query using both student and studentId fields to ensure we get all records
  let evidenceQuery = { 
    $or: [
      { student: studentId },
      { studentId: studentId }
    ],
    status: { $in: ['reviewed', 'approved'] }
  };

  if (term !== "All") {
    evidenceQuery.submittedAt = {
      $gte: yearStart,
      $lte: yearEnd
    };
  }

  console.log(`Fetching project evidence for student ID: ${studentId}`);
  const projectEvidences = await ProjectEvidence.find(evidenceQuery)
    .populate('competency', 'name code')
    .populate('teacherFeedback.feedbackBy', 'name')
    .sort({ submittedAt: -1 });
  
  console.log(`Found ${projectEvidences.length} project evidence records for student ${studentId}`);

  // Fetch learning areas from the main API
  let learningAreas = [];
  try {
    const learningAreasResponse = await fetch(`https://demo.elimurise.com/api/portal/learning-areas?gradeId=65dc82fc14736ba5fcadf989&limit=1000&status=active`, {
      headers: {
        'Authorization': incomingBearer,
        'Content-Type': 'application/json'
      }
    });
    
    if (learningAreasResponse.ok) {
      const learningAreasData = await learningAreasResponse.json();
      learningAreas = learningAreasData.data || learningAreasData.learningAreas || [];
    }
  } catch (error) {
    console.error('Error fetching learning areas:', error);
  }

  // Process data (same logic as in generatePortfolioSummary)
  const competenciesAchieved = {};
  const learningAreasCovered = {};
  const evidenceByType = { photo: 0, video: 0 };
  const reflections = [];
  const teacherFeedbacks = [];

  projectEvidences.forEach(evidence => {
    if (evidence.competency) {
      const compKey = evidence.competency._id;
      if (!competenciesAchieved[compKey]) {
        competenciesAchieved[compKey] = {
          competency: evidence.competency,
          count: 0,
          evidences: []
        };
      }
      competenciesAchieved[compKey].count++;
      competenciesAchieved[compKey].evidences.push(evidence);
    }

    if (evidence.learningArea) {
      // Find the learning area from the fetched data
      const learningArea = learningAreas.find(la => la._id === evidence.learningArea);
      if (learningArea) {
        const laKey = learningArea._id;
        if (!learningAreasCovered[laKey]) {
          learningAreasCovered[laKey] = {
            learningArea: learningArea,
            count: 0,
            evidences: []
          };
        }
        learningAreasCovered[laKey].count++;
        learningAreasCovered[laKey].evidences.push(evidence);
      }
    }

    evidenceByType[evidence.evidenceType]++;

    if (includeReflections && evidence.reflection) {
      const learningArea = learningAreas.find(la => la._id === evidence.learningArea);
      reflections.push({
        title: evidence.title,
        reflection: evidence.reflection,
        learningArea: learningArea?.name || 'N/A',
        competency: evidence.competency?.name || 'N/A',
        date: evidence.submittedAt
      });
    }

    if (includeTeacherFeedback && evidence.teacherFeedback) {
      evidence.teacherFeedback.forEach(feedback => {
        teacherFeedbacks.push({
          evidenceTitle: evidence.title,
          comment: feedback.comment,
          rating: feedback.rating,
          feedbackBy: feedback.feedbackBy?.name || feedback.feedbackBy_name,
          date: feedback.feedbackDate,
          authenticityApproved: feedback.authenticityApproved
        });
      });
    }
  });

  const totalEvidences = projectEvidences.length;
  const totalCompetencies = Object.keys(competenciesAchieved).length;
  const totalLearningAreas = Object.keys(learningAreasCovered).length;
  const averageRating = teacherFeedbacks.length > 0 
    ? teacherFeedbacks.reduce((sum, fb) => sum + fb.rating, 0) / teacherFeedbacks.length 
    : 0;

  const strengths = generateStrengths(competenciesAchieved, teacherFeedbacks, evidenceByType);
  const improvements = generateImprovements(competenciesAchieved, teacherFeedbacks, reflections);

  // Fetch certificates for the student
  let certificates = [];
  let awards = [];
  try {
    console.log(`Fetching certificates for student ID: ${studentId}`);
    const studentCertificates = await Certificate.find({ 
      studentId: studentId,
      status: 'Active'
    }).sort({ issueDate: -1 });
    
    console.log(`Found ${studentCertificates.length} total certificates (Active status) for student ${studentId}`);
    
    // Separate certificates and awards based on certificateType
    certificates = studentCertificates.filter(cert => 
      cert.certificateType && !['Awards', 'Recognitions'].includes(cert.certificateType)
    );
    
    awards = studentCertificates.filter(cert => 
      cert.certificateType && ['Awards', 'Recognitions'].includes(cert.certificateType)
    );
    
    console.log(`Separated into ${certificates.length} certificates and ${awards.length} awards for student ${studentId}`);
  } catch (error) {
    console.error('Error fetching certificates:', error);
    console.error('Error details:', error.message);
  }

  return {
    student: {
      _id: student._id,
      adm_no: student.adm_no,
      first_name: student.first_name,
      last_name: student.last_name,
      surname: student.surname,
      fullName: `${student.first_name} ${student.last_name} ${student.surname || ''}`.trim()
    },
    academicYear,
    term,
    generatedAt: new Date(),
    statistics: {
      totalEvidences,
      totalCompetencies,
      totalLearningAreas,
      averageRating: Math.round(averageRating * 10) / 10,
      evidenceByType,
      photoCount: evidenceByType.photo,
      videoCount: evidenceByType.video
    },
    competenciesAchieved: Object.values(competenciesAchieved),
    learningAreasCovered: Object.values(learningAreasCovered),
    reflections: reflections.slice(0, 10),
    teacherFeedbacks: teacherFeedbacks.slice(0, 15),
    strengths,
    improvements,
    projectEvidences: includeEvidence ? projectEvidences.map((ev) => ({
      _id: ev._id,
      title: ev.title,
      caption: ev.caption,
      description: ev.description,
      reflection: ev.reflection,
      evidenceType: ev.evidenceType,
      mediaUrl: ev.mediaUrl,
      thumbnailUrl: ev.thumbnailUrl,
      pci: ev.pci,
      competency: ev.competency ? { _id: ev.competency._id, name: ev.competency.name, code: ev.competency.code } : null,
      learningArea: ev.learningArea || null,
      submittedAt: ev.submittedAt,
      status: ev.status,
      googleDriveFiles: ev.googleDriveFiles || [],
      googleDriveUrl: ev.googleDriveUrl,
      googleDriveFileId: ev.googleDriveFileId,
      teacherFeedback: Array.isArray(ev.teacherFeedback) ? ev.teacherFeedback.map((fb) => ({
        comment: fb.comment,
        rating: fb.rating,
        authenticityApproved: fb.authenticityApproved,
        feedbackBy: fb.feedbackBy?.name || fb.feedbackBy_name,
        feedbackDate: fb.feedbackDate,
      })) : []
    })) : [],
    certificates: certificates,
    awards: awards,
    summaryInsights: {
      mostActiveLearningArea: Object.values(learningAreasCovered)
        .sort((a, b) => b.count - a.count)[0]?.learningArea?.name || 'N/A',
      topCompetency: Object.values(competenciesAchieved)
        .sort((a, b) => b.count - a.count)[0]?.competency?.name || 'N/A',
      recentActivity: projectEvidences.length > 0 ? projectEvidences[0].submittedAt : null
    }
  };
}

// Helper function to generate strengths
function generateStrengths(competenciesAchieved, teacherFeedbacks, evidenceByType) {
  const strengths = [];

  // Analyze competencies
  const topCompetencies = Object.values(competenciesAchieved)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  topCompetencies.forEach(comp => {
    strengths.push(`Demonstrates strong competency in ${comp.competency.name}`);
  });

  // Analyze teacher feedback
  const positiveFeedbacks = teacherFeedbacks.filter(fb => fb.rating >= 4);
  if (positiveFeedbacks.length > 0) {
    strengths.push("Receives consistently positive teacher feedback");
  }

  // Analyze evidence diversity
  if (evidenceByType.photo > 0 && evidenceByType.video > 0) {
    strengths.push("Shows versatility in presenting evidence through multiple media types");
  }

  // Analyze reflection quality
  const highRatedReflections = teacherFeedbacks.filter(fb => fb.rating >= 4.5);
  if (highRatedReflections.length > 0) {
    strengths.push("Demonstrates excellent reflective thinking and self-assessment");
  }

  return strengths.length > 0 ? strengths : ["Shows consistent engagement in learning activities"];
}

// Helper function to generate improvements
function generateImprovements(competenciesAchieved, teacherFeedbacks, reflections) {
  const improvements = [];

  // Analyze low ratings
  const lowRatedFeedbacks = teacherFeedbacks.filter(fb => fb.rating < 3);
  if (lowRatedFeedbacks.length > 0) {
    improvements.push("Focus on improving quality of submitted work based on teacher feedback");
  }

  // Analyze competency gaps
  const totalCompetencies = Object.keys(competenciesAchieved).length;
  if (totalCompetencies < 5) {
    improvements.push("Expand competency development across more learning areas");
  }

  // Analyze evidence diversity
  const totalEvidences = Object.values(competenciesAchieved)
    .reduce((sum, comp) => sum + comp.count, 0);
  
  if (totalEvidences < 10) {
    improvements.push("Increase frequency of evidence submission to demonstrate continuous learning");
  }

  // Analyze reflection depth
  const shortReflections = reflections.filter(ref => ref.reflection.length < 100);
  if (shortReflections.length > reflections.length * 0.5) {
    improvements.push("Develop more detailed and thoughtful reflections on learning experiences");
  }

  return improvements.length > 0 ? improvements : ["Continue current learning trajectory with focus on consistency"];
}

module.exports = {
  generatePortfolioSummaryNew,
  generatePortfolioPDF
};
