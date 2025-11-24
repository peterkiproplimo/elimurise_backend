const express = require("express");
const axios = require("axios");

const router = express.Router();

// Store refresh token in memory (in production, store in database)
let storedRefreshToken = null;

// Get Google Drive access token (this handles everything in the backend)
router.get("/google/token", async (req, res) => {
  try {
    // Get refresh token (in production, get from database based on user session)
    const refreshToken = storedRefreshToken;
    
    if (!refreshToken) {
      return res.status(401).json({ error: "Not authenticated. Please sign in first." });
    }

    // Exchange refresh token for access token
    const params = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: "1056323070211-jc21517cqebttjhp98sc664ujb83k9bq.apps.googleusercontent.com",
      client_secret: "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",
      grant_type: "refresh_token",
    });

    const response = await axios.post(
      "https://oauth2.googleapis.com/token",
      params,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    // Return access token (this is what the frontend needs)
    res.json({
      access_token: response.data.access_token,
      expires_in: response.data.expires_in || 3600,
    });
  } catch (error) {
    console.error("Token refresh error:", error.response?.data || error.message);
    res.status(500).json({
      error: "Failed to get access token",
      details: error.response?.data || error.message,
    });
  }
});

// Exchange Google OAuth code for tokens (initial authentication)
// This stores the refresh token in the database
router.post("/google/exchange-token", async (req, res) => {
  try {
    const { code, state } = req.body;

    if (!code) {
      return res.status(400).json({ error: "Authorization code is required" });
    }

    console.log('Received code and state:', { code: code?.substring(0, 20) + '...', state });

    const params = new URLSearchParams({
      code: code,
      client_id: "1056323070211-jc21517cqebttjhp98sc664ujb83k9bq.apps.googleusercontent.com",
      client_secret: "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",
      redirect_uri: "http://localhost:5173/home/oauthclientredirect",
      grant_type: "authorization_code",
    });

    const response = await axios.post(
      "https://oauth2.googleapis.com/token",
      params,
      {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    // Store refresh token in memory for this user
    // In production, store in database associated with user session
    const refreshToken = response.data.refresh_token;
    const accessToken = response.data.access_token;
    
    storedRefreshToken = refreshToken;

    console.log('Stored refresh token, returning access token');

    // Return access token immediately so user can start using it
    res.json({
      success: true,
      access_token: accessToken,
      refresh_token: refreshToken, // Also return refresh token in case frontend needs it
    });
  } catch (error) {
    console.error("Token exchange error:", error.response?.data || error.message);
    res.status(500).json({
      error: "Token exchange failed",
      details: error.response?.data || error.message,
    });
  }
});

module.exports = router;
