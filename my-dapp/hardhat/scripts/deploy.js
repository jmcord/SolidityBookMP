import hre from "hardhat"

async function main() {
  const { ethers } = hre

  const [deployer] = await ethers.getSigners()

  console.log("Deploying with:", deployer.address)

  const BookToken = await ethers.getContractFactory("BookToken")
  const token = await BookToken.deploy(deployer.address)
  await token.waitForDeployment()

  const tokenAddress = await token.getAddress()
  console.log("BookToken:", tokenAddress)

  const BookNFT = await ethers.getContractFactory("BookNFT")
  const nft = await BookNFT.deploy(deployer.address)
  await nft.waitForDeployment()

  const nftAddress = await nft.getAddress()
  console.log("BookNFT:", nftAddress)

  const BookMarketplace = await ethers.getContractFactory("BookMarketplace")
  const marketplace = await BookMarketplace.deploy(tokenAddress, nftAddress)
  await marketplace.waitForDeployment()

  const marketplaceAddress = await marketplace.getAddress()
  console.log("BookMarketplace:", marketplaceAddress)

  console.log("Transferring ownership...")

  await (await token.transferOwnership(marketplaceAddress)).wait()
  await (await nft.transferOwnership(marketplaceAddress)).wait()

  console.log("✅ Ownership transferred")
  console.log("")
  console.log("TOKEN_ADDRESS =", tokenAddress)
  console.log("NFT_ADDRESS =", nftAddress)
  console.log("MARKETPLACE_ADDRESS =", marketplaceAddress)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})