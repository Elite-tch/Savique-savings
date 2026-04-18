import hre from "hardhat";
import fs from "fs";
const { ethers } = hre;

async function main() {
  const USDC_ADDRESS = "0x75faf114eafb1bdbe2f0316df893fd58ce46aa4d";
  const AAVE_POOL = "0xbfc91d59fdaa134a4ed45f7b584caf96d7792eff";
  const TREASURY = "0xfef882c4ee5f4872c5e2ad593fb67e2dee7e1346";

  console.log("1. Deploying PersonalVault Implementation...");
  const VaultImpl = await ethers.getContractFactory("PersonalVault");
  const impl = await VaultImpl.deploy();
  await impl.waitForDeployment();
  const implAddress = await impl.getAddress();
  console.log("Implementation deployed to:", implAddress);

  console.log("2. Deploying VaultFactory (NFT + Clone version)...");
  const Factory = await ethers.getContractFactory("VaultFactory");
  const factory = await Factory.deploy(USDC_ADDRESS, AAVE_POOL, TREASURY, implAddress);
  await factory.waitForDeployment();

  const address = await factory.getAddress();
  console.log("VaultFactory V3 deployed to:", address);
  
  fs.writeFileSync("last_deployed_factory.txt", address);
  fs.writeFileSync("last_deployed_impl.txt", implAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
