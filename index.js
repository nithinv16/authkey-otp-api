const express = require('express');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(express.json());
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Main SMS hook endpoint - converts POST to GET
app.post('/send-otp', async (req, res) => {
  try {
    // 1. Validate authentication
    const authHeader = req.headers.authorization;
    const expectedSecret = process.env.HOOK_SECRET;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Missing or invalid Authorization header');
      return res.status(401).json({ error: 'Unauthorized: Missing Bearer token' });
    }
    
    const providedSecret = authHeader.substring(7); // Remove 'Bearer '
    if (providedSecret !== expectedSecret) {
      console.error('Invalid secret key');
      return res.status(401).json({ error: 'Unauthorized: Invalid secret' });
    }
    
    // 2. Extract data from Supabase POST request
    const { phone, token, user } = req.body;
    
    if (!phone || !token) {
      console.error('Missing required fields:', { phone: !!phone, token: !!token });
      return res.status(400).json({ error: 'Missing required fields: phone and token' });
    }
    
    console.log('Processing OTP request:', { phone, token, userId: user?.id });
    
    // 3. Transform to AuthKey GET request
    const authkeyUrl = 'https://api.authkey.io/request';
    const authkeyParams = {
      authkey: process.env.AUTHKEY,
      mobile: phone.replace(/[^\d]/g, ''), // Remove non-digits
      country_code: '91', // Adjust based on your needs
      sms: `Your OTP is: ${token}. Do not share this with anyone.`,
      company: 'DukaaOn' // Your company name
    };
    
    console.log('Sending to AuthKey:', { url: authkeyUrl, params: authkeyParams });
    
    // 4. Make GET request to AuthKey
    const authkeyResponse = await axios.get(authkeyUrl, {
      params: authkeyParams,
      timeout: 8000 // 8 second timeout
    });
    
    console.log('AuthKey response:', authkeyResponse.data);
    
    // 5. Return success response to Supabase
    res.json({
      success: true,
      message: 'OTP sent successfully',
      authkey_response: authkeyResponse.data,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error processing OTP request:', error.message);
    
    if (error.code === 'ECONNABORTED') {
      return res.status(408).json({ error: 'Request timeout' });
    }
    
    if (error.response) {
      console.error('AuthKey API error:', error.response.data);
      return res.status(502).json({ 
        error: 'AuthKey API error', 
        details: error.response.data 
      });
    }
    
    res.status(500).json({ 
      error: 'Internal server error', 
      message: error.message 
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`🚀 Railway SMS Bridge Server running on port ${PORT}`);
  console.log(`📱 Ready to convert Supabase POST → AuthKey GET requests`);
});