const HDWalletProvider = require('@truffle/hdwallet-provider');
const { mnemonic, API_KEY_BSC_SCAN } = require('./secrets.json');

module.exports = {
  networks: {
    development: {
      host: "127.0.0.1",     // Localhost (default: none)
      port: 8545,            // Standard BSC port (default: none)
      network_id: "*",    // Any network (default: none)
    },
    testnet: {
      provider: () => new HDWalletProvider(mnemonic, `https://data-seed-prebsc-2-s3.binance.org:8545`),
      network_id: 97,
      gas: 8000000
    },
    velastest: {
      provider: function () {
        return new HDWalletProvider(mnemonic, `https://testnet.velas.com/rpc`)
      },
      network_id: 111,
      gas: 7000000
    }
  },
  api_keys: {
    bscscan: API_KEY_BSC_SCAN
  },
  // Set default mocha options here, use special reporters etc.
  mocha: {
    // timeout: 100000
  },

  // Configure your compilers
  compilers: {
    solc: {
      version: "0.8.0",
      settings: {          // See the solidity docs for advice about optimization and evmVersion
        optimizer: {
          enabled: true,
          runs: 200
        },
      }
    }
  },

  plugins: [
    'truffle-plugin-verify',
    'truffle-contract-size'
  ],
  api_keys:{
    bscscan: API_KEY_BSC_SCAN
  }
};