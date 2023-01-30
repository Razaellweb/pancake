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
          toBlock: blockNumber
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
      const transactions = [...provideEvents, ...removeEvents].map(event => ({
        id: event.transactionHash,
        type: event.event
      }));

      return { pools, totalLiquidity, transactions };
    }
  }
};

const server = new ApolloServer({ typeDefs, resolvers });

server.listen().then(({ url }) => {
  console.log(`Server is ready at ${url}`);
});