const express = require("express");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const axios = require("axios");
const FormData = require("form-data");

const app = express();

// Default author
const DEFAULT_AUTHOR = "ItachiCodes";

// Base meme URL
const BASE_MEME = "https://files.catbox.moe/az80ft.jpg";

// GET /api/meme?avatar=<url>
app.get("/api/meme", async (req, res) => {
  try {
    const avatarUrl = req.query.avatar;
    if (!avatarUrl) {
      return res.status(400).json({
        success: false,
        author: DEFAULT_AUTHOR,
        error: "Missing avatar query parameter"
      });
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

    // 🔹 Place avatar at chosen coordinates
    const x = 200;
    const y = 250;
    const w = 180;
    const h = 180;
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

    // Reply in your custom format
    res.json({
      success: true,
      author: DEFAULT_AUTHOR,
      base_meme: BASE_MEME,
      avatar: avatarUrl,
      download_url: uploadRes.data
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      author: DEFAULT_AUTHOR,
      error: "Failed to generate and upload meme"
    });
  }
});

// Export for Vercel
module.exports = app;
