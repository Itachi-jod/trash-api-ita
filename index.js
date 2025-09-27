const express = require("express");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const axios = require("axios");
const FormData = require("form-data");
const sharp = require("sharp");

const app = express();

// Default author
const DEFAULT_AUTHOR = "ItachiCodes";

// Base meme URL
const BASE_MEME = "https://files.catbox.moe/az80ft.jpg";

// Validate image URL
const validateImageUrl = async (url) => {
  try {
    const response = await axios.head(url, { timeout: 5000 });
    if (!response.headers["content-type"].startsWith("image/")) {
      throw new Error("URL does not point to an image");
    }
    return true;
  } catch (err) {
    throw new Error(`Invalid or unreachable image URL: ${err.message}`);
  }
};

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

    console.log("Validating image URLs");
    await Promise.all([validateImageUrl(BASE_MEME), validateImageUrl(avatarUrl)]);

    console.log("Loading images");
    const [baseImg, avatarImg] = await Promise.all([
      loadImage(BASE_MEME),
      loadImage(avatarUrl)
    ]);

    console.log("Creating canvas");
    const canvas = createCanvas(baseImg.width, baseImg.height);
    const ctx = canvas.getContext("2d");

    // Draw base meme
    ctx.drawImage(baseImg, 0, 0, baseImg.width, baseImg.height);

    // Resize avatar
    const x = 200;
    const y = 250;
    const w = 180;
    const h = 180;
    const avatarCanvas = createCanvas(w, h);
    const avatarCtx = avatarCanvas.getContext("2d");
    avatarCtx.drawImage(avatarImg, 0, 0, w, h);

    // Draw resized avatar
    ctx.drawImage(avatarCanvas, x, y, w, h);

    console.log("Converting to buffer");
    const buffer = canvas.toBuffer("image/png");

    // Compress buffer
    console.log("Compressing image");
    const compressedBuffer = await sharp(buffer)
      .png({ quality: 80 })
      .toBuffer();

    // Upload to Catbox
    console.log("Uploading to Catbox");
    const form = new FormData();
    form.append("reqtype", "fileupload");
    form.append("fileToUpload", compressedBuffer, {
      filename: "meme.png",
      contentType: "image/png"
    });

    const uploadRes = await axios.post("https://catbox.moe/user/api.php", form, {
      headers: form.getHeaders(),
      timeout: 30000 // 30-second timeout
    });

    console.log("Upload successful");
    res.json({
      success: true,
      author: DEFAULT_AUTHOR,
      base_meme: BASE_MEME,
      avatar: avatarUrl,
      download_url: uploadRes.data
    });

  } catch (err) {
    console.error("Error:", err);
    res.status(500).json({
      success: false,
      author: DEFAULT_AUTHOR,
      error: `Failed to generate and upload meme: ${err.message}`
    });
  }
});

// Export for Vercel
module.exports = app;
