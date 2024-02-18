require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  defaultNetwork: "localhost",
  solidity: "0.8.24",
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545/",
      chainId: 31337,
      accounts: [
        "0xdf57089febbacf7ba0bc227dafbffa9fc08a93fdc68e1e42411a14efcf23656e",
      ],
    },

    fuse: {
      url: "https://rpc.fuse.io",
      chainId: 122,
      accounts: [process.env.PRIVATE_KEY],
    },
    spark: {
      url: "https://rpc.fusespark.io",
      chainId: 123,
      accounts: [process.env.PRIVATE_KEY],
    },
  },
  mocha: {
    timeout: 40000,
  },
  etherscan: {
    apiKey: {
      spark: "abc",
      fuse: "abc",
    },
    customChains: [
      {
        network: "spark",
        chainId: 123,
        urls: {
          apiURL: "https://explorer.fusespark.io/api/",
          browserURL: "https://explorer.fusespark.io",
        },
      },
      {
        network: "fuse",
        chainId: 122,
        urls: {
          apiURL: "https://explorer.fuse.io/api/",
          browserURL: "https://explorer.fuse.io",
        },
      },
    ],
  },
};
