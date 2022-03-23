import { BigNumber } from "ethers";
import fetch from "node-fetch";

const theGraphURL = 'https://api.thegraph.com/subgraphs/name/sturdyfi/sturdy-fantom';

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

const checkUnderCollateralized = async (assetAddress: string, borrowAmount: BigNumber, borrower: string) => {
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
        .mul(item.reserve.price.priceInEth)
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
  if (borrowablePrice.gt(totalDebtPrice))
    return true;
  
  return false;
}

// Entrypoint for the Autotask
export async function handler(payload) {
  const conditionRequest = payload.request.body;
  const matches: Array<any> = [];
  const evt = conditionRequest.events[0];

  console.log(evt.matchReasons);
  // On withdraw case, check the largest deposit amount > withdraw amount
  const withdrawReasons = evt.matchReasons.filter((item) => item.signature.indexOf('Withdraw') >= 0);
  for(const reason of withdrawReasons) {
    if (await checkLargestDepositCondition(reason.params.reserve, BigNumber.from(reason.params.amount))) {
      matches.push({
        txHash: evt.hash,
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
    if (await checkUnderCollateralized(reason.params.reserve, BigNumber.from(reason.params.amount), reason.params.onBehalfOf)) {
      matches.push({
        txHash: evt.hash,
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
// // check withdraw case
// handler({ request: { body: { events: [{ matchReasons: [
//   {
//     type: 'event',
//     signature: 'Withdraw(address,address,address,uint256)',
//     args: [
//       '0x04068DA6C83AFCFA0e13ba15A6696662335D5B75',
//       '0x1c5704c56855E196E6d125f2d96091DB85b3fBEE',
//       '0x1c5704c56855E196E6d125f2d96091DB85b3fBEE',
//       '18000000'
//     ],
//     params: {
//       reserve: '0x04068DA6C83AFCFA0e13ba15A6696662335D5B75',
//       user: '0x1c5704c56855E196E6d125f2d96091DB85b3fBEE',
//       to: '0x1c5704c56855E196E6d125f2d96091DB85b3fBEE',
//       amount: '18000000'
//     }
//   }
// ],
// hash: "0x00000000000000000000000"}]}}
// })

// check borrow case
// handler({ request: { body: { events: [{ matchReasons: [
//   {
//     type: 'event',
//     signature: 'Borrow(address,address,address,uint256,uint256,uint256,uint16)',
//     args: [
//       '0x04068DA6C83AFCFA0e13ba15A6696662335D5B75',
//       '0xA6554D85b945Ce01505005bb07e56e6126259686',
//       '0xA6554D85b945Ce01505005bb07e56e6126259686',
//       '75000000',
//       '2',
//       '0',
//       0
//     ],
//     params: {
//       reserve: '0x04068DA6C83AFCFA0e13ba15A6696662335D5B75',
//       user: '0xA6554D85b945Ce01505005bb07e56e6126259686',
//       onBehalfOf: '0xA6554D85b945Ce01505005bb07e56e6126259686',
//       amount: '75000000',
//       borrowRateMode: '2',
//       borrowRate: '0',
//       referral: 0
//     }
//   }
// ],
// hash: "0x00000000000000000000000"}]}}
// })