import { BigNumberish, ethers } from "ethers";
import { DefenderRelaySigner, DefenderRelayProvider } from 'defender-relay-client/lib/ethers';

const healthFactorMax = 1 //liquidation can happen when less than 1
const theGraphURL = 'https://api.thegraph.com/subgraphs/name/sturdyfi/sturdy-fantom';
const reserveAssets = {
  DAI: '0x8D11eC38a3EB5E956B052f67Da8Bdc9bef8Abf3E',
  USDC: '0x04068DA6C83AFCFA0e13ba15A6696662335D5B75',
  fUSDT: '0x049d68029688eAbF473097a2fC38ef61633A3C7A',
  yvWFTM: '0x0DEC85e74A92c52b7F708c4B10207D9560CEFaf0',
  // yvWETH: '0xCe2Fc0bDc18BD6a4d9A725791A3DEe33F3a23BB7',
  // yvWBTC: '0xd817A100AB8A29fE3DBd925c2EB489D67F758DA9',
  yvBOO: '0x0fBbf9848D969776a5Eb842EdAfAf29ef4467698',
  // mooTOMB_FTM: '0x27c77411074ba90cA35e6f92A79dAd577c05A746',
  // mooTOMB_MIMATIC: '0xb2be5Cd33DBFf412Bce9587E44b5647a4BdA6a66'
};

const collateralAsset = {
  yvWFTM: '0x21be370D5312f44cB42ce377BC9b8a0cEF1A4C83',   //WFTM
  // yvWETH: '0x74b23882a30290451a17c44f4f05243b6b58c76d',   //WETH
  // yvWBTC: '0x321162Cd933E2Be498Cd2267a90534A804051b11',    //WBTC
  yvBOO: '0x841FAD6EAe12c286d1Fd18d1d525DFfA75C7EFFE',    //BOO
  // mooTOMB_FTM: '0x2A651563C9d3Af67aE0388a5c8F89b867038089e',    //TOMB_FTM_LP
  // mooTOMB_MIMATIC: '0x45f4682B560d4e3B8FF1F1b3A38FDBe775C7177b',  //TOMB_MIMATIC_LP
}
const liquidation = async (
  signer,
  collateralAssetSymbol: string, 
  debtAssetSymbol: string,
  user: string,
  debtToCover: BigNumberish
) => {
  try {
    const LIQUIDATOR_ABI = [{"inputs":[{"internalType":"contractILendingPoolAddressesProvider","name":"_provider","type":"address"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"inputs":[{"internalType":"address[]","name":"assets","type":"address[]"},{"internalType":"uint256[]","name":"amounts","type":"uint256[]"},{"internalType":"uint256[]","name":"premiums","type":"uint256[]"},{"internalType":"address","name":"initiator","type":"address"},{"internalType":"bytes","name":"params","type":"bytes"}],"name":"executeOperation","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"debtAsset","type":"address"},{"internalType":"uint256","name":"debtToCover","type":"uint256"},{"internalType":"bytes","name":"params","type":"bytes"}],"name":"liquidation","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"asset","type":"address"}],"name":"withdraw","outputs":[],"stateMutability":"nonpayable","type":"function"}];
    const liquidator = new ethers.Contract('0x6A66593b1E832B33897d1A26e8C8A5170201Fd37', LIQUIDATOR_ABI, signer);
    const abiEncoder = new ethers.utils.AbiCoder();
    const encodedData = abiEncoder.encode(
      ["address", "address"],
      [collateralAsset[collateralAssetSymbol], user]
    );
    
    const _tx = await liquidator.liquidation(
      reserveAssets[debtAssetSymbol],
      debtToCover,
      encodedData
    );

    console.log("gas price: ", _tx.gasPrice?.toString());
    console.log("gas Limit: ", _tx.gasLimit.toString());
    
    console.log("Send Transaction Success");    
  } catch (e) {
    console.log(e);
  }
}

const parseUsers = (payload, prices) => {
  var loans:Array<any> = [];
  payload.users.forEach((user, i) => {
    var totalBorrowed = 0;
    var totalCollateralThreshold = 0;
    var max_borrowedSymbol;
    var max_borrowedPrincipal = 0;
    var max_collateralSymbol;
    var max_collateralBonus = 0;

    user.borrowReserve.forEach((borrowReserve, i) => {
      var priceInEth = prices[borrowReserve.reserve.symbol];
      var principalBorrowed = borrowReserve.currentTotalDebt
      totalBorrowed += priceInEth * principalBorrowed / (10 ** borrowReserve.reserve.decimals)
      if (principalBorrowed > max_borrowedPrincipal) {
        max_borrowedSymbol = borrowReserve.reserve.symbol
        max_borrowedPrincipal = principalBorrowed
      }
    });
    user.collateralReserve.forEach((collateralReserve, i) => {
      var priceInEth = prices[collateralReserve.reserve.symbol];
      var principalATokenBalance = collateralReserve.currentATokenBalance
      if (collateralReserve.reserve.baseLTVasCollateral == 0)
        return;
      totalCollateralThreshold += priceInEth * principalATokenBalance * (collateralReserve.reserve.reserveLiquidationThreshold / 10000) / (10 ** collateralReserve.reserve.decimals)
      if (collateralReserve.reserve.reserveLiquidationBonus > max_collateralBonus) {
        max_collateralSymbol = collateralReserve.reserve.symbol
        max_collateralBonus = collateralReserve.reserve.reserveLiquidationBonus
      }
    });
    var healthFactor= totalCollateralThreshold / totalBorrowed;

    if (healthFactor <= healthFactorMax) {
      loans.push( {
        "user_id"  :  user.id,
        "healthFactor"   :  healthFactor,
        "max_collateralSymbol" : max_collateralSymbol,
        "max_borrowedSymbol" : max_borrowedSymbol,
        "max_borrowedPrincipal" : max_borrowedPrincipal,
      })
    }
  });

  return loans;
}

