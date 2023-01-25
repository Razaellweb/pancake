const express = require('express')
const Web3 = require('web3')
const abi = require('./PancakeSwap.json') 

const web3 = new Web3(new Web3.providers.HttpProvider('https://api.binance.com'))
const contract = new web3.eth.Contract(abi, "0x0bc529c00C6401aEF6D220BE8C6Ea1667F6Ad93e")

app.get('/user/:address', async (req, res) => {
  try {
    const address = req.params.address
    const liquidityPools = await contract.methods.getReserves().call()


    let totalLiquidity = {}
    for (let i = 0; i < liquidityPools.length; i++) {
      const pool = liquidityPools[i]
      const balance = await contract.methods.balanceOf(address, pool).call()
      totalLiquidity[pool] = balance
    }

    const addLiquidityEvents = await contract.getPastEvents('Add', { filter: { user: address } })
    const removeLiquidityEvents = await contract.getPastEvents('Remove', { filter: { user: address } })

    const userTransactions = addLiquidityEvents.concat(removeLiquidityEvents)

    res.json({
      pools: liquidityPools,
      total_liquidity: totalLiquidity,
      transactions: userTransactions
    })
  } catch (err) {
    console.log(err)
    res.status(500).json({ error: 'Unable to fetch data' })
  }
})

app.listen(3000, () => {
  console.log('Server listening on port 3000')
})
