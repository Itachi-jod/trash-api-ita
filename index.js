const express = require("express");
const { createCanvas, loadImage } = require("@napi-rs/canvas");
const axios = require("axios");
const FormData = require("form-data");
const sharp = require("sharp");
const fs = require("fs").promises;
const path = require("path");

const app = express();

// Default author
const DEFAULT_AUTHOR = "ItachiCodes";

// Path to local base meme file
const BASE_MEME_PATH = path.join(__dirname, "public", "BASE_MEME.jpeg");

// Validate image URL
const validateImageUrl = async (url, timeout = 5000) => {
  try {
    console.log(`Validating URL: ${url}`);
    const response = await axios.head(url, { timeout });
    if (!response.headers["content-type"].startsWith("image/")) {
      throw new Error("URL does not point to an image");
    }
    return true;
  } catch (err) {
    throw new Error(`Invalid or unreachable image URL: ${err.message}`);
  }
};

// Fetch image as ArrayBuffer
const fetchImageAsArrayBuffer = async (url, timeout = 10000) => {
  try {
    console.log(`Fetching ArrayBuffer for: ${url}`);
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout
    });
    if (!response.headers["content-type"].startsWith("image/")) {
      throw new Error("Fetched content is not an image");
    }
    return response.data;
  } catch (err) {
    throw new Error(`Failed to fetch image: ${err.message}`);
  }
};

// Retry function for network requests
const retryRequest = async (fn, retries = 3, delay = 1000) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === retries - 1) throw err;
      console.log(`Retry ${i + 1}/${retries} failed: ${err.message}`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
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

    console.log("Starting meme generation");

    // Validate avatar URL
    console.log("Validating avatar URL");
    await validateImageUrl(avatarUrl);

    // Load base meme from local file
    console.log("Loading base meme from local file");
    let baseImg;
    try {
      const baseMemeBuffer = await fs.readFile(BASE_MEME_PATH);
      baseImg = await loadImage(baseMemeBuffer);
    } catch (err) {
      console.error("Failed to load local base meme:", err.message);
      return res.status(500).json({
        success: false,
        author: DEFAULT_AUTHOR,
        error: `Failed to load base meme: ${err.message}`
      });
    }

    // Fetch and load avatar as ArrayBuffer
    console.log("Loading avatar image");
    let avatarImg;
    try {
      const avatarBuffer = await retryRequest(() => fetchImageAsArrayBuffer(avatarUrl));
      avatarImg = await loadImage(Buffer.from(avatarBuffer));
    } catch (err) {
      console.error("Failed to load avatar image:", err.message);
      return res.status(400).json({
        success: false,
        author: DEFAULT_AUTHOR,
        error: `Failed to load avatar image: ${err.message}`
      });
    }

    // Create canvas
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
    console.log("Resizing avatar");
    const avatarCanvas = createCanvas(w, h);
    const avatarCtx = avatarCanvas.getContext("2d");
    avatarCtx.drawImage(avatarImg, 0, 0, w, h);

    // Draw resized avatar
    ctx.drawImage(avatarCanvas, x, y, w, h);

    // Convert to buffer and compress
    console.log("Converting to buffer and compressing");
    const buffer = canvas.toBuffer("image/png");
    const compressedBuffer = await sharp(buffer)
      .png({ quality: 70, compressionLevel: 9 })
      .toBuffer();

    // Upload to Catbox with retry
    console.log("Uploading to Catbox");
    let downloadUrl;
    try {
      const form = new FormData();
      form.append("reqtype", "fileupload");
      form.append("fileToUpload", compressedBuffer, {
        filename: "meme.png",
        contentType: "image/png"
      });

      const uploadRes = await retryRequest(() =>
        axios.post("https://catbox.moe/user/api.php", form, {
          headers: form.getHeaders(),
          timeout: 20000 // 20-second timeout
        })
      );

      downloadUrl = uploadRes.data;
      console.log("Upload successful");
    } catch (uploadErr) {
      console.error("Catbox upload failed:", uploadErr.message);
      // Fallback: Return image as base64
      console.log("Falling back to base64 response");
      const base64Image = compressedBuffer.toString("base64");
      return res.json({
        success: true,
        author: DEFAULT_AUTHOR,
        base_meme: "local:BASE_MEME.jpeg",
        avatar: avatarUrl,
        download_url: null,
        fallback_base64: `data:image/png;base64,${base64Image}`,
        warning: "Failed to upload to Catbox, returning base64 image instead"
      });
    }

    // Success response
    res.json({
      success: true,
      author: DEFAULT_AUTHOR,
      base_meme: "local:BASE_MEME.jpeg",
      avatar: avatarUrl,
      download_url: downloadUrl
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
