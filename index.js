require('dotenv').config();
const express = require('express');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const app = express();

app.use(express.json()); // To parse JSON body from Supabase

const PORT = process.env.PORT || 8080;

// POST route to handle Supabase Auth Hook
app.post('/send-otp', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const expectedAuth = `Bearer ${process.env.HOOK_SECRET}`;

  // Step 1: Authorization Check
  if (authHeader !== expectedAuth) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  try {
    // Step 2: Extract OTP and phone from Supabase body
    const { otp, user } = req.body;
    const mobile = user?.phone?.replace('+', '') || ''; // removes leading '+'

    if (!otp || !mobile) {
      return res.status(400).json({ error: 'Missing OTP or phone' });
    }

    // Step 3: Construct message using template placeholders
    const companyName = 'dukaaOn-Rider'; // Change as needed
    const message = `Use ${otp} as your OTP to access your ${companyName}, OTP is confidential and valid for 5 mins This sms sent by authkey.io`;

    // Step 4: Construct AuthKey API GET URL
    const authKey = process.env.AUTHKEY;
    const senderId = 'AUTHKY';
    const countryCode = '91';

    const url = `https://console.authkey.io/request?authkey=${authKey}&mobile=${mobile}&country_code=${countryCode}&sms=${encodeURIComponent(message)}&sender=${senderId}`;

    // Step 5: Send GET request to AuthKey
    const response = await fetch(url);
    const result = await response.text();

    console.log('SMS sent. AuthKey response:', result);
    return res.status(200).send(result);
  } catch (error) {
    console.error('Error sending OTP:', error.message);
    return res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// Optional root route
app.get('/', (req, res) => {
  res.send('AuthKey OTP API is running');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
