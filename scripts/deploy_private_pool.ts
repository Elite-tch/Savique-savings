const hre = require("hardhat");

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    const usdcToken = "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d";
    const aavePool = "0xBfC91D59fdAA134A4ED45f7B584cAf96D7792Eff";
    const treasury = deployer.address;

    const PrivateSavingsPool = await hre.ethers.getContractFactory("PrivateSavingsPool");
    console.log("Deploying PrivateSavingsPool...");
    
    const pool = await PrivateSavingsPool.deploy(usdcToken, aavePool, treasury);
    await pool.waitForDeployment();

    const poolAddress = await pool.getAddress();
    console.log("PrivateSavingsPool deployed to:", poolAddress);
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
