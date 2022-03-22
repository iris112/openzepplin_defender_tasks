import { BigNumber } from "ethers";

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
          where: {reserve_contains: ${assetAddress}}
        ) {
          currentATokenBalance
        }
      }`
    }),
  })
  const result = await data.json();
  console.log(result);
  if (result.data.userReserves.length && withdrawBalance.gt(result.data.userReserves[0].currentATokenBalance))
    return true;
  
  return false;
}

// Entrypoint for the Autotask
export async function handler(payload) {
  const conditionRequest = payload.request.body;
  const matches: Array<any> = [];
  const evt = conditionRequest.events[0];

  // On withdraw case, check the largest deposit amount > withdraw amount
  const withdrawReasons = evt.matchReasons.filter((item) => item.signature.indexOf('Withdraw'));
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