import "./share.scss";
import Image from "../../assets/img.png";
import VideoIcon from "../../assets/4.png";
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
  const [fileType, setFileType] = useState(""); // Track the file type (image or video)
  const [desc, setDesc] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { currentUser } = useContext(AuthContext);
  const queryClient = useQueryClient();

  const arweave = Arweave.init({
    host: "arweave.net",
    port: 443,
    protocol: "https",
  });

  const loadWallet = () => {
    const walletString = localStorage.getItem("arweave-wallet");
    if (!walletString) {
      throw new Error("No Arweave wallet found in localStorage.");
    }
    return JSON.parse(walletString);
  };

  const uploadWallet = (wallet) => {
    localStorage.setItem("arweave-wallet", JSON.stringify(wallet));
    toast.success("Wallet uploaded successfully!");
  };

  const handleWalletUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const wallet = JSON.parse(reader.result);
          uploadWallet(wallet); // Calls the uploadWallet function
        } catch (err) {
          toast.error("Invalid wallet file. Please try again.");
        }
      };
      reader.readAsText(file);
    }
  };

  const uploadToArweave = async (file) => {
    try {
      const data = await file.arrayBuffer();
      const transaction = await arweave.createTransaction({ data });

      transaction.addTag("Content-Type", file.type);

      const wallet = loadWallet();
      await arweave.transactions.sign(transaction, wallet);

      const uploader = await arweave.transactions.getUploader(transaction);
      while (!uploader.isComplete) {
        await uploader.uploadChunk();
      }

      return transaction.id;
    } catch (err) {
      throw new Error("Error uploading file to Arweave: " + err.message);
    }
  };

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

  const handleClick = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    let fileUrl = "";
    if (file) {
      try {
        fileUrl = await uploadToArweave(file);
      } catch (err) {
        setIsLoading(false);
        toast.error("Error uploading file to Arweave.");
        return;
      }
    }

    mutation.mutate({ desc, file: fileUrl, fileType });
    setDesc("");
    setFile(null);
    setFileType(""); // Reset file type
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setFileType(selectedFile.type.startsWith("image") ? "image" : "video");
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
            {file && fileType === "image" && (
              <img className="file" alt="uploaded image" src={URL.createObjectURL(file)} />
            )}
            {file && fileType === "video" && (
              <video className="file" controls>
                <source src={URL.createObjectURL(file)} type={file.type} />
                Your browser does not support the video tag.
              </video>
            )}
          </div>
        </div>
        <hr />
        <div className="bottom">
          <div className="left">
            <input
              type="file"
              id="file"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
            <label htmlFor="file">
              <div className="item">
                <img src={Image} alt="Add Image" />
                <span>Add Image</span>
              </div>
            </label>
            <input
              type="file"
              id="video"
              style={{ display: "none" }}
              accept="video/*"
              onChange={handleFileChange}
            />
            <label htmlFor="video">
              <div className="item">
                <img src={VideoIcon} alt="Add Video" />
                <span>Add Video</span>
              </div>
            </label>
            <div className="item">
              <img src={Map} alt="Location" />
              <span>Location</span>
            </div>
            <div className="item">
              <img src={Friend} alt="Tag Friends" />
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
            onChange={handleWalletUpload} // Now this function is defined
          />
        </div>
      </div>
    </div>
  );
};

export default Share;
