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
  
  return { matches };
}
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