const express = require('express');
const Web3 = require('web3');
const abi = require('./PancakeSwap.json'); // import the ABI for the PancakeSwap contract

const app = express();
const url = 'https://bold-black-energy.bsc.discover.quiknode.pro/c2bf115e5d95e1ee7a40bef1eb2e9bef41222bfb/';
const web3 = new Web3(new Web3.providers.HttpProvider(url));
app.get('/api/user/:address', async (req, res) => {
  const address = req.params.address;
  const contract = new web3.eth.Contract(abi, '0xa5f8C5Dbd5F286960b9d90548680aE5ebFf07652'); // address of the PancakeSwap contract
  
  // get all the pools the user is providing liquidity in
  const lastBlockNumber = await web3.eth.getBlockNumber();
  const pools = await Promise.all(
    Array.from({ length: lastBlockNumber }, (_, i) => i)
      .map(blockNumber => contract.getPastEvents('AddLiquidity', {
        filter: { user: address },
        fromBlock: blockNumber,
        toBlock: blockNumber
      }))
  ).then(events => [].concat(...events))
    .then(events => events.map(event => event.returnValues.pool))
    .then(pools => [...new Set(pools)]) // Remove duplicates
  
  // get total liquidity the user is providing in each pool
  const totalLiquidity = await Promise.all(pools.map(pool => contract.methods.balanceOf(pool).call()));

  // get all the transaction instances where the user provided or withdrew from a pool
  const provideEvents = await contract.getPastEvents('ProvideLiquidity', {
    filter: { user: address },
    fromBlock: 0,
    toBlock: 'latest'
  });
  const removeEvents = await contract.getPastEvents('RemoveLiquidity', {
    filter: { user: address },
    fromBlock: 0,
    toBlock: 'latest'
  });
  const transactions = [...provideEvents, ...removeEvents];
  
  res.json({ pools, totalLiquidity, transactions });
});

app.listen(8000, () => console.log('Server listening on port 8000'));
 
