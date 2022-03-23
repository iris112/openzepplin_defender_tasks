import { DefenderRelayProvider, DefenderRelaySigner } from "defender-relay-client/lib/ethers";
import { BigNumber, ethers } from "ethers";
import fetch from "node-fetch";

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
  mooTOMB_MIMATIC: '0xb2be5Cd33DBFf412Bce9587E44b5647a4BdA6a66'
};

const checkLargestDepositCondition = async (assetAddress:string, withdrawBalance: BigNumber) => {
  const data = await fetch(theGraphURL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `
      query GET_LARGEST_DEPOSIT {
        userReserves(
          orderBy: currentATokenBalance
          first: 1
          orderDirection: desc
          where: {reserve_contains: "${assetAddress.toLowerCase()}"}
        ) {
          currentATokenBalance
        }
      }`
    }),
  })
  const result = await data.json();
  console.log(result.data.userReserves);
  if (result.data.userReserves.length && withdrawBalance.gt(result.data.userReserves[0].currentATokenBalance))
    return true;
  
  return false;
}

const checkUnderCollateralized = async (assetAddress: string, borrowAmount: BigNumber, borrower: string, signer) => {
  const PRICE_ORACLE_ABI = [{"inputs":[{"internalType":"address[]","name":"assets","type":"address[]"},{"internalType":"address[]","name":"sources","type":"address[]"},{"internalType":"address","name":"fallbackOracle","type":"address"},{"internalType":"address","name":"baseCurrency","type":"address"},{"internalType":"uint256","name":"baseCurrencyUnit","type":"uint256"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"asset","type":"address"},{"indexed":true,"internalType":"address","name":"source","type":"address"}],"name":"AssetSourceUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"baseCurrency","type":"address"},{"indexed":false,"internalType":"uint256","name":"baseCurrencyUnit","type":"uint256"}],"name":"BaseCurrencySet","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"fallbackOracle","type":"address"}],"name":"FallbackOracleUpdated","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"previousOwner","type":"address"},{"indexed":true,"internalType":"address","name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},{"inputs":[],"name":"BASE_CURRENCY","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"BASE_CURRENCY_UNIT","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"asset","type":"address"}],"name":"getAssetPrice","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address[]","name":"assets","type":"address[]"}],"name":"getAssetsPrices","outputs":[{"internalType":"uint256[]","name":"","type":"uint256[]"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"getFallbackOracle","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[{"internalType":"address","name":"asset","type":"address"}],"name":"getSourceOfAsset","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"owner","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"renounceOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address[]","name":"assets","type":"address[]"},{"internalType":"address[]","name":"sources","type":"address[]"}],"name":"setAssetSources","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"fallbackOracle","type":"address"}],"name":"setFallbackOracle","outputs":[],"stateMutability":"nonpayable","type":"function"},{"inputs":[{"internalType":"address","name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"stateMutability":"nonpayable","type":"function"}];
  const oracle = new ethers.Contract('0xE84fD77E8B7bB52a71087653a26d6CC6448fb77D', PRICE_ORACLE_ABI, signer);
  const booPrice = await oracle.getAssetPrice(reserveAssets.yvBOO);
  console.log("booPrice: ", booPrice.toString());
  const mooTombMimaticPrice = await oracle.getAssetPrice(reserveAssets.mooTOMB_MIMATIC);
  console.log("mooTombMimaticPrice: ", mooTombMimaticPrice.toString());
  const data = await fetch(theGraphURL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: `
      query GET_COLLATERAL {
        user(id: "${borrower.toLowerCase()}") {
          reserves(where: {usageAsCollateralEnabledOnUser: true}) {
            reserve {
              symbol
              decimals
              totalLiquidity
              baseLTVasCollateral
              price {
                priceInEth
              }
            }
          }
        }
        userReserves(where: {user: "${borrower.toLowerCase()}"}) {
          currentTotalDebt
          reserve {
            underlyingAsset
            decimals
            price {
              priceInEth
            }
          }
          borrowHistory(orderBy: timestamp, first: 1, orderDirection: desc) {
            amount
            timestamp
            reserve {
              underlyingAsset
            }
          }
        }
        reserve(id: "${assetAddress.toLowerCase()}0x3b8569df88a70ecae31a6bca1fc3d51bd426189d") {
          decimals
          price {
            priceInEth
          }
        }
      }`
    }),
  })
  const result = await data.json();
  console.log("currentTime: ", new Date().getTime());

  //Calc borrowable price from collateral($, decimal 8)
  let borrowablePrice = BigNumber.from(0);
  result.data.user.reserves.forEach((item) => {
    borrowablePrice = borrowablePrice.add(
      BigNumber.from(item.reserve.totalLiquidity)
        .mul(item.reserve.symbol == 'yvBOO' ? booPrice : item.reserve.symbol == 'mooTOMB_MIMATIC' ? mooTombMimaticPrice : item.reserve.price.priceInEth)
        .div(Number(10 ** item.reserve.decimals).toFixed())
        .mul(item.reserve.baseLTVasCollateral)
        .div(10000)
    );
  })

  //Calc total borrowed price($, decimal 8)
  let totalDebtPrice = BigNumber.from(0);
  result.data.userReserves.forEach((item) => {
    totalDebtPrice = totalDebtPrice.add(
      BigNumber.from(item.currentTotalDebt)
        .mul(item.reserve.price.priceInEth)
        .div(Number(10 ** item.reserve.decimals).toFixed())
    )
    if (item.borrowHistory.length > 0) {
      if (BigNumber.from(item.borrowHistory[0].amount).eq(borrowAmount) &&
          assetAddress == item.borrowHistory[0].reserve.underlyingAsset &&
          Number(item.borrowHistory[0].timestamp) > new Date().getTime() - 300) {
        totalDebtPrice = totalDebtPrice.sub(
          BigNumber.from(item.borrowHistory[0].amount)
            .mul(item.reserve.price.priceInEth)
            .div(Number(10 ** item.reserve.decimals).toFixed())
        )
      }
    }
  })
  totalDebtPrice = totalDebtPrice.add(
    borrowAmount.mul(result.data.reserve.price.priceInEth).div(10 ** Number(result.data.reserve.decimals))
  )

  console.log("borrowablePrice: ", borrowablePrice.div(10 ** 8).toString(), '$')
  console.log("totalDebt: ", totalDebtPrice.div(10 ** 8).toString(), '$')
  if (totalDebtPrice.gt(borrowablePrice))
    return true;
  
  return false;
}

