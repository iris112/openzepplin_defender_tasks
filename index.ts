import { ethers } from "ethers";
import { DefenderRelaySigner, DefenderRelayProvider } from 'defender-relay-client/lib/ethers';

// Main function, exported separately for testing
export async function main(signer: DefenderRelaySigner, contractAddress: string) {
  // Create contract instance from the relayer signer
  const ABI = [{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"_asset","type":"address"},{"indexed":false,"internalType":"uint256","name":"_price","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"AssetPriceUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"uint256","name":"_price","type":"uint256"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"EthPriceUpdated","type":"event"},{"inputs":[{"internalType":"address","name":"_asset","type":"address"}],"name":"getAssetPrice","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getEthUsdPrice","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"_asset","type":"address"},{"internalType":"uint256","name":"_price","type":"uint256"}],"name":"setAssetPrice","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"uint256","name":"_price","type":"uint256"}],"name":"setEthUsdPrice","outputs":[],"stateMutability":"nonpayable","type":"function"}];
  const priceOracle = new ethers.Contract(contractAddress, ABI, signer);

  // Check relayer balance via the Defender network provider
  const relayer = await signer.getAddress();

  const tx = await priceOracle.setAssetPrice('0x8D11eC38a3EB5E956B052f67Da8Bdc9bef8Abf3E', 268047349837000);
  console.log(`Set Asset Price`);
  return tx;
}

// Entrypoint for the Autotask
export async function handler(credentials) {
  // Initialize defender relayer provider and signer
  const provider = new DefenderRelayProvider(credentials);
  const signer = new DefenderRelaySigner(credentials, provider, { speed: 'fast' });
  const contractAddress = '0x40aF3dF2B582a9055FbFAdD57f504B334218c2CD';
  return main(signer, contractAddress);
}

// To run locally (this code will not be executed in Autotasks)
if (require.main === module) {
  require('dotenv').config();
  const { API_KEY: apiKey, API_SECRET: apiSecret } = process.env;
  handler({ apiKey, apiSecret })
    .then(() => process.exit(0))
    .catch(error => { console.error(error); process.exit(1); });
}