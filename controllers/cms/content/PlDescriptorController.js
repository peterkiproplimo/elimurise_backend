const express = require('express');
const PlDescriptorService = require('../../../services/cms/PlDescriptor'); // Import the service
const router = express.Router(); // Create a router instance

// POST: Create a new descriptor
router.post('/', async (req, res) => {
  try {
    const descriptor = await PlDescriptorService.createDescriptor(req.body);
    return res.status(201).json(descriptor);
  } catch (error) {
    return res.status(404).json({message: error.message});
  }
});

// GET: Get all descriptors or by score (optional query param `?score=4`)
router.get('/', async (req, res) => {
  try {
    const {score} = req.query; // Check for score as a query parameter
    if (score) {
      const descriptor = await PlDescriptorService.findByScore(Number(score));
      return res.status(200).json({data: descriptor});
    } else {
      const descriptors = await PlDescriptorService.getAllDescriptors();
      return res.status(200).json({data: descriptors});
    }
  } catch (error) {
    return res.status(404).json({message: error.message});
  }
});

// PUT: Update descriptor by ID
router.put('/:id', async (req, res) => {
  try {
    const {id} = req.params;
    const updatedDescriptor = await PlDescriptorService.updateDescriptor(id, req.body);
    return res.status(200).json(updatedDescriptor);
  } catch (error) {
    return res.status(404).json({message: error.message});
  }
});
// PUT: Update descriptor by ID
router.delete('/:id', async (req, res) => {
  try {
    const {id} = req.params;
    const updatedDescriptor = await PlDescriptorService.deleteDescriptor(id);
    return res.status(200).json(updatedDescriptor);
  } catch (error) {
    return res.status(404).json({message: error.message});
  }
});

module.exports = router; // Export the router
