import { ethers } from "ethers";
import { DefenderRelaySigner, DefenderRelayProvider } from 'defender-relay-client/lib/ethers';

// Main function, exported separately for testing
export async function main(signer: DefenderRelaySigner, contractAddress: string) {
  // Create contract instance from the relayer signer
  const TOMB_MIMATIC_LP_ORACLE_ABI = [{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"inputs":[],"name":"MIMATIC_USD","outputs":[{"internalType":"contractIChainlinkAggregator","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"PERIOD","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"TOMB_MIMATIC","outputs":[{"internalType":"contractIUniswapV2Pair","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"bool","name":"enable","type":"bool"}],"name":"enableCumulativePrice","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"get","outputs":[{"internalType":"bool","name":"","type":"bool"},{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"latestAnswer","outputs":[{"internalType":"int256","name":"rate","type":"int256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"pairInfo","outputs":[{"internalType":"uint256","name":"priceCumulativeLast","type":"uint256"},{"internalType":"uint256","name":"priceAverage","type":"uint256"},{"internalType":"uint32","name":"blockTimestampLast","type":"uint32"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"peek","outputs":[{"internalType":"bool","name":"","type":"bool"},{"internalType":"int256","name":"","type":"int256"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"}];
  const oracle = new ethers.Contract(contractAddress, TOMB_MIMATIC_LP_ORACLE_ABI, signer);

  const tx = await oracle.get();
  console.log(`Perfom Oracle TWAP calculation`);
  return tx;
}

// Entrypoint for the Autotask
export async function handler(credentials) {
  // Initialize defender relayer provider and signer
  const provider = new DefenderRelayProvider(credentials);
  const signer = new DefenderRelaySigner(credentials, provider, { speed: 'fast' });
  // Fantom mainnet TombMiMaticLPOracle address
  const contractAddress = '0xa26a6F2eB4Bc7005aF8eA5a1dd5B7bc1d8973592';
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