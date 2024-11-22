import Arweave from 'arweave';

// Initialize Arweave client
const arweave = Arweave.init({
  host: 'arweave.net',  // Arweave mainnet
  port: 443,
  protocol: 'https',
});

// Function to upload image to Arweave
export const uploadToArweave = async (fileBuffer, wallet) => {
  try {
    // Create a transaction with the file data
    const transaction = await arweave.createTransaction({ data: fileBuffer }, wallet);

    // Sign the transaction with the user's wallet
    await arweave.transactions.sign(transaction, wallet);

    // Post the transaction to the network
    const response = await arweave.transactions.post(transaction);

    if (response.status === 200) {
      // Return the transaction ID (TXID)
      return transaction.id;
    } else {
      throw new Error('Failed to upload to Arweave');
    }
  } catch (error) {
    throw new Error('Error uploading to Arweave: ' + error.message);
  }
};
