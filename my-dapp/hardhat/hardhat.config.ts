import "dotenv/config"
import { configVariable } from "hardhat/config"

export default {
  solidity: "0.8.24",
  networks: {
    amoy: {
      type: "http",
      url: "https://rpc-amoy.polygon.technology/",
      chainId: 80002,
      accounts: [configVariable("PRIVATE_KEY")],
    },
  },
}