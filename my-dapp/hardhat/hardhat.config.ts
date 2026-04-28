require("@nomicfoundation/hardhat-toolbox")
require("dotenv").config()

const PRIVATE_KEY = process.env.PRIVATE_KEY || ""

module.exports = {
  solidity: "0.8.20",
  networks: {
    amoy: {
      url: "https://rpc-amoy.polygon.technology/",
      chainId: 80002,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
sepolia: {
  url: "https://ethereum-sepolia-rpc.publicnode.com",
  chainId: 11155111,
  accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
},
  },
}