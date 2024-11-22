// Load environment variables from the .env file
import dotenv from 'dotenv';  // Import dotenv
dotenv.config();  // Load environment variables from .env file
import Arweave from "arweave";  // Import Arweave SDK
import { db } from "../connect.js";  // Assuming you have your DB connection here
import jwt from "jsonwebtoken";
import moment from "moment"; // Import moment for date formatting

// Initialize Arweave instance
const arweave = Arweave.init({
  host: 'arweave.net', // Can also use 'arweave.net' or a local Arweave node
  port: 443,
  protocol: 'https',
});

// Function to upload image to Arweave
const uploadToArweave = async (imageData) => {
  try {
    // Load wallet key from environment variable
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

// Route to get posts (for retrieving posts)
export const getPosts = (req, res) => {
  const userId = req.query.userId;
  const token = req.cookies.accessToken;
  if (!token) return res.status(401).json("Not logged in!");

  jwt.verify(token, "secretkey", (err, userInfo) => {
    if (err) return res.status(403).json("Token is not valid!");

    const q =
      userId !== "undefined"
        ? `SELECT p.*, u.id AS userId, name, profilePic FROM posts AS p JOIN users AS u ON (u.id = p.userId) WHERE p.userId = ? ORDER BY p.createdAt DESC`
        : `SELECT p.*, u.id AS userId, name, profilePic FROM posts AS p JOIN users AS u ON (u.id = p.userId)
    LEFT JOIN relationships AS r ON (p.userId = r.followedUserId) WHERE r.followerUserId= ? OR p.userId =?
    ORDER BY p.createdAt DESC`;

    const values =
      userId !== "undefined" ? [userId] : [userInfo.id, userInfo.id];

    db.query(q, values, (err, data) => {
      if (err) return res.status(500).json(err);
      return res.status(200).json(data);
    });
  });
};

// Route to add a post
export const addPost = async (req, res) => {
  const token = req.cookies.accessToken;
  if (!token) return res.status(401).json("Not logged in!");

  jwt.verify(token, "secretkey", async (err, userInfo) => {
    if (err) return res.status(403).json("Token is not valid!");

    try {
      let imageArweaveId = "";
      
      // If image data is provided (i.e., the user uploads an image)
      if (req.body.img) {
        const imageData = req.body.img; // Base64 image data from the frontend
        imageArweaveId = await uploadToArweave(imageData); // Upload image to Arweave
      }

      // Insert the post data into the database, including the Arweave image ID (if available)
      const q = "INSERT INTO posts(`desc`, `img`, `createdAt`, `userId`) VALUES (?)";
      const values = [
        req.body.desc,
        imageArweaveId, // Store the Arweave transaction ID (which is the image URL) or empty string if no image
        moment(Date.now()).format("YYYY-MM-DD HH:mm:ss"),
        userInfo.id,
      ];

      db.query(q, [values], (err, data) => {
        if (err) return res.status(500).json(err);
        return res.status(200).json("Post has been created.");
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json("Error uploading image to Arweave");
    }
  });
};

// Route to delete a post
export const deletePost = (req, res) => {
  const token = req.cookies.accessToken;
  if (!token) return res.status(401).json("Not logged in!");

  jwt.verify(token, "secretkey", (err, userInfo) => {
    if (err) return res.status(403).json("Token is not valid!");

    const q =
      "DELETE FROM posts WHERE `id`=? AND `userId` = ?";

    db.query(q, [req.params.id, userInfo.id], (err, data) => {
      if (err) return res.status(500).json(err);
      if (data.affectedRows > 0) return res.status(200).json("Post has been deleted.");
      return res.status(403).json("You can delete only your post");
    });
  });
};
