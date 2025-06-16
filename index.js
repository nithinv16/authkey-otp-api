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
    // 1. Validate webhook signature (Standard Webhooks way)
    const webhookId = req.headers['webhook-id'];
    const webhookTimestamp = req.headers['webhook-timestamp'];
    const webhookSignature = req.headers['webhook-signature'];
    
    if (!webhookSignature) {
      console.error('Missing webhook signature');
      return res.status(401).json({ error: 'Unauthorized: Missing webhook signature' });
    }
    
    // Get the base64 secret (remove the v1,whsec_ prefix)
    const hookSecret = process.env.HOOK_SECRET.replace('v1,whsec_', '');
    const secretBuffer = Buffer.from(hookSecret, 'base64');
    
    // Create signed content: id.timestamp.body
    const body = req.body.toString('utf8');
    const signedContent = `${webhookId}.${webhookTimestamp}.${body}`;
    
    // Calculate expected signature
    const expectedSignature = crypto
      .createHmac('sha256', secretBuffer)
      .update(signedContent, 'utf8')
      .digest('base64');
    
    // Extract signature from header (format: "v1,signature")
    const receivedSignature = webhookSignature.split(',')[1];
    
    if (receivedSignature !== expectedSignature) {
      console.error('Invalid webhook signature');
      console.error('Expected:', expectedSignature);
      console.error('Received:', receivedSignature);
      return res.status(401).json({ error: 'Unauthorized: Invalid webhook signature' });
    }
    
    console.log('Webhook signature verified successfully');
    
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
      return res.status(502).json({ error: 'AuthKey API error', details: error.response.data });
    }
    
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Environment variables loaded:');
  console.log('- AUTHKEY:', process.env.AUTHKEY ? 'Set' : 'Missing');
  console.log('- HOOK_SECRET:', process.env.HOOK_SECRET ? 'Set' : 'Missing');
});