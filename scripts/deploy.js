// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");

async function main() {
  deployer = (await ethers.getSigners())[0];
  const credentials = new ethers.Wallet(process.env.PRIVATE_KEY);
  fuseSDK = await FuseSDK.init(process.env.PUBLIC_KEY, credentials);

  smartAccount = fuseSDK.wallet.getSender();
  deployer.sendTransaction({
    to: smartAccount,
    value: ethers.parseEther("10"),
  });

  const factory = await ethers.getContractFactory("VaultChain", deployer);
  vault = await factory.deploy([]);
  await vault.waitForDeployment();
  console.log("vault.target: ", vault.target);

  fee = await vault.getFee();
  console.log("fee: ", fee);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
