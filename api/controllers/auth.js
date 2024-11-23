import { db } from "../connect.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import Arweave from "arweave";

// Initialize Arweave client
const arweave = Arweave.init({
  host: 'arweave.net',  // Arweave node URL
  port: 443,
  protocol: 'https'
});

// Function to upload data to Arweave
const uploadToArweave = async (data) => {
  const wallet = await arweave.wallets.generate(); // Generate a new wallet (replace with a real wallet in production)
  const transaction = await arweave.createTransaction({ data: JSON.stringify(data) }, wallet);
  await arweave.transactions.sign(transaction, wallet);
  await arweave.transactions.post(transaction);
  return transaction.id; // Return the transaction ID (the Arweave URL can be constructed from this)
};

export const register = (req, res) => {
  // Check if the user exists
  const q = "SELECT * FROM users WHERE username = ?";

  db.query(q, [req.body.username], async (err, data) => {
    if (err) return res.status(500).json(err);
    if (data.length) return res.status(409).json("User already exists!");

    // Hash the password
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(req.body.password, salt);

    // Upload profile data to Arweave
    const profileData = {
      username: req.body.username,
      email: req.body.email,
      name: req.body.name
    };

    try {
      const arweaveTransactionId = await uploadToArweave(profileData);

      // Store user data in the traditional database, including Arweave transaction ID
      const q =
        "INSERT INTO users (`username`, `email`, `password`, `name`, `arweave_transaction_id`) VALUES (?)";
      const values = [
        req.body.username,
        req.body.email,
        hashedPassword,
        req.body.name,
        arweaveTransactionId // Save the Arweave transaction ID
      ];

      db.query(q, [values], (err, data) => {
        if (err) return res.status(500).json(err);
        return res.status(200).json("User has been created.");
      });
    } catch (err) {
      return res.status(500).json("Error uploading to Arweave: " + err.message);
    }
  });
};

export const login = (req, res) => {
  const q = "SELECT * FROM users WHERE username = ?";

  db.query(q, [req.body.username], (err, data) => {
    if (err) return res.status(500).json(err);
    if (data.length === 0) return res.status(404).json("User not found!");

    const checkPassword = bcrypt.compareSync(req.body.password, data[0].password);

    if (!checkPassword)
      return res.status(400).json("Wrong password or username!");

    const token = jwt.sign({ id: data[0].id }, "secretkey");

    const { password, ...others } = data[0];

    res.cookie("accessToken", token, {
      httpOnly: true,
    }).status(200).json(others);
  });
};

export const logout = (req, res) => {
  res.clearCookie("accessToken", {
    secure: true,
    sameSite: "none"
  }).status(200).json("User has been logged out.");
};
