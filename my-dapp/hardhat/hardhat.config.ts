import "dotenv/config"

export default {
  solidity: "0.8.20",
  networks: {
    amoy: {
      url: "https://rpc-amoy.polygon.technology/",
      chainId: 80002,
      accounts: [process.env.PRIVATE_KEY],
    },
  },
}