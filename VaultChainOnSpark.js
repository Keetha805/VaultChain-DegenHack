const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect, assert } = require("chai");
const { ethers } = require("hardhat");
const { parseEther, getAddress } = require("ethers");
const FuseSDK = require("@fuseio/fusebox-web-sdk").FuseSDK;
const abi = require("./artifacts/contracts/VaultChain.sol/VaultChain.json")[
  "abi"
];

describe("VaultChain", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.

  let provider = new ethers.JsonRpcProvider("https://rpc.fusespark.io");
  let vault = new ethers.Contract(process.env.CONTRACT_TARGET, abi, provider);
  let deployer, fee, fuseSDK, smartAccount;
  let iface = new ethers.Interface(abi);

  beforeEach(async () => {
    // deployer = (await ethers.getSigners())[0];
    const credentials = new ethers.Wallet(process.env.PRIVATE_KEY);
    fuseSDK = await FuseSDK.init(process.env.PUBLIC_KEY, credentials);

    smartAccount = fuseSDK.wallet.getSender();
    // deployer.sendTransaction({
    //   to: smartAccount,
    //   value: ethers.parseEther("10"),
    // });

    // const factory = await ethers.getContractFactory("VaultChain", deployer);
    // vault = await factory.deploy([]);
    // await vault.waitForDeployment();
    // console.log("vault.target: ", vault.target);

    fee = await vault.getFee();
    console.log("fee: ", fee);
  });

  describe("CreateAccount", () => {
    let goal = parseEther("1");
    let limit = parseEther("0.5");

    it("should create an account correctly", async () => {
      const createData = iface.encodeFunctionData("createAccount", [
        goal,
        limit,
      ]);
      let res = await fuseSDK.callContract(vault.target, 0, createData);
      await res.wait(1);

      const newAccount = await vault.addressToAccount(smartAccount);
      console.log("newAccount: ", newAccount);
    });
  });

  // describe("Desposit", () => {
  //   it("should deposit correctly", async () => {});
  //   // it("should revert correctly", async()=>{} )
  //   // it("should  correctly", async()=>{} )
  // });
});
