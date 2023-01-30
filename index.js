const express = require('express');
const Web3 = require('web3');
const contractabi = require('./PancakeSwap.json'); // import the ABI for the PancakeSwap contract

const app = express();
const url = 'https://bold-black-energy.bsc.discover.quiknode.pro/c2bf115e5d95e1ee7a40bef1eb2e9bef41222bfb/';
const web3 = new Web3(new Web3.providers.HttpProvider(url));

app.get('/api/user/:address', async (req, res) => {
  const address = req.params.address;
  const contract = new web3.eth.Contract(contractabi, '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73'); // address of the PancakeSwap contract
  // get all the pools the user is providing liquidity in
  const lastBlockNumber = await web3.eth.getBlockNumber()

  let pools = [];
  for (let blockNumber = 0; blockNumber < lastBlockNumber; blockNumber+10000) {
    const events = await contract.getPastEvents('Deposit', {
      filter: { user: address },
      fromBlock: blockNumber,
      toBlock: blockNumber
    });

    events.forEach(event => {
      pools.push(event.returnValues.pool);
    });
  }
  pools = [...new Set(pools)];

  // get total liquidity the user is providing in each pool
  const totalLiquidity = await Promise.all(pools.map(pool => contract.methods.balanceOf(pool).call()));

  // get all the transaction instances where the user provided or withdrew from a pool
  const provideEvents = await contract.getPastEvents('Deposit', {
    filter: { user: address },
    fromBlock: 0,
    toBlock: 'latest'
  });
  const removeEvents = await contract.getPastEvents('Withdraw', {
    filter: { user: address },
    fromBlock: 0,
    toBlock: 'latest'
  });
  const transactions = [...provideEvents, ...removeEvents];

  res.json({ pools, totalLiquidity, transactions });
});

app.listen(8000, () => console.log(`server listening on port 8000`));