const fetchPrices = async (signer) => {
  const PRICE_ORACLE_ABI = [{"inputs":[{"internalType":"address[]","name":"assets","type":"address[]"},{"internalType":"address[]","name":"sources","type":"address[]"},{"internalType":"address","name":"fallbackOracle","type":"address"},{"internalType":"address","name":"baseCurrency","type":"address"},{"internalType":"uint256","name":"baseCurrencyUnit","type":"uint256"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"asset","type":"address"},{"indexed":true,"internalType":"address","name":"source","type":"address"}],"name":"AssetSourceUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"baseCurrency","type":"address"},{"indexed":false,"internalType":"uint256","name":"baseCurrencyUnit","type":"uint256"}],"name":"BaseCurrencySet","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"fallbackOracle","type":"address"}],"name":"FallbackOracleUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"inputs":[],"name":"BASE_CURRENCY","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"BASE_CURRENCY_UNIT","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"asset","type":"address"}],"name":"getAssetPrice","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address[]","name":"assets","type":"address[]"}],"name":"getAssetsPrices","outputs":[{"internalType":"uint256[]","name":"","type":"uint256[]"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getFallbackOracle","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"asset","type":"address"}],"name":"getSourceOfAsset","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address[]","name":"assets","type":"address[]"},{"internalType":"address[]","name":"sources","type":"address[]"}],"name":"setAssetSources","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"fallbackOracle","type":"address"}],"name":"setFallbackOracle","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"}];
  const oracle = new ethers.Contract('0xE84fD77E8B7bB52a71087653a26d6CC6448fb77D', PRICE_ORACLE_ABI, signer);
  
  const prices = {};
  for (const [key, value] of Object.entries(reserveAssets)) {
    prices[key] = await oracle.getAssetPrice(value as string);
  }

  return prices;
}

const fetchUnhealthyLoans = async (signer, process?, user_id?) => {
  var count=0;
  var maxCount=6
  var user_id_query=""

  if(user_id){
    user_id_query = `id: "${user_id}",`
    maxCount = 1
  }
  console.log(`${Date().toLocaleString()} fetching unhealthy loans`)
  while(count < maxCount){
    const data = await fetch(theGraphURL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `
        query GET_LOANS {
          users(first:1000, skip:${1000*count}, orderBy: id, orderDirection: desc, where: {${user_id_query}borrowedReservesCount_gt: 0}) {
            id
            borrowedReservesCount
            collateralReserve:reserves(where: {currentATokenBalance_gt: 0}) {
              currentATokenBalance
              reserve{
                usageAsCollateralEnabled
                baseLTVasCollateral
                reserveLiquidationThreshold
                reserveLiquidationBonus
                borrowingEnabled
                utilizationRate
                symbol
                underlyingAsset
                decimals
              }
            }
            borrowReserve: reserves(where: {currentTotalDebt_gt: 0}) {
              currentTotalDebt
              reserve{
                usageAsCollateralEnabled
                reserveLiquidationThreshold
                borrowingEnabled
                utilizationRate
                symbol
                underlyingAsset
                decimals
              }
            }
          }
        }`
      }),
    })
    const result = await data.json();
    const prices = await fetchPrices(signer);

    const total_loans = result.data.users.length
    const unhealthyLoans = parseUsers(result.data, prices);
    if(unhealthyLoans.length > 0) {
      console.log(unhealthyLoans);
      if (process) {
        for (let i = 0; i < unhealthyLoans.length; i++) { 
          await liquidation(
            signer,
            unhealthyLoans[i].max_collateralSymbol,
            unhealthyLoans[i].max_borrowedSymbol,
            unhealthyLoans[i].user_id,
            unhealthyLoans[i].max_borrowedPrincipal
          );
        }
      }
    }

    if(total_loans > 0) console.log(`Records:${total_loans} Unhealthy:${unhealthyLoans.length}`)
    count++;
  }
}

// Main function, exported separately for testing
async function main(signer: DefenderRelaySigner) {
  await fetchUnhealthyLoans(signer, true);
  console.log(`Perfom Oracle TWAP calculation`);
}

// Entrypoint for the Autotask
export async function handler(credentials) {
  // Initialize defender relayer provider and signer
  const provider = new DefenderRelayProvider(credentials);
  const signer = new DefenderRelaySigner(credentials, provider, { speed: 'fast' });
  return main(signer);
}

// To run locally (this code will not be executed in Autotasks)
if (require.main === module) {
  require('dotenv').config();
  const { API_KEY: apiKey, API_SECRET: apiSecret } = process.env;
  handler({ apiKey, apiSecret })
    .then(() => process.exit(0))
    .catch(error => { console.error(error); process.exit(1); });
}