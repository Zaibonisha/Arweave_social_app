import dotenv from 'dotenv'; // Import dotenv
dotenv.config(); // Load environment variables from .env file
import Arweave from "arweave"; // Import Arweave SDK
import { db } from "../connect.js"; // Assuming you have your DB connection here
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

// Route to get stories (retrieving posts)
export const getStories = (req, res) => {
  const token = req.cookies.accessToken;

  console.log("Received Token:", token); // Log the token to verify it's being sent

  if (!token) return res.status(401).json("Not logged in!");

  jwt.verify(token, "secretkey", (err, userInfo) => {
    if (err) {
      console.log("Token verification error:", err); // Log token verification error
      return res.status(403).json("Token is not valid!");
    }

    console.log("Decoded userInfo:", userInfo); // Log the entire decoded userInfo

    if (!userInfo || !userInfo.id) {
      return res.status(403).json("Invalid user info in token!");
    }

    // Log the SQL query to verify it looks correct
    const q = `SELECT s.*, name FROM stories AS s JOIN users AS u ON (u.id = s.userId)
    LEFT JOIN relationships AS r ON (s.userId = r.followedUserId AND r.followerUserId= ?) LIMIT 4`;

    console.log("Executing query:", q, "with userId:", userInfo.id); // Log query and userId

    db.query(q, [userInfo.id], (err, data) => {
      if (err) {
        console.log("Database query error:", err); // Log DB query error
        return res.status(500).json(err);
      }

      console.log("Query result:", data); // Log the query result to check if stories are found

      if (data.length === 0) {
        return res.status(200).json("No stories found for this user.");
      }

      return res.status(200).json(data);
    });
  });
};

// Route to add a new story
export const addStory = async (req, res) => {
  const token = req.cookies.accessToken;

  console.log("Received Token:", token); // Log the token to verify it's being sent

  if (!token) return res.status(401).json("Not logged in!");

  jwt.verify(token, "secretkey", async (err, userInfo) => {
    if (err) {
      console.log("Token verification error:", err); // Log token verification error
      return res.status(403).json("Token is not valid!");
    }

    console.log("Decoded userInfo:", userInfo); // Log the entire decoded userInfo

    try {
      let imageArweaveId = "";
      
      // If image data is provided (i.e., the user uploads an image)
      if (req.body.img) {
        const imageData = req.body.img; // Base64 image data from the frontend
        imageArweaveId = await uploadToArweave(imageData); // Upload image to Arweave
      }

      // Insert the story data into the database, including the Arweave image ID (if available)
      const q = "INSERT INTO stories(`img`, `createdAt`, `userId`) VALUES (?)";
      const values = [
        imageArweaveId, // Store the Arweave transaction ID (which is the image URL) or empty string if no image
        moment(Date.now()).format("YYYY-MM-DD HH:mm:ss"),
        userInfo.id,
      ];

      db.query(q, [values], (err, data) => {
        if (err) {
          console.log("Database query error:", err); // Log DB query error
          return res.status(500).json(err);
        }
        return res.status(200).json("Story has been created.");
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json("Error uploading image to Arweave");
    }
  });
};

// Route to delete a story
export const deleteStory = (req, res) => {
  const token = req.cookies.accessToken;

  console.log("Received Token:", token); // Log the token to verify it's being sent

  if (!token) return res.status(401).json("Not logged in!");

  jwt.verify(token, "secretkey", (err, userInfo) => {
    if (err) {
      console.log("Token verification error:", err); // Log token verification error
      return res.status(403).json("Token is not valid!");
    }

    console.log("Decoded userInfo:", userInfo); // Log the entire decoded userInfo

    const q = "DELETE FROM stories WHERE `id`=? AND `userId` = ?";

    db.query(q, [req.params.id, userInfo.id], (err, data) => {
      if (err) {
        console.log("Database query error:", err); // Log DB query error
        return res.status(500).json(err);
      }
      if (data.affectedRows > 0)
        return res.status(200).json("Story has been deleted.");
      return res.status(403).json("You can delete only your story!");
    });
  });
};
