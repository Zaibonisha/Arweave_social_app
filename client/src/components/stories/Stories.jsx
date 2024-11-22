import { useContext, useState, useRef } from "react";
import "./stories.scss";
import { AuthContext } from "../../context/authContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { makeRequest } from "../../axios";
import Arweave from "arweave"; // Import Arweave SDK
import { toast } from "react-toastify";

const Stories = () => {
  const { currentUser } = useContext(AuthContext);

  // States for handling modal, file input, and wallet
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newStoryImage, setNewStoryImage] = useState(null);

  const fileInputRef = useRef(null);

  // Initialize Arweave client
  const arweave = Arweave.init({
    host: "arweave.net",
    port: 443,
    protocol: "https",
  });

  // Save wallet to localStorage
  const saveWallet = (wallet) => {
    localStorage.setItem("arweave-wallet", JSON.stringify(wallet));
    toast.success("Wallet uploaded successfully!");
  };

  // Load wallet from localStorage
  const loadWallet = () => {
    const walletString = localStorage.getItem("arweave-wallet");
    if (!walletString) {
      console.error("No wallet found in localStorage.");
      throw new Error("No Arweave wallet found in localStorage.");
    }
    console.log("Wallet loaded successfully.");
    return JSON.parse(walletString);
  };

  // Handle wallet upload
  const handleWalletUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const wallet = JSON.parse(reader.result);
          saveWallet(wallet); // Save wallet to localStorage
        } catch (err) {
          console.error("Invalid wallet file:", err.message);
          toast.error("Invalid wallet file format. Please upload a valid JSON wallet.");
        }
      };
      reader.readAsText(file);
    }
  };

  // Function to upload image to Arweave
  const uploadToArweave = async (file) => {
    try {
      const data = await file.arrayBuffer();
      const transaction = await arweave.createTransaction({ data });

      // Adding Content-Type tag to the transaction
      transaction.addTag("Content-Type", file.type);

      // Load wallet and sign transaction
      const wallet = loadWallet();
      await arweave.transactions.sign(transaction, wallet);

      const uploader = await arweave.transactions.getUploader(transaction);

      // Upload transaction
      while (!uploader.isComplete) {
        await uploader.uploadChunk();
      }

      return transaction.id; // Return transaction ID
    } catch (err) {
      throw new Error("Error uploading image to Arweave: " + err.message);
    }
  };

  // Fetch stories using react-query
  const { isLoading, error, data } = useQuery({
    queryKey: ["stories"],
    queryFn: () => makeRequest.get("/stories").then((res) => res.data),
  });

  // Mutation to add a new story
  const { mutate } = useMutation({
    mutationFn: async () => {
      let imgUrl = "";
      if (newStoryImage) {
        try {
          imgUrl = await uploadToArweave(newStoryImage);
        } catch (err) {
          console.error("Error uploading image to Arweave:", err.message);
          toast.error("Error uploading image to Arweave.");
          return;
        }
      }

      const formData = new FormData();
      formData.append("img", imgUrl);

      return makeRequest.post("/stories", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: () => {
      setIsModalOpen(false);
      setNewStoryImage(null);
      toast.success("Story uploaded successfully!");
    },
    onError: (err) => {
      console.error("Error adding story:", err.message);
      toast.error("Failed to upload story. Please try again.");
    },
  });

  // Handle "+" button click to open file picker
  const handleAddStoryClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    } else {
      console.error("File input ref is null");
    }
  };

  // Handle file selection
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNewStoryImage(file);
      setIsModalOpen(true);
    }
  };

  // Handle modal submit (add story)
  const handleStorySubmit = () => {
    if (newStoryImage) {
      mutate();
    } else {
      toast.error("Please select an image.");
    }
  };

  return (
    <div className="stories">
      {/* Wallet Upload */}
      <div className="wallet-upload">
        
        <input
          id="walletUpload"
          type="file"
          accept=".json"
          style={{ display: "none" }}
          onChange={handleWalletUpload}
        />
      </div>

      {/* User's profile story */}
      <div className="story">
        <img src={`/upload/${currentUser.profilePic}`} alt="profile" />
        <span>{currentUser.name}</span>
        <button onClick={handleAddStoryClick}>+</button>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />

      {/* Modal */}
      {isModalOpen && (
        <div className="modal">
          <div className="modal-content">
            <h2>Add a New Story</h2>
            <button onClick={handleStorySubmit}>Submit</button>
            <button onClick={() => setIsModalOpen(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Render stories */}
      {error
        ? "Something went wrong"
        : isLoading
        ? "Loading..."
        : data.map((story) => (
            <div className="story" key={story.id}>
              <img src={story.img} alt="" />
              <img src={`https://arweave.net/${story.img}`} alt="story" />
              <span>{story.name}</span>
            </div>
          ))}
    </div>
  );
};

export default Stories;
