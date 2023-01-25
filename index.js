const express = require('express');
const Web3 = require('web3');
const abi = require('./PancakeSwap.json'); // import the ABI for the PancakeSwap contract

const app = express();
const web3 = new Web3(new Web3.providers.HttpProvider('https://bsc-dataseed.binance.org')); // connecting to Binance Smart Chain

app.get('/api/user/:address', async (req, res) => {
  const address = req.params.address;
  const contract = new web3.eth.Contract(abi, '0xa5f8C5Dbd5F286960b9d90548680aE5ebFf07652'); // address of the PancakeSwap contract
  
  // get all the pools the user is providing liquidity in
  const pools = await contract.methods.getUserPools(address).call();
  
  // get total liquidity the user is providing in each pool
  const totalLiquidity = await Promise.all(pools.map(pool => contract.methods.balanceOf(pool).call()));
  
  // get all the transaction instances where the user provided or withdrew from a pool
  const transactions = await web3.eth.getPastLogs({
    address: contract.options.address,
    topics: [
      web3.utils.keccak256('ProvideLiquidity(address,address,uint256,uint256)'),
      web3.utils.keccak256('RemoveLiquidity(address,address,uint256,uint256)'),
    ],
    fromBlock: 0,
    toBlock: 'latest',
    address,
  });
  
  res.json({ pools, totalLiquidity, transactions });
});

app.listen(3000, () => console.log('Server listening on port 3000'));
