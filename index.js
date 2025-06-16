require('dotenv').config();
const express = require('express');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const app = express();

app.use(express.json());

const PORT = process.env.PORT || 8080;

// POST route to handle Supabase Auth Hook and transform to AuthKey GET
app.post('/send-otp', async (req, res) => {
  // Step 1: Verify Supabase secret
  const secretHeader = req.headers['secret'];
  const expectedSecret = process.env.HOOK_SECRET;

  if (secretHeader !== expectedSecret) {
    console.log('❌ Auth failed. Expected:', expectedSecret?.substring(0, 10) + '...', 'Got:', secretHeader?.substring(0, 10) + '...');
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    // Step 2: Extract data from Supabase POST body
    const { token, phone, user } = req.body;
    const mobile = phone?.replace('+', '') || user?.phone?.replace('+', '') || '';

    if (!token || !mobile) {
      console.log('❌ Missing data. Token:', !!token, 'Mobile:', !!mobile);
      return res.status(400).json({ error: 'Missing OTP or phone number' });
    }

    console.log('📱 Processing OTP request for mobile:', mobile.substring(0, 3) + '***');

    // Step 3: Prepare AuthKey message
    const companyName = 'dukaaOn-Rider';
    const message = `Use ${token} as your OTP to access your ${companyName}, OTP is confidential and valid for 5 mins This sms sent by authkey.io`;

    // Step 4: Transform POST to GET - Build AuthKey URL
    const authKey = process.env.AUTHKEY;
    const senderId = 'AUTHKY';
    const countryCode = '91'; // Adjust as needed

    const authKeyUrl = `https://console.authkey.io/request?authkey=${authKey}&mobile=${mobile}&country_code=${countryCode}&sms=${encodeURIComponent(message)}&sender=${senderId}`;

    // Step 5: Send GET request to AuthKey
    console.log('🚀 Sending to AuthKey...');
    const response = await fetch(authKeyUrl);
    const result = await response.text();

    console.log('✅ AuthKey response:', result);
    
    // Step 6: Return success to Supabase
    return res.status(200).json({ 
      success: true, 
      message: 'OTP sent successfully',
      authkey_response: result 
    });

  } catch (error) {
    console.error('❌ Error sending OTP:', error.message);
    return res.status(500).json({ 
      error: 'Failed to send OTP', 
      details: error.message 
    });
  }
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'running',
    service: 'AuthKey OTP Bridge',
    description: 'Transforms Supabase POST requests to AuthKey GET requests'
  });
});

app.listen(PORT, () => {
  console.log(`🚀 AuthKey OTP Bridge running on port ${PORT}`);
  console.log(`📡 Ready to transform POST → GET requests`);
});
