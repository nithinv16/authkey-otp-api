const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware to capture raw body for signature verification
app.use('/send-otp', express.raw({ type: 'application/json' }));
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

// Main SMS hook endpoint
app.post('/send-otp', async (req, res) => {
  try {
    // 1. Validate webhook signature (Supabase way)
    const signature = req.headers['x-supabase-signature'];
    const webhookSecret = process.env.HOOK_SECRET;
    
    if (!signature) {
      console.error('Missing webhook signature');
      return res.status(401).json({ error: 'Unauthorized: Missing webhook signature' });
    }
    
    // Verify the webhook signature using raw body
    const body = req.body;
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(body, 'utf8')
      .digest('hex');
    
    if (signature !== expectedSignature) {
      console.error('Invalid webhook signature');
      return res.status(401).json({ error: 'Unauthorized: Invalid webhook signature' });
    }
    
    // 2. Parse the JSON body
    const data = JSON.parse(body);
    
    // Extract phone from the record (Supabase Auth Hook format)
    const phone = data.record?.phone || data.record?.raw_user_meta_data?.phone;
    
    if (!phone) {
      console.error('Missing phone number in request:', data);
      return res.status(400).json({ error: 'Missing phone number' });
    }
    
    console.log('Processing OTP request for phone:', phone);
    
    // 3. Transform to AuthKey GET request
    const authkeyUrl = 'https://control.authkey.io/api/v2/sms/send';
    const authkeyParams = {
      authkey: process.env.AUTHKEY,
      mobile: phone.replace(/[^\d]/g, ''), // Remove non-digits
      country_code: '91',
      sid: '13462', // Your template ID
      company: 'DukaaOn'
    };
    
    console.log('Sending to AuthKey:', { url: authkeyUrl, params: authkeyParams });
    
    // 4. Make GET request to AuthKey
    const authkeyResponse = await axios.get(authkeyUrl, {
      params: authkeyParams,
      timeout: 8000
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