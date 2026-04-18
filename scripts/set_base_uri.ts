import hre from "hardhat";
const { ethers } = hre;

async function main() {
  const FACTORY_ADDRESS = "0x71941de02D2566e900B1EE5bAd6AF1bEE1f110d9";
  // We use a placeholder or localhost for now. 
  // In production, this would be https://savique.app/api/nft/
  const BASE_URI = "http://localhost:3001/api/nft/"; 

  console.log("Setting BaseURI for Factory...");
  const Factory = await ethers.getContractAt("VaultFactory", FACTORY_ADDRESS);
  const tx = await Factory.setBaseURI(BASE_URI);
  await tx.wait();
  
  console.log("BaseURI set to:", BASE_URI);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
