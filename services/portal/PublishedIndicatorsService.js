const mongoose = require('mongoose');
const PublishedIndicators = require('../../models/portal/content/PublishedIndicators'); // Adjust the path as needed

// Function to create and publish a new indicator
async function createAndPublishIndicator({term, learning_area, strand, substrand, indicator}) {
  try {
    // Create a new PublishedIndicators document
    const newIndicator = new PublishedIndicators({
      term,
      learning_area,
      strand,
      substrand,
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

// Function to unpublish an indicator by ID
async function unpublishIndicator(indicatorId) {
  try {
    const result = await PublishedIndicators.findOneAndUpdate(
      {_id: indicatorId},
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
async function publishIndicator(indicatorId) {
  try {
    const result = await PublishedIndicators.findOneAndUpdate(
      {_id: indicatorId},
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

module.exports = {createAndPublishIndicator, unpublishIndicator};
