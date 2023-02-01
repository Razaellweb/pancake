const { ApolloServer, gql } = require('apollo-server');
const Web3 = require('web3');
const contractABI = require('./PancakeSwap.json');

const url = 'https://bold-black-energy.bsc.discover.quiknode.pro/c2bf115e5d95e1ee7a40bef1eb2e9bef41222bfb/';
const web3 = new Web3(new Web3.providers.HttpProvider(url));

const typeDefs = gql`
  type Pool {
    id: String!
    name: String!
    liquidity: Float!
  }

  type Transaction {
    id: String!
    type: String!
    timestamp: Int!
    amount: Float!
  }

  type Query {
    getPools(address: String!): [Pool!]!
    getTotalLiquidity(address: String!): Float!
    getTransactions(address: String!): [Transaction!]!
  }
`;

const resolvers = {
  Query: {
    async getPools(_, { address }) {
      const contract = new web3.eth.Contract(contractABI, '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73');
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

      const poolData = await Promise.all(
        pools.map(async pool => {
          const liquidity = await contract.methods.balanceOf(pool).call();
          return { id: pool, name: pool, liquidity };
        })
      );

      return poolData;
    },
    async getTotalLiquidity(_, { address }) {
      const contract = new web3.eth.Contract(contractABI, '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73');

      let totalLiquidity = 0;
      const pools = await this.getPools(null, { address });
      pools.forEach(pool => {
        totalLiquidity += pool.liquidity;
      });

      return totalLiquidity;
    },
    async getTransactions(_, { address }) {
      const contract = new web3.eth.Contract(contractABI, '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73');
      const lastBlockNumber = await web3.eth.getBlockNumber();
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

      const transactions = [...provideEvents, ...removeEvents].map(event => ({
        id: event.transactionHash,
        type: event.event
      }));

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

      return { pools, totalLiquidity, transactions, totalValue };
    }
  }
};

const server = new ApolloServer({ typeDefs, resolvers });

server.listen().then(({ url }) => {
  console.log(`Server is ready at ${url}`);
});