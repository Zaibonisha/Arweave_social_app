import "./share.scss";
import Image from "../../assets/img.png";
import Map from "../../assets/map.png";
import Friend from "../../assets/friend.png";
import { useContext, useState } from "react";
import { AuthContext } from "../../context/authContext";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { makeRequest } from "../../axios";
import Arweave from "arweave";
import { toast } from "react-toastify";

const Share = () => {
  const [file, setFile] = useState(null);
  const [desc, setDesc] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { currentUser } = useContext(AuthContext);
  const queryClient = useQueryClient();

  // Initialize Arweave client
  const arweave = Arweave.init({
    host: "arweave.net",
    port: 443,
    protocol: "https",
  });

  // Load wallet from localStorage
  const loadWallet = () => {
    const walletString = localStorage.getItem("arweave-wallet");
    if (!walletString) {
      throw new Error("No Arweave wallet found in localStorage.");
    }
    return JSON.parse(walletString);
  };

  // Upload wallet to localStorage
  const uploadWallet = (wallet) => {
    localStorage.setItem("arweave-wallet", JSON.stringify(wallet));
    toast.success("Wallet uploaded successfully!");
  };

  // Function to upload image to Arweave
  const uploadToArweave = async (file) => {
    try {
      const data = await file.arrayBuffer();
      const transaction = await arweave.createTransaction({ data });

      // Add Content-Type tag
      transaction.addTag("Content-Type", file.type);

      // Load the wallet
      const wallet = loadWallet();

      // Sign the transaction
      await arweave.transactions.sign(transaction, wallet);

      // Upload the transaction
      const uploader = await arweave.transactions.getUploader(transaction);
      while (!uploader.isComplete) {
        await uploader.uploadChunk();
      }

      return transaction.id; // Return transaction ID
    } catch (err) {
      throw new Error("Error uploading image to Arweave: " + err.message);
    }
  };

  // Mutation to post a new post
  const mutation = useMutation({
    mutationFn: (newPost) => makeRequest.post("/posts", newPost),
    onSuccess: () => {
      queryClient.invalidateQueries(["posts"]);
      setIsLoading(false);
      toast.success("Post shared successfully!");
    },
    onError: (error) => {
      setIsLoading(false);
      toast.error("Error occurred while posting. Please try again.");
    },
  });

  // Handle the share button click
  const handleClick = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    let imgUrl = "";
    if (file) {
      try {
        imgUrl = await uploadToArweave(file);
      } catch (err) {
        setIsLoading(false);
        toast.error("Error uploading image to Arweave.");
        return;
      }
    }

    mutation.mutate({ desc, img: imgUrl });
    setDesc("");
    setFile(null);
  };

  // Handle file upload for wallet
  const handleWalletUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const wallet = JSON.parse(reader.result);
          uploadWallet(wallet);
        } catch (err) {
          toast.error("Invalid wallet file. Please try again.");
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div className="share">
      <div className="container">
        <div className="top">
          <div className="left">
            <img src={`/upload/${currentUser.profilePic}`} alt="profile" />
            <input
              type="text"
              placeholder={`What's on your mind ${currentUser.name}?`}
              onChange={(e) => setDesc(e.target.value)}
              value={desc}
            />
          </div>
          <div className="right">
            {file && <img className="file" alt="uploaded file" src={URL.createObjectURL(file)} />}
          </div>
        </div>
        <hr />
        <div className="bottom">
          <div className="left">
            <input
              type="file"
              id="file"
              style={{ display: "none" }}
              onChange={(e) => setFile(e.target.files[0])}
            />
            <label htmlFor="file">
              <div className="item">
                <img src={Image} alt="Add Image" />
                <span>Add Image</span>
              </div>
            </label>
            <div className="item">
              <img src={Map} alt="Location" />
              <span>Location</span>
            </div>
            <div className="item">
              <img src={Friend} alt="Tag Friend" />
              <span>Tag Friends</span>
            </div>
          </div>
          <div className="right">
            <button onClick={handleClick} disabled={isLoading}>
              {isLoading ? "Posting..." : "Share"}
            </button>
          </div>
        </div>
        <hr />
        <div className="wallet-upload">
          <input
            type="file"
            id="wallet"
            style={{ display: "none" }}
            accept=".json"
            onChange={handleWalletUpload}
          />
          
        </div>
      </div>
    </div>
  );
};

export default Share;

