const GoogleConfig = require('../../models/frontoffice/GoogleConfig');
const axios = require('axios');

// Get current Google configuration
const getGoogleConfig = async (req, res) => {
  try {
    const config = await GoogleConfig.findOne({ is_active: true });
    
    if (!config) {
      return res.status(404).json({ message: 'No active Google configuration found' });
    }

    res.json({ config });
  } catch (error) {
    console.error('Error fetching Google config:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Get Google configuration by ID
const getGoogleConfigById = async (req, res) => {
  try {
    const { id } = req.params;
    const config = await GoogleConfig.findById(id);
    
    if (!config) {
      return res.status(404).json({ message: 'Google configuration not found' });
    }

    res.json({ config });
  } catch (error) {
    console.error('Error fetching Google config by ID:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Create or update Google configuration
const saveGoogleConfig = async (req, res) => {
  try {
    const {
      client_id,
      client_secret,
      api_key,
      refresh_token,
      access_token,
      code,
      redirect_uri,
      scope,
      description,
      is_active = true
    } = req.body;

    // Validate required fields
    if (!client_id || !client_secret) {
      return res.status(400).json({ 
        message: 'Client ID and Client Secret are required' 
      });
    }

    // Check if active config exists
    let config = await GoogleConfig.findOne({ is_active: true });

    if (config) {
      // Update existing config
      if (client_id) config.client_id = client_id;
      if (client_secret) config.client_secret = client_secret;
      if (api_key !== undefined) config.api_key = api_key;
      if (refresh_token !== undefined) config.refresh_token = refresh_token;
      if (access_token !== undefined) config.access_token = access_token;
      if (code !== undefined) config.code = code;
      if (redirect_uri !== undefined) config.redirect_uri = redirect_uri;
      if (scope !== undefined) config.scope = scope;
      if (description !== undefined) config.description = description;
      if (is_active !== undefined) config.is_active = is_active;

      await config.save();
    } else {
      // Create new config
      config = new GoogleConfig({
        client_id,
        client_secret,
        api_key,
        refresh_token,
        access_token,
        code,
        redirect_uri,
        scope: scope || 'https://www.googleapis.com/auth/drive.file',
        description,
        is_active
      });

      await config.save();
    }

    res.status(201).json({ 
      message: 'Google configuration saved successfully',
      config 
    });
  } catch (error) {
    console.error('Error saving Google config:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Exchange authorization code for tokens
const exchangeCodeForTokens = async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Authorization code is required' });
    }

    // Get active config
    const config = await GoogleConfig.findOne({ is_active: true });
    if (!config || !config.client_id || !config.client_secret) {
      return res.status(400).json({ error: 'Google configuration not found or incomplete' });
    }

    const params = new URLSearchParams({
      code: code,
      client_id: config.client_id,
      client_secret: config.client_secret,
      redirect_uri: config.redirect_uri || 'http://localhost:5173/home/oauthclientredirect',
      grant_type: 'authorization_code',
    });

    const response = await axios.post(
      'https://oauth2.googleapis.com/token',
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    // Update config with tokens
    const refreshToken = response.data.refresh_token;
    const accessToken = response.data.access_token;
    const SPECIFIC_CONFIG_ID = '69023ae4a772a5bf53b229fa';
    
    config.refresh_token = refreshToken || config.refresh_token;
    config.access_token = accessToken;
    config.code = code;
    
    await config.save();

    // Also update the specific document ID
    try {
      const specificConfig = await GoogleConfig.findById(SPECIFIC_CONFIG_ID);
      if (specificConfig) {
        specificConfig.refresh_token = refreshToken || specificConfig.refresh_token;
        specificConfig.access_token = accessToken;
        specificConfig.code = code;
        // Preserve other fields if they exist
        if (config.client_id) specificConfig.client_id = config.client_id;
        if (config.client_secret) specificConfig.client_secret = config.client_secret;
        await specificConfig.save();
        console.log(`Updated specific config document ${SPECIFIC_CONFIG_ID} with tokens`);
      } else {
        console.warn(`Specific config document ${SPECIFIC_CONFIG_ID} not found`);
      }
    } catch (updateError) {
      console.error(`Error updating specific config ${SPECIFIC_CONFIG_ID}:`, updateError);
      // Continue even if specific config update fails
    }

    res.json({
      success: true,
      message: 'Tokens exchanged successfully',
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  } catch (error) {
    console.error('Token exchange error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Token exchange failed',
      details: error.response?.data || error.message,
    });
  }
};

// Get all Google configurations
const getAllGoogleConfigs = async (req, res) => {
  try {
    const configs = await GoogleConfig.find().sort({ createdAt: -1 });
    res.json({ configs });
  } catch (error) {
    console.error('Error fetching all Google configs:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// Refresh access token using refresh token
const refreshAccessToken = async (req, res) => {
  try {
    const SPECIFIC_CONFIG_ID = '69023ae4a772a5bf53b229fa';
    
    // Get active config from database
    const config = await GoogleConfig.findOne({ is_active: true });
    
    if (!config) {
      return res.status(404).json({ error: 'Google configuration not found' });
    }

    if (!config.refresh_token) {
      return res.status(400).json({ error: 'Refresh token not available. Please authenticate first.' });
    }

    if (!config.client_id || !config.client_secret) {
      return res.status(400).json({ error: 'Client ID or Client Secret not configured' });
    }

    const params = new URLSearchParams({
      client_id: config.client_id,
      client_secret: config.client_secret,
      refresh_token: config.refresh_token,
      grant_type: 'refresh_token',
    });

    const response = await axios.post(
      'https://oauth2.googleapis.com/token',
      params,
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );

    // Get new tokens (refresh_token may or may not be included in response)
    const newAccessToken = response.data.access_token;
    const newRefreshToken = response.data.refresh_token; // May be undefined if not provided

    // Update active config
    config.access_token = newAccessToken;
    // Only update refresh_token if a new one is provided
    if (newRefreshToken) {
      config.refresh_token = newRefreshToken;
    }
    config.updatedAt = new Date();
    
    await config.save();

    // Also update the specific document ID
    try {
      const specificConfig = await GoogleConfig.findById(SPECIFIC_CONFIG_ID);
      if (specificConfig) {
        specificConfig.access_token = newAccessToken;
        // Only update refresh_token if a new one is provided
        if (newRefreshToken) {
          specificConfig.refresh_token = newRefreshToken;
        }
        // Preserve other fields if they exist
        if (config.client_id) specificConfig.client_id = config.client_id;
        if (config.client_secret) specificConfig.client_secret = config.client_secret;
        // Keep refresh_token if no new one provided
        if (!specificConfig.refresh_token && config.refresh_token) {
          specificConfig.refresh_token = config.refresh_token;
        }
        specificConfig.updatedAt = new Date();
        await specificConfig.save();
        console.log(`Updated specific config document ${SPECIFIC_CONFIG_ID} with new access token`);
      } else {
        console.warn(`Specific config document ${SPECIFIC_CONFIG_ID} not found`);
      }
    } catch (updateError) {
      console.error(`Error updating specific config ${SPECIFIC_CONFIG_ID}:`, updateError);
      // Continue even if specific config update fails
    }

    res.json({
      success: true,
      access_token: newAccessToken,
      refresh_token: newRefreshToken || config.refresh_token,
      expires_in: response.data.expires_in || 3600,
      token_type: response.data.token_type || 'Bearer',
      scope: response.data.scope,
    });
  } catch (error) {
    console.error('Token refresh error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Failed to refresh access token',
      details: error.response?.data || error.message,
    });
  }
};

// Update refresh_token (and optionally access_token) for a specific config ID
const updateRefreshTokenById = async (req, res) => {
  try {
    const { id } = req.params;
    const { refresh_token, access_token } = req.body || {};

    if (!refresh_token && !access_token) {
      return res.status(400).json({ message: 'refresh_token or access_token required' });
    }

    const SPECIFIC_CONFIG_ID = '69023ae4a772a5bf53b229fa';
    const targetId = id || SPECIFIC_CONFIG_ID;

    const config = await GoogleConfig.findById(targetId);
    if (!config) {
      return res.status(404).json({ message: 'Google configuration not found' });
    }

    if (refresh_token) {
      config.refresh_token = refresh_token;
    }
    if (access_token) {
      config.access_token = access_token;
    }
    config.updatedAt = new Date();

    await config.save();

    return res.json({
      message: 'Google configuration tokens updated',
      config
    });
  } catch (error) {
    console.error('Error updating tokens by ID:', error);
    return res.status(500).json({ message: 'Server error' });
  }
};

// Delete Google configuration
const deleteGoogleConfig = async (req, res) => {
  try {
    const { id } = req.params;

    const config = await GoogleConfig.findById(id);
    if (!config) {
      return res.status(404).json({ message: 'Google configuration not found' });
    }

    await GoogleConfig.findByIdAndDelete(id);

    res.json({ message: 'Google configuration deleted successfully' });
  } catch (error) {
    console.error('Error deleting Google config:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  getGoogleConfig,
  getGoogleConfigById,
  saveGoogleConfig,
  exchangeCodeForTokens,
  refreshAccessToken,
  updateRefreshTokenById,
  getAllGoogleConfigs,
  deleteGoogleConfig
};
