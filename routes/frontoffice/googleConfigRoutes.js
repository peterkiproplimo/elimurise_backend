const express = require('express');
const {
  getGoogleConfig,
  getGoogleConfigById,
  saveGoogleConfig,
  exchangeCodeForTokens,
  refreshAccessToken,
  updateRefreshTokenById,
  getAllGoogleConfigs,
  deleteGoogleConfig
} = require('../../controllers/frontoffice/googleConfigController');

const router = express.Router();

// GET /api/google-config - Get current active configuration
router.get('/', getGoogleConfig);

// GET /api/google-config/:id - Get configuration by ID
router.get('/:id', getGoogleConfigById);

// GET /api/google-config/all - Get all configurations
router.get('/all', getAllGoogleConfigs);

// POST /api/google-config - Create or update configuration
router.post('/', saveGoogleConfig);

// POST /api/google-config/exchange-code - Exchange authorization code for tokens
router.post('/exchange-code', exchangeCodeForTokens);

// POST /api/google-config/refresh-token - Refresh access token using refresh token
router.post('/refresh-token', refreshAccessToken);

// POST /api/google-config/:id/refresh-token - Update refresh/access token for a specific config ID
router.post('/:id/refresh-token', updateRefreshTokenById);

// DELETE /api/google-config/:id - Delete configuration
router.delete('/:id', deleteGoogleConfig);

module.exports = router;
