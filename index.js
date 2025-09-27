const express = require("express");
const { createCanvas, loadImage } = require("canvas");
const axios = require("axios");
const FormData = require("form-data");
const { Readable } = require("stream");

const app = express();
const PORT = process.env.PORT || 3000;

// Base meme URL
const BASE_MEME = "https://files.catbox.moe/az80ft.jpg";

// GET /meme?avatar=<url>
app.get("/meme", async (req, res) => {
  try {
    const avatarUrl = req.query.avatar;
    if (!avatarUrl) {
      return res.status(400).json({ error: "Missing avatar query parameter" });
    }

    // Load base meme and avatar
    const [baseImg, avatarImg] = await Promise.all([
      loadImage(BASE_MEME),
      loadImage(avatarUrl)
    ]);

    // Create canvas
    const canvas = createCanvas(baseImg.width, baseImg.height);
    const ctx = canvas.getContext("2d");

    // Draw base meme
    ctx.drawImage(baseImg, 0, 0, baseImg.width, baseImg.height);

    // 🔹 Place avatar at custom coordinates
    const x = 200;   // horizontal position
    const y = 250;   // vertical position
    const w = 180;   // avatar width
    const h = 180;   // avatar height
    ctx.drawImage(avatarImg, x, y, w, h);

    // Convert canvas to buffer
    const buffer = canvas.toBuffer("image/png");

    // Upload to Catbox
    const form = new FormData();
    form.append("reqtype", "fileupload");
    form.append("fileToUpload", buffer, {
      filename: "meme.png",
      contentType: "image/png"
    });

    const uploadRes = await axios.post("https://catbox.moe/user/api.php", form, {
      headers: form.getHeaders()
    });

    // Respond with Catbox URL
    res.json({
      success: true,
      url: uploadRes.data
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate and upload meme" });
  }
});

app.listen(PORT, () => console.log(`✅ Meme API running at http://localhost:${PORT}/meme?avatar=URL`));
