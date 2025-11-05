const express = require('express');
const router = express.Router();
const TeacherService = require('../../../services/portal/TeachersService');
const UserService = require('../../../services/portal/UserService');
const mongoose = require('mongoose');
const multer = require('multer');
const path = require('path');

const csvParser = require('csv-parser');
const fs = require('fs');
const {checkPermission} = require('../../../middleware/portal-auth');
const Role = require('../../../models/cms/auth/roles');
const PortalRole = require('../../../models/portal/auth/roles');
const {Parser} = require('json2csv');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, '/elimurise/'); // specify the destination directory
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + path.extname(file.originalname)); // set the file name
  },
});

const importData = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    const filetypes = /csv/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb('Error: CSV Only!');
    }
  },
});
const teacherService = new TeacherService();
const userService = new UserService();
// GET endpoint to fetch teachers
router.get('/', checkPermission('teachers', 'read'), async (req, res) => {
  try {
    const {page, limit, search, sortField, sortOrder} = req.query;
    // const sortDirection = sortOrder === 'desc' ? -1 : 1; // Default to ascending

    const query = {
      $or: [
        {firstname: {$regex: new RegExp(search, 'i')}},
        {lastname: {$regex: new RegExp(search, 'i')}},
        {surname: {$regex: new RegExp(search, 'i')}},
        {email: {$regex: new RegExp(search, 'i')}},
      ],
    };

    query.school = req.user.school;

    console.log('Query:', query);

    const teachers = await teacherService.getTeachers(page, limit, query, sortField, sortOrder);
    res.json(teachers);
  } catch (error) {
    res.status(404).json({error: error.message});
  }
});

function generateRandomPassword(length) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  return 'Elimurise@2025';
}
// POST endpoint to create a new teacher
router.post('/', checkPermission('teachers', 'create'), async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    let school = req?.user?.school._id;

    const teacherData = {...req.body, school: school};
    const teacher = await teacherService.createTeacher(teacherData, session);
    // const password = generateRandomPassword(8);
    const password = teacherData.firstname + '@2025';
    // console.log(teacher._id);
    const userExist = await userService.findByEmail(school, teacherData.email);
    // console.log(userExist);
    if (!userExist) {
      const user = await userService.createUser({
        ...teacherData,
        school: school,
        teacher: teacher._id,
        password,
        school_admin: false,
        role: req.body.role,
      });
    }
    // console.log(user);
    await session.commitTransaction();
    session.endSession();
    return res.status(201).json({data: teacher, message: 'Teacher created successfully'});
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(404).json({error: error.message});
  }
});
router.get('/:id', checkPermission('teachers', 'read'), async (req, res) => {
  try {
    let school = req?.user?.school._id;

    const {id} = req.params;
    const teacher = await teacherService.getTeacher(id, school);
    return res.json({data: teacher, message: 'Teacher retrieved successfully'});
  } catch (error) {
    res.status(404).json({error: error.message});
  }
});

// PUT endpoint to update an existing teacher
router.put('/:id', checkPermission('teachers', 'update'), async (req, res) => {
  try {
    const {id} = req.params;
    let school = req?.user?.school._id;

    const teacher = await teacherService.updateTeacher(id, req.body, school);
    res.json({data: teacher, message: 'Teacher Updated successfully'});
  } catch (error) {
    res.status(404).json({error: error.message});
  }
});

// DELETE endpoint to delete a teacher
router.delete('/:id', checkPermission('teachers', 'delete'), async (req, res) => {
  try {
    const {id} = req.params;
    let school = req?.user?.school._id;

    const deletedTeacher = await teacherService.deleteTeacher(id, school);
    res.json({data: deletedTeacher, message: 'Teacher Deleted successfully'});
  } catch (error) {
    res.status(404).json({error: error.message});
  }
});

