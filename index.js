const express = require("express");
const fetch = require("node-fetch");

const app = express();
const PORT = process.env.PORT || 3000;

const AUTHKEY = "904251f34754cedc"; // Replace with your Authkey.io
const HOOK_SECRET = "v1,whsec_ep8uiciCqtqRBa3DFDE8NaElmLyB8LBnOvZNky0RGXQeW+8WMhp2YCiffMYMLZHGBvcCXcvLFqMizezu"; // Keep this strong

app.use(express.json());

app.post("/send-otp", async (req, res) => {
  const secret = req.query.secret;
  if (secret !== HOOK_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const { phone } = req.body;
  if (!phone) return res.status(400).json({ error: "Missing phone number" });

  const otp = Math.floor(100000 + Math.random() * 900000);
  const message = `Your OTP is ${otp}`;

  const url = `https://console.authkey.io/request?authkey=${AUTHKEY}&mobile=${phone}&country_code=91&sms=${encodeURIComponent(message)}&sender=AUTHKY`;

  try {
    const response = await fetch(url);
    const result = await response.json();
    return res.status(200).json({ status: "sent", result });
  } catch (error) {
    console.error("Authkey Error:", error);
    return res.status(500).json({ error: "Failed to send OTP" });
  }
});

app.get("/", (req, res) => res.send("Authkey OTP API running"));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
