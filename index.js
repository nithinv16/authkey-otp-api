require('dotenv').config();

const express = require('express');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const app = express();

app.use(express.json());

const PORT = process.env.PORT || 3000;

app.post('/send-otp', async (req, res) => {
  const { phone, otp, type } = req.body;
  const receivedSecret = req.headers['secret'];

  if (receivedSecret !== process.env.HOOK_SECRET) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const message = `Use ${otp} as your OTP to access your AppName, OTP is confidential and valid for 5 mins.`;
  const authKey = process.env.AUTHKEY;
  const senderId = 'AUTHKY';
  const countryCode = '91'; // adjust based on phone if needed

  const url = `https://console.authkey.io/request?authkey=${authKey}&mobile=${phone}&country_code=${countryCode}&sms=${encodeURIComponent(message)}&sender=${senderId}`;

  try {
    const response = await fetch(url);
    const data = await response.text();
    res.send(data);
  } catch (err) {
    console.error('Error sending OTP:', err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