router.post('/import', checkPermission('teachers', 'bulky-import'), importData.single('csvFile'), (req, res) => {
  if (!req.file) {
    return res.status(404).json({success: false, error: 'No file uploaded'});
  }

  let school = req?.school;

  let current_session = req?.current_session;

  const teachers = [];
  const errors = [];
  const filePath = req.file.path;
  fs.createReadStream(filePath)
    .pipe(csvParser({skipLines: 0}))
    .on('data', async data => {
      if (data['First Name'] && data['Surname'] && data['Email'] && data['ID Number'] && data['Phone Number']) {
        try {
          const teacher = {
            school: school,
            firstname: data['First Name'],
            surname: data['Surname'],
            lastname: data['Last Name'],
            email: data['Email'],
            phone: data['Phone Number'],
            id_no: data['ID Number'],
            // Add more fields as needed
          };
          //ss
          teachers.push(teacher);
        } catch (error) {
          console.error('Error processing row:', error.message);
          errors.push({data, error: error.message});
        }
      } else {
        console.error('Error processing row:');
      }
    })
    .on('end', async () => {
      fs.unlinkSync(filePath); // Delete the uploaded file after processing

      try {
        const insertedTeahers = await Promise.all(
          teachers.map(async teacher => {
            try {
              // Check if the parent already exists by email
              const userExist = await userService.findByEmail(school, teacher.email);

              if (userExist) {
                throw new Error(`Teacher with email "${teacher.email}" already exists.`);
              }
              const password = generateRandomPassword(8);

              const role = await PortalRole.findOne({name: 'Facilitator'});
              if (!userExist) {
                const user = await userService.createUser({
                  ...teacher,
                  school: school,
                  teacher: teacher._id,
                  password,
                  school_admin: false,
                  role: role?._id,
                });
              }

              // Create new parent
              return await teacherService.createTeacher(teacher);
            } catch (error) {
              console.log(error);
              errors.push({teacher: teacher, error: error.message});
              return null;
            }
          }),
        );

        const filteredTeahers = insertedTeahers.filter(parent => parent !== null);
        res.json({success: true, data: filteredTeahers, errors});
      } catch (error) {
        console.error('Error inserting teahers into the database:', error);
        res.status(404).json({success: false, error: 'Error inserting data into the database'});
      }
    });
});

// router.post('/export', checkPermission('teachers', 'bulky-import'), (req, res) => {
//   try {
//     // Simulate an empty array (as if no records exist)
//     const exportData = [];

//     // Prepare the columns for CSV export (no data)
//     const headers = 'First Name,Surname,Last Name,Email,Phone Number,ID Number';

//     // Convert the empty data to CSV format
//     // const json2csvParser = new Parser({fields: headers});
//     // const csvData = json2csvParser.parse(exportData);

//     // Set the response headers for file download
//     res.header('Content-Type', 'text/csv');
//     res.attachment('teahers_data.csv'); // File name to be downloaded as

//     // Send the CSV file with just headers (no records)
//     res.send(headers);
//   } catch (error) {
//     console.error('Error exporting parent data:', error);
//     res.status(404).json({success: false, error: 'Error exporting parent data'});
//   }
// });
router.post('/export', checkPermission('teachers', 'bulky-import'), async (req, res) => {
  try {
    const school = req?.school;

    // Fetch all teachers from the database
    const teachers = await teacherService.getAllTeachers(school);

    if (!teachers.length) {
      return res.status(404).json({success: false, error: 'No teachers found'});
    }

    // Prepare CSV headers and map teacher data
    const fields = ['First Name', 'Surname', 'Last Name', 'Email', 'Phone Number', 'ID Number'];
    const csvFields = ['firstname', 'surname', 'lastname', 'email', 'phone', 'id_no'];

    // Format data for CSV
    const csvData = teachers.map(teacher => ({
      'First Name': teacher.firstname,
      Surname: teacher.surname,
      'Last Name': teacher.lastname,
      Email: teacher.email,
      'Phone Number': teacher.phone,
      'ID Number': teacher.id_no,
    }));

    // Convert JSON to CSV
    const json2csvParser = new Parser({fields});
    const csv = json2csvParser.parse(csvData);

    // Set response headers for file download
    res.header('Content-Type', 'text/csv');
    res.attachment('teachers_data.csv');

    res.send(csv);
  } catch (error) {
    console.error('Error exporting teacher data:', error);
    res.status(500).json({success: false, error: 'Error exporting teacher data'});
  }
});

module.exports = router;
