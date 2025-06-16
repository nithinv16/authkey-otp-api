
require('dotenv').config();

const express = require('express');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/send-otp', async (req, res) => {
  const { mobile, otp, secret } = req.query;

  if (secret !== process.env.HOOK_SECRET) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const message = `Hello, your OTP is ${otp}`;
  const authKey = process.env.AUTHKEY;
  const senderId = 'AUTHKY'; // or your sender ID
  const countryCode = '91';  // modify if needed

  const url = `https://console.authkey.io/request?authkey=${authKey}&mobile=${mobile}&country_code=${countryCode}&sms=${encodeURIComponent(message)}&sender=${senderId}`;

  https.get(url, (resp) => {
    let data = '';
    resp.on('data', chunk => data += chunk);
    resp.on('end', () => res.send(data));
  }).on('error', (err) => {
    res.status(500).json({ error: err.message });
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
