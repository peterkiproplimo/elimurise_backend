require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const PortalUser = require('./models/portal/auth/User');
const School = require('./models/portal/content/School');
const PortalRole = require('./models/portal/auth/roles');
const Level = require('./models/cms/content/level');
const Grade = require('./models/cms/content/grade');
const Teacher = require('./models/portal/content/Teacher');
const Parent = require('./models/portal/content/Parent');
const Learner = require('./models/portal/content/Learner');
const Stream = require('./models/portal/content/Stream');
const Enrollment = require('./models/portal/content/Enrollment');
const TransferRequest = require('./models/portal/content/Transfer');
const LearningArea = require('./models/cms/content/learning_area');
const crypto = require('crypto');

const seedPortalUser = async () => {
  try {
    // Connect to MongoDB
    const URL1 = "mongodb+srv://Safaribust:8R4NGbiciCMxCQX1@cluster0.yuiecha.mongodb.net/frontoffice?retryWrites=true&w=majority&appName=Cluster0";
    await mongoose.connect(URL1);
    console.log("Connected to MongoDB");

    // Portal user data
    const portalUserData = {
      firstname: "Super",
      lastname: "Admin",
      email: "superadmin@elimurise.com",
      phone: "+254700000000",
      password: "SuperAdmin@2024", // Change this to your desired password
      status: 1, // Active status
      verified: true,
      school_admin: true,
      agreedToTerms: true,
    };

    // Find or create a School
    let school = await School.findOne({ name: "Test School" });
    if (!school) {
      const currentDate = new Date();
      const startYear = currentDate.getFullYear();
      const current_session = `${startYear}`;
      
      school = await School.create({
        name: "Test School",
        county: "Nairobi",
        subcounty: "Westlands",
        numberOfLearners: 100,
        current_session: current_session,
        active: true, // IMPORTANT: School must be active for login to work
      });
      console.log("School created:", school.name);
    } else {
      // Ensure school is active
      if (!school.active) {
        school.active = true;
        await school.save();
        console.log("School activated:", school.name);
      } else {
        console.log("Using existing school:", school.name);
      }
    }

    // Find or create PortalRole (Super Admin)
    let role = await PortalRole.findOne({ name: "Super Admin" });
    if (!role) {
      // Create role with all permissions
      const modulePermissions = {
        meta: ['read', 'create', 'update', 'delete'],
        behaviour: ['read', 'create', 'update', 'delete'],
        'grading-scale': ['read', 'create', 'update', 'delete'],
        auth: ['read', 'create', 'update', 'delete'],
        subscription: ['read', 'create', 'update', 'delete'],
        teachers: ['read', 'create', 'update', 'delete'],
        learners: ['read', 'create', 'update', 'delete'],
        streams: ['read', 'create', 'update', 'delete'],
        enrollment: ['read', 'create', 'update', 'delete'],
        parents: ['read', 'create', 'update', 'delete'],
        assessment: ['read', 'create', 'update', 'delete'],
        'learning-areas': ['read', 'create', 'update', 'delete'],
        strand: ['read', 'create', 'update', 'delete'],
        substrand: ['read', 'create', 'update', 'delete'],
        users: ['read', 'create', 'update', 'delete'],
        roles: ['read', 'create', 'update', 'delete'],
        school: ['read', 'create', 'update', 'delete'],
        'grade-teacher-assignment': ['read', 'create', 'update', 'delete'],
        tests: ['read', 'create', 'update', 'delete'],
        'grading-system': ['read', 'create', 'update', 'delete'],
        summative: ['read', 'create', 'update', 'delete'],
        grades: ['read', 'create', 'update', 'delete'],
        dashboard: ['read', 'view-stats'],
        'transfer-requests': ['read', 'create', 'update', 'delete'],
        payments: ['read', 'create', 'process', 'delete'],
        comment: ['read', 'create', 'update', 'delete'],
      };

      role = await PortalRole.create({
        name: "Super Admin",
        permissions: modulePermissions,
      });
      console.log("PortalRole created: Super Admin");
    } else {
      console.log("Using existing PortalRole: Super Admin");
    }

    // Check if portal user already exists
    const existingUser = await PortalUser.findOne({ email: portalUserData.email });
    
    if (existingUser) {
      console.log("Portal user already exists with email:", portalUserData.email);
      console.log("Updating existing user...");
      
      // Hash password
      const hashedPassword = await bcrypt.hash(portalUserData.password, 12);
      
      // Update existing user
      existingUser.password = hashedPassword;
      existingUser.school = school._id;
      existingUser.role = role._id;
      existingUser.school_admin = true;
      existingUser.status = 1;
      existingUser.verified = true;
      existingUser.agreedToTerms = true;
      await existingUser.save();
      
      console.log("Portal user updated successfully!");
      console.log("Email:", portalUserData.email);
      console.log("Password:", portalUserData.password);
      console.log("School:", school.name);
    } else {
      // Hash password
      const hashedPassword = await bcrypt.hash(portalUserData.password, 12);
      
      // Create new portal user
      const portalUser = await PortalUser.create({
        ...portalUserData,
        password: hashedPassword,
        school: school._id,
        role: role._id,
      });
      
      console.log("Portal user created successfully!");
      console.log("Email:", portalUserData.email);
      console.log("Password:", portalUserData.password);
      console.log("User ID:", portalUser._id);
      console.log("School:", school.name);
      console.log("School Code:", school.schoolCode);
    }

    // Seed Levels and Grades
    console.log("\n=== Seeding Levels and Grades ===");
    
    // Define levels and their corresponding grades
    const levelsData = [
      {
        name: "Primary",
        grades: [
          { name: "Grade 1", level: 1 },
          { name: "Grade 2", level: 2 },
          { name: "Grade 3", level: 3 },
          { name: "Grade 4", level: 4 },
          { name: "Grade 5", level: 5 },
          { name: "Grade 6", level: 6 },
          { name: "Grade 7", level: 7 },
          { name: "Grade 8", level: 8 },
        ]
      },
      {
        name: "Secondary",
        grades: [
          { name: "Form 1", level: 1 },
          { name: "Form 2", level: 2 },
          { name: "Form 3", level: 3 },
          { name: "Form 4", level: 4 },
        ]
      },
      {
        name: "Pre-Primary",
        grades: [
          { name: "PP1", level: 1 },
          { name: "PP2", level: 2 },
        ]
      }
    ];

    const createdLevels = [];
    const createdGrades = [];

    for (const levelData of levelsData) {
      // Find or create level
      let level = await Level.findOne({ name: levelData.name });
      if (!level) {
        level = await Level.create({
          name: levelData.name,
          status: 1, // Active
        });
        console.log(`Level created: ${level.name}`);
        createdLevels.push(level);
      } else {
        // Ensure level is active
        if (level.status !== 1) {
          level.status = 1;
          await level.save();
          console.log(`Level activated: ${level.name}`);
        } else {
          console.log(`Using existing level: ${level.name}`);
        }
      }

      // Create grades for this level
      for (const gradeData of levelData.grades) {
        const gradeName = gradeData.name;
        let grade = await Grade.findOne({ name: gradeName });
        
        if (!grade) {
          grade = await Grade.create({
            level_id: level._id,
            name: gradeName,
            status: 1, // Active
            level: gradeData.level,
          });
          console.log(`  Grade created: ${gradeName} (Level: ${level.name})`);
          createdGrades.push(grade);
        } else {
          // Update grade if level_id doesn't match
          if (grade.level_id.toString() !== level._id.toString()) {
            grade.level_id = level._id;
            grade.status = 1;
            await grade.save();
            console.log(`  Grade updated: ${gradeName} (Level: ${level.name})`);
          } else if (grade.status !== 1) {
            grade.status = 1;
            await grade.save();
            console.log(`  Grade activated: ${gradeName}`);
          } else {
            console.log(`  Grade already exists: ${gradeName}`);
          }
        }
      }
    }

    const totalGrades = levelsData.reduce((sum, l) => sum + l.grades.length, 0);
    console.log(`\nSummary:`);
    console.log(`- Levels processed: ${levelsData.length}`);
    console.log(`- Total grades processed: ${totalGrades}`);

    // Seed Class Managers and Section Heads
    console.log("\n=== Seeding Class Managers and Section Heads ===");
    
    // Find or create Teacher role
    let teacherRole = await PortalRole.findOne({ name: "Teacher" });
    if (!teacherRole) {
      // Create Teacher role with appropriate permissions
      const teacherPermissions = {
        meta: ['read'],
        behaviour: ['read', 'create', 'update'],
        'grading-scale': ['read'],
        auth: ['read'],
        subscription: ['read'],
        teachers: ['read'],
        learners: ['read', 'create', 'update'],
        streams: ['read'],
        enrollment: ['read', 'create', 'update'],
        parents: ['read'],
        assessment: ['read', 'create', 'update', 'delete'],
        'learning-areas': ['read'],
        strand: ['read'],
        substrand: ['read'],
        users: ['read'],
        roles: ['read'],
        school: ['read'],
        'grade-teacher-assignment': ['read'],
        tests: ['read', 'create', 'update', 'delete'],
        'grading-system': ['read'],
        summative: ['read', 'create', 'update', 'delete'],
        grades: ['read'],
        dashboard: ['read', 'view-stats'],
        'transfer-requests': ['read'],
        payments: ['read'],
        comment: ['read', 'create', 'update', 'delete'],
        fees: ['read'],
      };

      teacherRole = await PortalRole.create({
        name: "Teacher",
        permissions: teacherPermissions,
      });
      console.log("PortalRole created: Teacher");
    } else {
      console.log("Using existing PortalRole: Teacher");
    }

    // Get some grades for assignment
    const primaryGrades = await Grade.find({ name: { $in: ["Grade 1", "Grade 2", "Grade 3"] } });
    const secondaryGrades = await Grade.find({ name: { $in: ["Form 1", "Form 2"] } });
    const allGrades = [...primaryGrades, ...secondaryGrades];

    // Define class managers and section heads
    const staffData = [
      {
        type: "class_manager",
        firstname: "John",
        lastname: "Manager",
        email: "classmanager1@elimurise.com",
        phone: "+254700000001",
        password: "ClassManager@2024",
        gender: "Male",
      },
      {
        type: "class_manager",
        firstname: "Jane",
        lastname: "Manager",
        email: "classmanager2@elimurise.com",
        phone: "+254700000002",
        password: "ClassManager@2024",
        gender: "Female",
      },
      {
        type: "section_head",
        firstname: "Peter",
        lastname: "Head",
        email: "sectionhead1@elimurise.com",
        phone: "+254700000003",
        password: "SectionHead@2024",
        gender: "Male",
      },
      {
        type: "section_head",
        firstname: "Mary",
        lastname: "Head",
        email: "sectionhead2@elimurise.com",
        phone: "+254700000004",
        password: "SectionHead@2024",
        gender: "Female",
      },
    ];

    const createdStaff = [];

    for (const staff of staffData) {
      // Create or find Teacher record
      let teacher = await Teacher.findOne({ email: staff.email });
      if (!teacher) {
        // Assign some grades to the teacher
        const assignedGrades = allGrades.slice(0, 2).map(g => g._id);
        
        teacher = await Teacher.create({
          school: school._id,
          firstname: staff.firstname,
          lastname: staff.lastname,
          email: staff.email,
          phone: staff.phone,
          gender: staff.gender,
          streams: assignedGrades,
          status: 1, // Active
        });
        console.log(`  Teacher created: ${staff.firstname} ${staff.lastname} (${staff.type})`);
      } else {
        // Update teacher if needed
        if (teacher.status !== 1) {
          teacher.status = 1;
          await teacher.save();
        }
        console.log(`  Using existing Teacher: ${staff.firstname} ${staff.lastname}`);
      }

      // Create or update PortalUser
      let portalUser = await PortalUser.findOne({ email: staff.email });
      const hashedPassword = await bcrypt.hash(staff.password, 12);

      if (!portalUser) {
        portalUser = await PortalUser.create({
          firstname: staff.firstname,
          lastname: staff.lastname,
          email: staff.email,
          phone: staff.phone,
          password: hashedPassword,
          school: school._id,
          role: teacherRole._id,
          teacher: teacher._id,
          status: 1,
          verified: true,
          school_admin: false,
          agreedToTerms: true,
        });
        console.log(`  PortalUser created: ${staff.firstname} ${staff.lastname} (${staff.type})`);
        console.log(`    Email: ${staff.email}`);
        console.log(`    Password: ${staff.password}`);
      } else {
        // Update existing user
        portalUser.password = hashedPassword;
        portalUser.school = school._id;
        portalUser.role = teacherRole._id;
        portalUser.teacher = teacher._id;
        portalUser.status = 1;
        portalUser.verified = true;
        portalUser.agreedToTerms = true;
        await portalUser.save();
        console.log(`  PortalUser updated: ${staff.firstname} ${staff.lastname} (${staff.type})`);
      }

      createdStaff.push({
        type: staff.type,
        name: `${staff.firstname} ${staff.lastname}`,
        email: staff.email,
        password: staff.password,
        userId: portalUser._id,
        teacherId: teacher._id,
      });
    }

    console.log(`\nStaff Summary:`);
    console.log(`- Class Managers created: ${createdStaff.filter(s => s.type === 'class_manager').length}`);
    console.log(`- Section Heads created: ${createdStaff.filter(s => s.type === 'section_head').length}`);
    console.log(`- Total staff: ${createdStaff.length}`);

    // Seed Parents
    console.log("\n=== Seeding Parents ===");
    
    // Define parent data
    const parentsData = [
      {
        first_name: "David",
        surname: "Mwangi",
        last_name: "Kamau",
        email: "parent1@elimurise.com",
        phone: "+254700000101",
        password: "Parent@2024",
        gender: "Male",
        id_no: "12345678",
      },
      {
        first_name: "Sarah",
        surname: "Wanjiku",
        last_name: "Njoroge",
        email: "parent2@elimurise.com",
        phone: "+254700000102",
        password: "Parent@2024",
        gender: "Female",
        id_no: "12345679",
      },
      {
        first_name: "James",
        surname: "Ochieng",
        last_name: "Onyango",
        email: "parent3@elimurise.com",
        phone: "+254700000103",
        password: "Parent@2024",
        gender: "Male",
        id_no: "12345680",
      },
      {
        first_name: "Grace",
        surname: "Achieng",
        last_name: "Omondi",
        email: "parent4@elimurise.com",
        phone: "+254700000104",
        password: "Parent@2024",
        gender: "Female",
        id_no: "12345681",
      },
      {
        first_name: "Michael",
        surname: "Kipchoge",
        last_name: "Rono",
        email: "parent5@elimurise.com",
        phone: "+254700000105",
        password: "Parent@2024",
        gender: "Male",
        id_no: "12345682",
      },
    ];

    const createdParents = [];

    for (const parentData of parentsData) {
      // Check if parent already exists
      let parent = await Parent.findOne({ 
        email: parentData.email,
        school: school._id 
      });
      
      const hashedPassword = await bcrypt.hash(parentData.password, 10);

      if (!parent) {
        parent = await Parent.create({
          school: school._id,
          schoolCode: school.schoolCode,
          first_name: parentData.first_name,
          surname: parentData.surname,
          last_name: parentData.last_name,
          email: parentData.email,
          phone: parentData.phone,
          password: hashedPassword,
          gender: parentData.gender,
          id_no: parentData.id_no,
          verified: true,
          status: 1, // Active
        });
        console.log(`  Parent created: ${parentData.first_name} ${parentData.surname || parentData.last_name || ''}`);
        console.log(`    Email: ${parentData.email}`);
        console.log(`    Password: ${parentData.password}`);
      } else {
        // Update existing parent
        parent.password = hashedPassword;
        parent.school = school._id;
        parent.schoolCode = school.schoolCode;
        parent.status = 1;
        parent.verified = true;
        await parent.save();
        console.log(`  Parent updated: ${parentData.first_name} ${parentData.surname || parentData.last_name || ''}`);
      }

      createdParents.push({
        name: `${parentData.first_name} ${parentData.surname || parentData.last_name || ''}`,
        email: parentData.email,
        password: parentData.password,
        parentId: parent._id,
      });
    }

    console.log(`\nParents Summary:`);
    console.log(`- Total parents created/updated: ${createdParents.length}`);

    // Seed Learners
    console.log("\n=== Seeding Learners ===");
    
    // Get all parents from database
    const allParents = await Parent.find({ school: school._id });
    if (allParents.length === 0) {
      console.log("  No parents found. Skipping learner seeding.");
    } else {
      // Get class managers for streams
      const classManagers = await PortalUser.find({ 
        school: school._id, 
        school_admin: false 
      }).limit(2);
      
      if (classManagers.length < 2) {
        console.log("  Warning: Need at least 2 staff members for streams. Creating streams with available staff.");
      }

      // Get some grades for creating streams
      const grade1 = await Grade.findOne({ name: "Grade 1" });
      const grade2 = await Grade.findOne({ name: "Grade 2" });
      const grade3 = await Grade.findOne({ name: "Grade 3" });
      const form1 = await Grade.findOne({ name: "Form 1" });
      
      const gradesForStreams = [grade1, grade2, grade3, form1].filter(g => g !== null);
      
      // Create streams if they don't exist
      const streams = [];
      for (let i = 0; i < gradesForStreams.length; i++) {
        const grade = gradesForStreams[i];
        const streamName = `Stream ${String.fromCharCode(65 + i)}`; // A, B, C, D
        
        let stream = await Stream.findOne({ 
          school: school._id, 
          grade: grade._id, 
          name: streamName 
        });
        
        if (!stream) {
          // Use class managers, or reuse if not enough
          const classManager = classManagers[i % classManagers.length] || classManagers[0];
          const sectionHead = classManagers[(i + 1) % classManagers.length] || classManagers[0];
          
          stream = await Stream.create({
            school: school._id,
            grade: grade._id,
            name: streamName,
            class_manager: classManager._id,
            section_head: sectionHead._id,
            status: 1, // Active
          });
          console.log(`  Stream created: ${streamName} (Grade: ${grade.name})`);
        } else {
          console.log(`  Using existing stream: ${streamName} (Grade: ${grade.name})`);
        }
        streams.push(stream);
      }

      // Get current session
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const current_session = `${currentYear}`;

      // Define learner data
      const learnersData = [
        {
          first_name: "Emma",
          surname: "Mwangi",
          last_name: "Kamau",
          adm_no: "ADM001",
          gender: "Female",
          dateOfBirth: new Date(2015, 5, 15),
          guardian_relationship: "Father",
        },
        {
          first_name: "Brian",
          surname: "Wanjiku",
          last_name: "Njoroge",
          adm_no: "ADM002",
          gender: "Male",
          dateOfBirth: new Date(2016, 3, 20),
          guardian_relationship: "Mother",
        },
        {
          first_name: "Cynthia",
          surname: "Ochieng",
          last_name: "Onyango",
          adm_no: "ADM003",
          gender: "Female",
          dateOfBirth: new Date(2015, 8, 10),
          guardian_relationship: "Father",
        },
        {
          first_name: "Daniel",
          surname: "Achieng",
          last_name: "Omondi",
          adm_no: "ADM004",
          gender: "Male",
          dateOfBirth: new Date(2014, 11, 5),
          guardian_relationship: "Mother",
        },
        {
          first_name: "Faith",
          surname: "Kipchoge",
          last_name: "Rono",
          adm_no: "ADM005",
          gender: "Female",
          dateOfBirth: new Date(2016, 1, 25),
          guardian_relationship: "Father",
        },
        {
          first_name: "George",
          surname: "Mwangi",
          last_name: "Kamau",
          adm_no: "ADM006",
          gender: "Male",
          dateOfBirth: new Date(2013, 7, 12),
          guardian_relationship: "Guardian",
        },
        {
          first_name: "Hannah",
          surname: "Wanjiku",
          last_name: "Njoroge",
          adm_no: "ADM007",
          gender: "Female",
          dateOfBirth: new Date(2015, 4, 18),
          guardian_relationship: "Mother",
        },
        {
          first_name: "Ian",
          surname: "Ochieng",
          last_name: "Onyango",
          adm_no: "ADM008",
          gender: "Male",
          dateOfBirth: new Date(2014, 9, 30),
          guardian_relationship: "Father",
        },
      ];

      const createdLearners = [];

      for (let i = 0; i < learnersData.length; i++) {
        const learnerData = learnersData[i];
        
        // Assign parent (round-robin)
        const parent = allParents[i % allParents.length];
        
        // Assign stream (round-robin)
        const stream = streams[i % streams.length];
        // Get the grade from the stream's grade reference
        const grade = await Grade.findById(stream.grade);

        // Check if learner already exists
        let learner = await Learner.findOne({ 
          adm_no: learnerData.adm_no,
          school: school._id 
        });

        if (!learner) {
          learner = await Learner.create({
            school: school._id,
            current_session: current_session,
            grade: grade._id,
            stream: stream._id,
            first_name: learnerData.first_name,
            surname: learnerData.surname,
            last_name: learnerData.last_name,
            adm_no: learnerData.adm_no,
            gender: learnerData.gender,
            dateOfBirth: learnerData.dateOfBirth,
            guardian: parent._id,
            guardian_relationship: learnerData.guardian_relationship,
            status: 'P', // Present
            year_admitted: current_session,
          });

          // Create enrollment
          await Enrollment.create({
            school: school._id,
            learner: learner._id,
            to_grade: grade._id,
            to_stream: stream._id,
            to_session: current_session,
            grad: 0,
            status: 'P',
          });

          console.log(`  Learner created: ${learnerData.first_name} ${learnerData.surname || learnerData.last_name || ''} (${learnerData.adm_no})`);
          console.log(`    Grade: ${grade.name || 'N/A'}, Stream: ${stream.name}, Guardian: ${parent.first_name}`);
        } else {
          // Update existing learner
          learner.grade = grade._id;
          learner.stream = stream._id;
          learner.guardian = parent._id;
          learner.guardian_relationship = learnerData.guardian_relationship;
          learner.current_session = current_session;
          await learner.save();
          console.log(`  Learner updated: ${learnerData.first_name} ${learnerData.surname || learnerData.last_name || ''} (${learnerData.adm_no})`);
        }

        createdLearners.push({
          name: `${learnerData.first_name} ${learnerData.surname || learnerData.last_name || ''}`,
          adm_no: learnerData.adm_no,
          learnerId: learner._id,
        });
      }

      console.log(`\nLearners Summary:`);
      console.log(`- Streams available: ${streams.length}`);
      console.log(`- Total learners created/updated: ${createdLearners.length}`);

      // Seed Student Promotions, Inactive, Exited, and Transfer Management
      console.log("\n=== Seeding Student Promotions, Inactive, Exited, and Transfers ===");
      
      // Get all learners
      const allLearners = await Learner.find({ school: school._id });
      if (allLearners.length === 0) {
        console.log("  No learners found. Skipping promotion/inactive/exited/transfer seeding.");
      } else {
        // Get class managers for streams (reuse from earlier)
        const staffForStreams = await PortalUser.find({ 
          school: school._id, 
          school_admin: false 
        }).limit(2);
        
        // Get more grades for promotions
        const grade4 = await Grade.findOne({ name: "Grade 4" });
        const grade5 = await Grade.findOne({ name: "Grade 5" });
        const form2 = await Grade.findOne({ name: "Form 2" });
        
        // Get streams for higher grades
        let streamGrade4, streamGrade5, streamForm2;
        if (grade4) {
          streamGrade4 = await Stream.findOne({ school: school._id, grade: grade4._id });
          if (!streamGrade4 && staffForStreams.length > 0) {
            streamGrade4 = await Stream.create({
              school: school._id,
              grade: grade4._id,
              name: "Stream A",
              class_manager: staffForStreams[0]._id,
              section_head: staffForStreams[1]?._id || staffForStreams[0]._id,
              status: 1,
            });
          }
        }
        if (grade5) {
          streamGrade5 = await Stream.findOne({ school: school._id, grade: grade5._id });
          if (!streamGrade5 && staffForStreams.length > 0) {
            streamGrade5 = await Stream.create({
              school: school._id,
              grade: grade5._id,
              name: "Stream A",
              class_manager: staffForStreams[0]._id,
              section_head: staffForStreams[1]?._id || staffForStreams[0]._id,
              status: 1,
            });
          }
        }
        if (form2) {
          streamForm2 = await Stream.findOne({ school: school._id, grade: form2._id });
          if (!streamForm2 && staffForStreams.length > 0) {
            streamForm2 = await Stream.create({
              school: school._id,
              grade: form2._id,
              name: "Stream A",
              class_manager: staffForStreams[0]._id,
              section_head: staffForStreams[1]?._id || staffForStreams[0]._id,
              status: 1,
            });
          }
        }

        const previousYear = (currentYear - 1).toString();
        const nextYear = (currentYear + 1).toString();

        // 1. Student Promotions - Promote some students to next grade
        console.log("\n  Creating Student Promotions...");
        const promotionCount = Math.min(3, allLearners.length);
        for (let i = 0; i < promotionCount; i++) {
          const learner = allLearners[i];
          const currentGrade = await Grade.findById(learner.grade);
          const currentStream = await Stream.findById(learner.stream);
          
          // Find next grade (e.g., Grade 1 -> Grade 2, Grade 2 -> Grade 3)
          let nextGrade, nextStream;
          if (currentGrade) {
            if (currentGrade.name === "Grade 1" && grade2) {
              nextGrade = grade2;
              nextStream = streams.find(s => s.grade.toString() === grade2._id.toString()) || streams[1];
            } else if (currentGrade.name === "Grade 2" && grade3) {
              nextGrade = grade3;
              nextStream = streams.find(s => s.grade.toString() === grade3._id.toString()) || streams[2];
            } else if (currentGrade.name === "Grade 3" && streamGrade4) {
              nextGrade = grade4;
              nextStream = streamGrade4;
            } else if (currentGrade.name === "Form 1" && streamForm2) {
              nextGrade = form2;
              nextStream = streamForm2;
            }
          }

          if (nextGrade && nextStream) {
            // Check if promotion enrollment already exists
            const existingPromotion = await Enrollment.findOne({
              learner: learner._id,
              school: school._id,
              to_grade: nextGrade._id,
              to_stream: nextStream._id,
            });

            if (!existingPromotion) {
              // Create promotion enrollment
              const promotionEnrollment = await Enrollment.create({
                school: school._id,
                learner: learner._id,
                from_grade: learner.grade,
                from_stream: learner.stream,
                to_grade: nextGrade._id,
                to_stream: nextStream._id,
                from_session: previousYear,
                to_session: currentYear.toString(),
                grad: 0,
                status: 'P',
              });

              // Update learner to promoted grade
              learner.grade = nextGrade._id;
              learner.stream = nextStream._id;
              learner.current_session = currentYear.toString();
              await learner.save();

              console.log(`    Promoted: ${learner.first_name} from ${currentGrade?.name} to ${nextGrade.name}`);
            } else {
              console.log(`    Promotion already exists for: ${learner.first_name}`);
            }
          }
        }

        // 2. Inactive Students (Left) - Set status to 'L'
        console.log("\n  Creating Inactive Students (Left)...");
        const inactiveStartIndex = promotionCount;
        const inactiveCount = Math.min(2, allLearners.length - inactiveStartIndex);
        for (let i = inactiveStartIndex; i < inactiveStartIndex + inactiveCount; i++) {
          if (i >= allLearners.length) break;
          const learner = allLearners[i];
          
          learner.status = 'L';
          learner.left_date = new Date(currentYear - 1, 5, 30); // Left at end of previous year
          await learner.save();
          
          console.log(`    Inactive (Left): ${learner.first_name} ${learner.surname || learner.last_name || ''} (${learner.adm_no})`);
        }

        // 3. Exited Students - Set status to 'D' (Dropped) or 'G' (Graduated)
        console.log("\n  Creating Exited Students...");
        const exitedStartIndex = inactiveStartIndex + inactiveCount;
        const exitedCount = Math.min(2, allLearners.length - exitedStartIndex);
        for (let i = exitedStartIndex; i < exitedStartIndex + exitedCount; i++) {
          if (i >= allLearners.length) break;
          const learner = allLearners[i];
          const currentGrade = await Grade.findById(learner.grade);
          
          // If in Form 4 or Grade 8, mark as Graduated, otherwise as Dropped
          if (currentGrade && (currentGrade.name === "Form 4" || currentGrade.name === "Grade 8")) {
            learner.status = 'G';
            learner.grad_date = new Date(currentYear - 1, 11, 15); // Graduated end of previous year
            console.log(`    Exited (Graduated): ${learner.first_name} ${learner.surname || learner.last_name || ''} (${learner.adm_no})`);
          } else {
            learner.status = 'D';
            learner.left_date = new Date(currentYear - 1, 2, 15); // Dropped mid-year
            console.log(`    Exited (Dropped): ${learner.first_name} ${learner.surname || learner.last_name || ''} (${learner.adm_no})`);
          }
          await learner.save();
        }

        // 4. Transfer Management - Create transfer requests
        console.log("\n  Creating Transfer Requests...");
        
        // Create another school for transfers (or use existing if available)
        let transferSchool = await School.findOne({ name: { $ne: school.name } });
        if (!transferSchool) {
          const transferSchoolCode = crypto.randomBytes(4).toString('hex').toUpperCase();
          transferSchool = await School.create({
            name: "Transfer Destination School",
            county: "Nairobi",
            subcounty: "Eastlands",
            numberOfLearners: 50,
            current_session: currentYear.toString(),
            active: true,
            schoolCode: transferSchoolCode,
          });
          console.log(`    Created transfer destination school: ${transferSchool.name} (Code: ${transferSchoolCode})`);
        }

        const transferStartIndex = exitedStartIndex + exitedCount;
        const transferCount = Math.min(2, allLearners.length - transferStartIndex);
        const superAdminUser = await PortalUser.findOne({ email: portalUserData.email });
        
        for (let i = transferStartIndex; i < transferStartIndex + transferCount; i++) {
          if (i >= allLearners.length) break;
          const learner = allLearners[i];
          
          // Only create transfer for active students and if not already exists
          if (learner.status === 'P') {
            const existingTransfer = await TransferRequest.findOne({ learner: learner._id });
            if (!existingTransfer) {
              const transferCode = crypto.randomBytes(8).toString('hex').toUpperCase();
              
              const transferRequest = await TransferRequest.create({
                learner: learner._id,
                oldSchool: school._id,
                newSchool: transferSchool._id,
                reason: "Family relocation",
                transferCode: transferCode,
                paymentStatus: i % 2 === 0 ? 'Paid' : 'Pending',
                approvalStatus: i % 2 === 0 ? 'Approved' : 'Pending',
                approvedBy: i % 2 === 0 ? superAdminUser?._id : undefined,
                approvalDate: i % 2 === 0 ? new Date() : undefined,
              });

              console.log(`    Transfer Request: ${learner.first_name} ${learner.surname || learner.last_name || ''} (Code: ${transferCode}, Status: ${transferRequest.approvalStatus})`);
            } else {
              console.log(`    Transfer Request already exists for: ${learner.first_name} ${learner.surname || learner.last_name || ''}`);
            }
          }
        }

        console.log(`\n  Summary:`);
        console.log(`    - Promoted students: ${promotionCount}`);
        console.log(`    - Inactive students (Left): ${inactiveCount}`);
        console.log(`    - Exited students: ${exitedCount}`);
        console.log(`    - Transfer requests: ${transferCount}`);
      }
    }

    // Seed Learning Areas
    console.log("\n=== Seeding Learning Areas ===");
    
    // Get all grades
    const allGradesForLearningAreas = await Grade.find({ status: 1 });
    
    if (allGradesForLearningAreas.length === 0) {
      console.log("  No grades found. Skipping learning area seeding.");
    } else {
      // Define common learning areas for primary and secondary
      const primaryLearningAreas = [
        { name: "Mathematics", short_name: "Math", lessons: 5, compulsory: true },
        { name: "English", short_name: "Eng", lessons: 5, compulsory: true },
        { name: "Kiswahili", short_name: "Kisw", lessons: 4, compulsory: true },
        { name: "Science", short_name: "Sci", lessons: 4, compulsory: true },
        { name: "Social Studies", short_name: "SST", lessons: 3, compulsory: true },
        { name: "Religious Education", short_name: "RE", lessons: 2, compulsory: true },
        { name: "Creative Arts", short_name: "CA", lessons: 2, compulsory: false },
        { name: "Physical Education", short_name: "PE", lessons: 2, compulsory: false },
        { name: "Agriculture", short_name: "Agric", lessons: 2, compulsory: false },
      ];

      const secondaryLearningAreas = [
        { name: "Mathematics", short_name: "Math", lessons: 6, compulsory: true },
        { name: "English", short_name: "Eng", lessons: 5, compulsory: true },
        { name: "Kiswahili", short_name: "Kisw", lessons: 4, compulsory: true },
        { name: "Biology", short_name: "Bio", lessons: 4, compulsory: true },
        { name: "Chemistry", short_name: "Chem", lessons: 4, compulsory: true },
        { name: "Physics", short_name: "Phy", lessons: 4, compulsory: true },
        { name: "History", short_name: "Hist", lessons: 3, compulsory: true },
        { name: "Geography", short_name: "Geo", lessons: 3, compulsory: true },
        { name: "Business Studies", short_name: "BS", lessons: 3, compulsory: false },
        { name: "Computer Studies", short_name: "CS", lessons: 2, compulsory: false },
        { name: "Religious Education", short_name: "RE", lessons: 2, compulsory: false },
        { name: "Physical Education", short_name: "PE", lessons: 2, compulsory: false },
      ];

      const prePrimaryLearningAreas = [
        { name: "Language Activities", short_name: "Lang", lessons: 5, compulsory: true },
        { name: "Mathematical Activities", short_name: "Math", lessons: 4, compulsory: true },
        { name: "Environmental Activities", short_name: "Env", lessons: 3, compulsory: true },
        { name: "Psychomotor Activities", short_name: "Psych", lessons: 3, compulsory: true },
        { name: "Creative Activities", short_name: "Creative", lessons: 2, compulsory: false },
        { name: "Religious Education", short_name: "RE", lessons: 1, compulsory: false },
      ];

      let createdLearningAreas = 0;
      let updatedLearningAreas = 0;

      for (const grade of allGradesForLearningAreas) {
        // Determine which learning areas to use based on grade level
        let learningAreasToUse = [];
        const gradeName = grade.name.toLowerCase();
        
        if (gradeName.includes('pp') || gradeName.includes('pre')) {
          learningAreasToUse = prePrimaryLearningAreas;
        } else if (gradeName.includes('form')) {
          learningAreasToUse = secondaryLearningAreas;
        } else {
          // Primary grades (Grade 1-8)
          learningAreasToUse = primaryLearningAreas;
        }

        for (const learningAreaData of learningAreasToUse) {
          // Check if learning area already exists for this grade
          let learningArea = await LearningArea.findOne({
            name: learningAreaData.name,
            grade_id: grade._id,
          });

          if (!learningArea) {
            learningArea = await LearningArea.create({
              grade_id: grade._id,
              name: learningAreaData.name,
              short_name: learningAreaData.short_name,
              no_of_lessons_per_week: learningAreaData.lessons,
              is_compulsory: learningAreaData.compulsory,
              status: 1, // Active
              description: `${learningAreaData.name} for ${grade.name}`,
            });
            createdLearningAreas++;
            console.log(`  Learning Area created: ${learningAreaData.name} (${grade.name})`);
          } else {
            // Update existing learning area
            learningArea.no_of_lessons_per_week = learningAreaData.lessons;
            learningArea.is_compulsory = learningAreaData.compulsory;
            learningArea.status = 1;
            await learningArea.save();
            updatedLearningAreas++;
            console.log(`  Learning Area updated: ${learningAreaData.name} (${grade.name})`);
          }
        }
      }

      console.log(`\nLearning Areas Summary:`);
      console.log(`- Total learning areas created: ${createdLearningAreas}`);
      console.log(`- Total learning areas updated: ${updatedLearningAreas}`);
      console.log(`- Total learning areas processed: ${createdLearningAreas + updatedLearningAreas}`);
    }

    // Close the connection
    await mongoose.connection.close();
    console.log("\nConnection closed.");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding portal user:", error.message);
    console.error(error);
    if (error.code === 11000) {
      console.error("Duplicate key error - user with this email already exists");
    }
    await mongoose.connection.close();
    process.exit(1);
  }
};

// Run the seeder
seedPortalUser();

