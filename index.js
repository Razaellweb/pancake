const express = require('express');
const Web3 = require('web3');
const axios = require('axios');
const contractabi = require('./PancakeSwap.json');

const app = express();
const url = 'https://bold-black-energy.bsc.discover.quiknode.pro/c2bf115e5d95e1ee7a40bef1eb2e9bef41222bfb/';
const web3 = new Web3(new Web3.providers.HttpProvider(url));

app.get('/api/user/:address', async (req, res) => {
  const address = req.params.address;
  const contract = new web3.eth.Contract(contractabi, '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73');
  const lastBlockNumber = await web3.eth.getBlockNumber();

  let pools = [];
  for (let blockNumber = 0; blockNumber < lastBlockNumber; blockNumber += 10000) {
    const events = await contract.getPastEvents('Deposit', {
      filter: { user: address },
      fromBlock: blockNumber,
      toBlock: blockNumber + 10000
    });
    events.forEach(event => {
      pools.push(event.returnValues.pool);
    });
  }
  pools = [...new Set(pools)];

  const totalLiquidity = await Promise.all(pools.map(pool => contract.methods.balanceOf(pool).call()));

  let provideEvents = [];
  let fromBlock = 0;
  let toBlock = lastBlockNumber;

  for (let i = fromBlock; i <= toBlock; i += 10000) {
    let event = await contract.getPastEvents('Deposit', {
      filter: { user: address },
      fromBlock: i,
      toBlock: i + 10000
    });
    if (event.length > 0) {
      provideEvents.push(...event);
    }
  }

  let removeEvents = [];
  let fromBlock2 = 0;
  let toBlock2 = lastBlockNumber;

  for (let i = fromBlock2; i <= toBlock2; i += 10000) {
    let event = await contract.getPastEvents('Deposit', {
      filter: { user: address },
      fromBlock: i,
      toBlock: i + 10000
    });
    if (event.length > 0) {
      removeEvents.push(...event);
    }
  }

  const transactions = [...provideEvents, ...removeEvents];

  // fetch the latest token prices in USD
  const tokenPrices = {};
  const promises = pools.map(async pool => {
    const response = await axios.get(`https://api.coinmarketcap.com/v2/ticker/${pool}/?convert=USD`);
    const price = response.data.data.quotes.USD.price;
    tokenPrices[pool] = price;
  });
  await Promise.all(promises);

  // calculate the value of the user's tokens in each pool in dollars
  const totalValue = totalLiquidity.map((liquidity, i) => liquidity * tokenPrices[pools[i]]);

  // fetch the current ETH price in USD
  const ethPriceResponse = await axios.get('https://api.coinmarketcap.com/v2/ticker/1027/?convert=USD');
  const ethPrice = ethPriceResponse.data.data.quotes.USD.price;

  // get the constant_product value
  const constantProduct = await contract.methods.constantProduct().call();

  // calculate the token_liquidity_pool
  const tokenLiquidityPool = Math.sqrt(constantProduct * ethPrice);

  res.json({ pools, totalLiquidity, transactions, totalValue, tokenLiquidityPool });
});

app.listen(8000, () => console.log(`server listening on port 8000`));
