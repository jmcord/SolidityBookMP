import "@nomicfoundation/hardhat-ethers"
import "dotenv/config"
import { configVariable } from "hardhat/config"

export default {
  solidity: {
    profiles: {
      default: {
        version: "0.8.20",
      },
    },
  },
  networks: {
    amoy: {
      type: "http",
      url: "https://rpc-amoy.polygon.technology/",
      chainId: 80002,
      accounts: [configVariable("PRIVATE_KEY")],
    },
  },
}