const express = require('express');
const router = express.Router();
const _ = require('lodash');
const Product = require('../../models/frontoffice/Product');
const ProductStat = require('../../models/frontoffice/ProductStat');
const Enquiry = require('../../models/frontoffice/Enquiry');
const Transaction = require('../../models/frontoffice/Transaction');

// GET /products - Get Products
router.get('/products', async (_, res) => {
  try {
    const products = await Product.find();
    const productsWithStats = await Promise.all(
      products.map(async (product) => {
        const stat = await ProductStat.find({
          productId: product._id,
        });

        return {
          ...product._doc,
          stat,
        };
      })
    );

    res.status(200).json(productsWithStats);
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

// POST /enquiries - Create Enquiry
router.post('/enquiries', async (req, res) => {
  try {
    const {
      enquiryType,
      studentName,
      dateOfBirth,
      gender,
      gradeInterested,
      parentName,
      relationship,
      phoneNumber,
      email,
    } = req.body;

    // ✅ Validate required fields
    if (!enquiryType || !studentName || !dateOfBirth || !gender || !phoneNumber || !gradeInterested || !parentName || !relationship) {
      return res.status(400).json({
        message: "Please fill in all required fields: subject, description, reporter name, and contact.",
      });
    }

    // ✅ Create new enquiry
    const newEnquiry = new Enquiry({
        enquiryType,
        studentName,
        dateOfBirth,
        gender,
        gradeInterested,
        parentName,
        relationship,
        phoneNumber,
        email,
    });

    await newEnquiry.save();

    res.status(201).json({
      message: "Enquiry created successfully.",
      enquiry: newEnquiry,
    });
  
  } catch (error) {
    console.error("Error creating enquiry:", error);
    res.status(500).json({
      message: "An error occurred while creating the enquiry.",
      error: error.message,
    });
  }
});

// PUT /enquiries/:id - Update Enquiry by ID
router.put('/enquiries/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    console.log('Updating enquiry with ID:', id);
    console.log('Update data:', updateData);

    // Find and update the enquiry
    const updatedEnquiry = await Enquiry.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!updatedEnquiry) {
      return res.status(404).json({
        message: "Enquiry not found",
      });
    }

    res.status(200).json({
      message: "Enquiry updated successfully",
      enquiry: updatedEnquiry,
    });

  } catch (error) {
    console.error("Error updating enquiry:", error);
    res.status(500).json({
      message: "An error occurred while updating the enquiry.",
      error: error.message,
    });
  }
});

// DELETE /enquiries/:id - Delete Enquiry
router.delete('/enquiries/:id', async (req, res) => {
  try {
    const { id } = req.params;

    console.log('Deleting enquiry with ID:', id);

    // Find and delete the enquiry
    const deletedEnquiry = await Enquiry.findByIdAndDelete(id);

    if (!deletedEnquiry) {
      return res.status(404).json({
        message: "Enquiry not found",
      });
    }

    res.status(200).json({
      message: "Enquiry deleted successfully",
      enquiry: deletedEnquiry,
    });

  } catch (error) {
    console.error("Error deleting enquiry:", error);
    res.status(500).json({
      message: "An error occurred while deleting the enquiry.",
      error: error.message,
    });
  }
});

// GET /enquiries - Get Enquiries
router.get('/enquiries', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = "", 
      grade = "", 
      stream = "", 
      sortField = "createdAt", 
      sortOrder = "desc",
      status = [],
      source = ""
    } = req.query;

    // Build query object
    let query = {};

    // Add search functionality
    if (search) {
      console.log("Search term:", search);
      query.$or = [
        { studentName: { $regex: search, $options: "i" } },
        { parentName: { $regex: search, $options: "i" } },
        { phoneNumber: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { gradeInterested: { $regex: search, $options: "i" } },
        { previousSchool: { $regex: search, $options: "i" } },
        { notes: { $regex: search, $options: "i" } }
      ];
      console.log("Search query:", query);
    }

    // Add grade filter
    if (grade) {
      query.gradeInterested = grade;
    }

    // Add status filter
    if (status && status.length > 0) {
      query.status = { $in: status };
    }

    // Add source filter
    if (source) {
      query.enquirySource = source;
    }

    // Build sort object
    const sortObj = {};
    sortObj[sortField] = sortOrder === "asc" ? 1 : -1;

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Fetch enquiries with pagination and filtering
    console.log("Final query:", JSON.stringify(query, null, 2));
    const enquiries = await Enquiry.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count for pagination
    const total = await Enquiry.countDocuments(query);
    const totalPages = Math.ceil(total / parseInt(limit));
    
    console.log("Found enquiries:", enquiries.length, "Total:", total);

    // Return data with pagination info
    res.status(200).json({
      data: enquiries,
      pagination: {
        current_page: parseInt(page),
        total_pages: totalPages,
        total: total,
        per_page: parseInt(limit)
      }
    });
  } catch (error) {
    console.error("Error fetching enquiries:", error);
    res.status(500).json({ message: error.message });
  }
});

// GET /transactions - Get Transactions
router.get('/transactions', async (req, res) => {
  try {
    // sort - { "field": "userId", sort: "desc" }
    const { page = 1, pageSize = 20, sort = null, search = "" } = req.query;

    // sanitize search
    var safeSearch = _.escapeRegExp(search);

    // Formatted sort - { userId: -1 }
    const generateSort = () => {
      const sortParsed = JSON.parse(sort);
      const sortFormatted = {
        [sortParsed.field]: sortParsed.sort == "asc" ? 1 : -1,
      };

      return sortFormatted;
    };

    // sort formatted
    const sortFormatted = Boolean(sort) ? generateSort() : {};

    // get transactions
    const transactions = await Transaction.find({
      $or: [
        { cost: { $regex: new RegExp(safeSearch, "i") } },
        { userId: { $regex: new RegExp(safeSearch, "i") } },
      ],
    })
      .sort(sortFormatted)
      .skip(page * pageSize)
      .limit(pageSize);

    // total transactions
    const total = await Transaction.countDocuments({
      name: { $regex: safeSearch, $options: "i" },
    });

    res.status(200).json({
      transactions,
      total,
    });
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
});

module.exports = router;
