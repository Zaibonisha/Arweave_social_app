import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import cookieParser from "cookie-parser";
import cors from "cors";
import Arweave from "arweave";  // Import Arweave SDK
import { db } from "./connect.js";  // Assuming you have your DB connection here
import jwt from "jsonwebtoken";

// Initialize Arweave instance
const arweave = Arweave.init({
  host: 'arweave.net', // Can also use 'arweave.net' or a local Arweave node
  port: 443,
  protocol: 'https',
});

// Function to upload image to Arweave
const uploadToArweave = async (imageData) => {
  try {
    const wallet = JSON.parse(process.env.ARWEAVE_WALLET); // Load wallet from environment variable
    const transaction = await arweave.createTransaction({ data: imageData }, wallet);
    await arweave.transactions.sign(transaction, wallet);
    
    // Upload the transaction to Arweave
    const uploader = await arweave.transactions.getUploader(transaction);
    while (!uploader.isComplete) {
      await uploader.uploadChunk();
    }

    return transaction.id; // Return the Arweave transaction ID (which serves as the image URL)
  } catch (err) {
    console.error("Error uploading to Arweave:", err);
    throw new Error("Failed to upload image to Arweave");
  }
};

// Set up express
const app = express();

// Middlewares
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Credentials", true);
  next();
});
app.use(express.json());
app.use(
  cors({
    origin: "http://localhost:3000", // Adjust if your frontend is on a different URL
  })
);
app.use(cookieParser());

// Multer configuration (not used for Arweave, just for backward compatibility)
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./upload"); // This will no longer be used
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + file.originalname); // Not used
  },
});

const upload = multer({ storage: storage });

// Upload route
app.post("/api/upload", upload.single("file"), async (req, res) => {
  const token = req.cookies.accessToken; // Check if the user is logged in
  if (!token) return res.status(401).json("Not logged in!");

  // Verify JWT token to ensure the user is authenticated
  jwt.verify(token, "secretkey", async (err, userInfo) => {
    if (err) return res.status(403).json("Token is not valid!");

    const file = req.file;
    const imageBase64 = file.buffer.toString("base64");

    try {
      // Upload image to Arweave and get the transaction ID
      const arweaveTxId = await uploadToArweave(imageBase64);

      // Save the Arweave transaction ID in the database, associated with the user
      const q = "INSERT INTO posts (`desc`, `img`, `createdAt`, `userId`) VALUES (?)";
      const values = [
        req.body.desc, // Post description
        arweaveTxId,    // Arweave transaction ID (image URL)
        moment(Date.now()).format("YYYY-MM-DD HH:mm:ss"),
        userInfo.id,    // User ID from JWT
      ];

      // Insert post data into the database
      db.query(q, [values], (err, data) => {
        if (err) return res.status(500).json(err);
        return res.status(200).json("Post has been created with Arweave image.");
      });
    } catch (err) {
      console.error("Error uploading to Arweave:", err);
      return res.status(500).json("Failed to upload image to Arweave");
    }
  });
});

// Routes
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/users.js";
import postRoutes from "./routes/posts.js";
import commentRoutes from "./routes/comments.js";
import likeRoutes from "./routes/likes.js";
import relationshipRoutes from "./routes/relationships.js";
import storyRoutes from "./routes/stories.js";

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/likes", likeRoutes);
app.use("/api/relationships", relationshipRoutes);
app.use("/api/stories", storyRoutes);

// Server listening
app.listen(8800, () => {
  console.log("Connected to server");
});