// Entrypoint for the Autotask
export async function handler(payload) {
  // Initialize defender relayer provider and signer
  const provider = new DefenderRelayProvider(payload);
  const signer = new DefenderRelaySigner(payload, provider, { speed: 'fast' });
  const conditionRequest = payload.request.body;
  const matches: Array<any> = [];
  const evt = conditionRequest.events[0];

  console.log(evt.matchReasons);
  // On withdraw case, check the largest deposit amount > withdraw amount
  const withdrawReasons = evt.matchReasons.filter((item) => item.signature.indexOf('Withdraw') >= 0);
  for(const reason of withdrawReasons) {
    if (await checkLargestDepositCondition(reason.params.reserve, BigNumber.from(reason.params.amount))) {
      matches.push({
        hash: evt.hash,
        metadata: {
         "Condition": "BiggerThanLargestDepositAmount",
         "Details" : {
          "amount": reason.params.amount,
          "asset": reason.params.reserve
         },
         "timestamp": new Date().getTime(),
        }
     });

     return { matches };
    }
  }

  // On borrow case, check the collateral
  const borrowReasons = evt.matchReasons.filter((item) => item.signature.indexOf('Borrow') >= 0);
  for(const reason of borrowReasons) {
    if (await checkUnderCollateralized(reason.params.reserve, BigNumber.from(reason.params.amount), reason.params.onBehalfOf, signer)) {
      matches.push({
        hash: evt.hash,
        metadata: {
         "Condition": "BorrowUnderCollateralized",
         "Details" : {
          "amount": reason.params.amount,
          "asset": reason.params.reserve,
          "user": reason.params.user,
          "onBehalfOf": reason.params.onBehalfOf
         },
         "timestamp": new Date().getTime(),
        }
     });

     return { matches };
    }
  }
  
  return { matches };
}

// // To run locally (this code will not be executed in Autotasks)
// if (require.main === module) {
//   require('dotenv').config();
//   const { API_KEY: apiKey, API_SECRET: apiSecret } = process.env;
//   handler({ apiKey, apiSecret, request: { 
//     body: { 
//       events: [{ matchReasons: [
//         {
//           type: 'event',
//           signature: 'Withdraw(address,address,address,uint256)',
//           args: [
//             '0x04068DA6C83AFCFA0e13ba15A6696662335D5B75',
//             '0x1c5704c56855E196E6d125f2d96091DB85b3fBEE',
//             '0x1c5704c56855E196E6d125f2d96091DB85b3fBEE',
//             '18000000'
//           ],
//           params: {
//             reserve: '0x04068DA6C83AFCFA0e13ba15A6696662335D5B75',
//             user: '0x1c5704c56855E196E6d125f2d96091DB85b3fBEE',
//             to: '0x1c5704c56855E196E6d125f2d96091DB85b3fBEE',
//             amount: '18000000'
//           }
//         }
//       ],
//       hash: "0x00000000000000000000000"
//       }]
//     }
//   }})
//     .then(() => process.exit(0))
//     .catch(error => { console.error(error); process.exit(1); });
// }

// // check borrow case
// if (require.main === module) {
//   require('dotenv').config();
//   const { API_KEY: apiKey, API_SECRET: apiSecret } = process.env;
//   handler({ apiKey, apiSecret, request: { 
//     body: { 
//       events: [{ matchReasons: [
//         {
//           type: 'event',
//           signature: 'Borrow(address,address,address,uint256,uint256,uint256,uint16)',
//           args: [
//             '0x04068DA6C83AFCFA0e13ba15A6696662335D5B75',
//             '0xA6554D85b945Ce01505005bb07e56e6126259686',
//             '0xA6554D85b945Ce01505005bb07e56e6126259686',
//             '75000000',
//             '2',
//             '0',
//             0
//           ],
//           params: {
//             reserve: '0x04068DA6C83AFCFA0e13ba15A6696662335D5B75',
//             user: '0xA6554D85b945Ce01505005bb07e56e6126259686',
//             onBehalfOf: '0xA6554D85b945Ce01505005bb07e56e6126259686',
//             amount: '75000000',
//             borrowRateMode: '2',
//             borrowRate: '0',
//             referral: 0
//           }
//         }
//       ],
//       hash: "0x00000000000000000000000"}]
//     }
//   }})
//     .then(() => process.exit(0))
//     .catch(error => { console.error(error); process.exit(1); });
// }