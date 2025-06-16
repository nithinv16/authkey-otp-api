require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch'); // make sure node-fetch@2 is installed

const app = express();
app.use(express.json()); // enables parsing JSON body

const PORT = process.env.PORT || 3000;

app.post('/send-otp', async (req, res) => {
  const { mobile, otp } = req.body;
  const secret = req.headers['authorization'];

  if (secret !== `Bearer ${process.env.HOOK_SECRET}`) {
    return res.status(403).json({ error: 'Unauthorized' });
  }

  const message = `Use ${otp} as your OTP to access your Company, OTP is confidential and valid for 5 mins.`;
  const authKey = process.env.AUTHKEY;
  const senderId = 'AUTHKY';
  const countryCode = '91';

  const url = `https://console.authkey.io/request?authkey=${authKey}&mobile=${mobile}&country_code=${countryCode}&sms=${encodeURIComponent(message)}&sender=${senderId}`;

  try {
    const response = await fetch(url);
    const data = await response.text();
    res.send(data);
  } catch (err) {
    console.error('Error sending OTP:', err);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

app.get('/', (req, res) => {
  res.send('AuthKey OTP API running!');
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
