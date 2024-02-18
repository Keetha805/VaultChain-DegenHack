const { expect, assert } = require("chai");
const { parseEther } = require("ethers");
const { ethers } = require("hardhat");
const { zeroAddress } = require("viem");

describe("VaultChain", () => {
  let vault, erc, deployer;

  beforeEach(async () => {
    let deployerSigner = (await ethers.getSigners())[0];
    let vaultFactory = await ethers.getContractFactory(
      "VaultChain",
      deployerSigner
    );
    vault = await vaultFactory.deploy([]);
    await vault.waitForDeployment();

    let ercFactory = await ethers.getContractFactory(
      "MockERC20",
      deployerSigner
    );
    erc = await ercFactory.deploy([]);
    await erc.waitForDeployment();

    deployer = deployerSigner.address;
    fee = await vault.getFee();
  });

  describe("Create Account", () => {
    let goal = ethers.parseEther("1");
    let limit = ethers.parseEther("0.5");
    let address1 = "0x0000000000000000000000000000000000000001";

    it("Should emit events", async () => {
      await expect(vault.createAccount(goal, limit, { value: fee }))
        .to.emit(vault, "AccountCreated")
        .withArgs(deployer);
    });

    it("should create account correctly", async () => {
      let tx = await vault.createAccount(goal, limit, { value: fee });
      await tx.wait(1);

      let newAccount = await vault.getAccountDetails();
      assert.equal(newAccount[0], deployer);
      assert.equal(newAccount[1], address1);
      assert.equal(newAccount[2], 0);
      assert.equal(newAccount[3], goal);
      assert.equal(newAccount[4], limit);
    });

    it("should revert if goal is zero", async () => {
      await expect(
        vault.createAccount(0, limit, { value: fee })
      ).to.be.revertedWithCustomError(vault, "VaultChain__AmountValueZero()");
    });

    it("should revert if limit is zero", async () => {
      await expect(
        vault.createAccount(goal, 0, { value: fee })
      ).to.be.revertedWithCustomError(vault, "VaultChain__AmountValueZero()");
    });

    it("should revert if fee isnt enough", async () => {
      await expect(
        vault.createAccount(goal, limit, { value: 0 })
      ).to.be.revertedWithCustomError(vault, "VaultChain__ValueLessThanFee()");
    });
  });

  describe("addCoin", () => {
    let goal = parseEther("1");
    let limit = parseEther("0.5");
    let amount = parseEther("0.2");

    describe("addCoin with account", async () => {
      beforeEach(async () => {
        let tx = await vault.createAccount(goal, limit, { value: fee });
        await tx.wait(1);
      });

      it("should emit events", async () => {
        await expect(vault.addCoin(erc.target, goal, limit))
          .to.emit(vault, "CoinCreated")
          .withArgs(deployer, erc.target, goal, limit);
      });

      it("should create coin correctly", async () => {
        const tx = await vault.addCoin(erc.target, goal, limit);
        await tx.wait(1);

        const account = await vault.getAccountDetails();
        assert.equal(account[1][1], erc.target);
        assert.equal(account[2][1], 0);
        assert.equal(account[3][1], goal);
        assert.equal(account[4][1], limit);
      });

      it("should revert if goal is zero", async () => {
        await expect(
          vault.addCoin(erc.target, 0, limit)
        ).to.be.revertedWithCustomError(vault, "VaultChain__AmountValueZero()");
      });

      it("should revert if limit is zero", async () => {
        await expect(
          vault.addCoin(erc.target, goal, 0)
        ).to.be.revertedWithCustomError(vault, "VaultChain__AmountValueZero()");
      });

      it("should revert if address is zero", async () => {
        await expect(
          vault.addCoin(zeroAddress, goal, limit)
        ).to.be.revertedWithCustomError(
          vault,
          "VaultChain__TokenAddressZero()"
        );
      });

      it("should revert if already added", async () => {
        const tx = await vault.addCoin(erc.target, goal, limit);
        await tx.wait(1);

        await expect(
          vault.addCoin(erc.target, goal, limit)
        ).to.be.revertedWithCustomError(
          vault,
          "VaultChain__CoinAlreadyAdded()"
        );
      });
    });

    it("should revert if account not created", async () => {
      await expect(
        vault.addCoin(erc.target, goal, limit)
      ).to.be.revertedWithCustomError(
        vault,
        "VaultChain__AccountDoesNotExist()"
      );
    });
  });

  //here we already test the existingOwnerAccount and  existingCoin
  describe("depositWithAccount", () => {
    let goal = parseEther("1");
    let limit = parseEther("0.5");
    let amount = parseEther("0.0001");
    describe("depositTokens", () => {
      beforeEach(async () => {
        let tx = await vault.createAccount(goal, limit, { value: fee });
        await tx.wait(1);

        const approvalTx = await erc.approve(vault.target, goal);
        await approvalTx.wait(1);
      });

      describe("depositWithCoinAdded", () => {
        beforeEach(async () => {
          let tx = await vault.addCoin(erc.target, goal, limit);
          await tx.wait(1);
        });

        it("should deposit token correctly", async () => {
          const accountStart = await vault.getAccountDetails();
          const fundsStart = accountStart[2][1];
          assert.equal(fundsStart, 0);

          const depositTx = await vault.depositTokens(erc.target, amount);
          await depositTx.wait(1);

          const account = await vault.getAccountDetails();
          const funds = account[2][1];
          assert.equal(funds, amount);
        });

        it("should emit events", async () => {
          await expect(vault.depositTokens(erc.target, amount))
            .to.emit(vault, "DepositedFunds")
            .withArgs(deployer, erc.target, amount);
        });

        it("should emit event if goal reached", async () => {
          await expect(vault.depositTokens(erc.target, goal))
            .to.emit(vault, "GoalReached")
            .withArgs(deployer, erc.target, goal);
        });
      });

      it("should revert if coin not added", async () => {
        await expect(
          vault.depositTokens(erc.target, amount)
        ).to.be.revertedWithCustomError(vault, "VaultChain__CoinNotAdded()");
      });
    });

    it("should revert if account not created", async () => {
      await expect(
        vault.depositTokens(erc.target, amount)
      ).to.be.revertedWithCustomError(
        vault,
        "VaultChain__AccountDoesNotExist()"
      );
    });
  });

  describe("withdrawTokens", () => {
    let goal = parseEther("1");
    let limit = parseEther("0.5");
    let amount = parseEther("0.7");
    //should be less than limit
    let amountWithdraw = parseEther("0.1");
    beforeEach(async () => {
      const createTx = await vault.createAccount(goal, limit, { value: fee });
      await createTx.wait(1);
      const addCoinTx = await vault.addCoin(erc.target, goal, limit);
      await addCoinTx.wait(1);
    });

    describe("withDeposit", () => {
      beforeEach(async () => {
        const approvalTx = await erc.approve(vault.target, goal);
        await approvalTx.wait(1);
        const tx = await vault.depositTokens(erc.target, amount);
        await tx.wait(1);
      });

      it("should withdraw correctly", async () => {
        const startAccount = await vault.getAccountDetails();
        const startFunds = startAccount[2][1];
        const startTokensOwned = await erc.balanceOf(deployer);
        assert.equal(startFunds, amount);

        const tx = await vault.withdrawTokens(erc.target, amountWithdraw);
        await tx.wait(1);

        const account = await vault.getAccountDetails();
        const funds = account[2][1];
        const tokensOwned = await erc.balanceOf(deployer);
        assert.equal(funds, amount - amountWithdraw);
        assert.equal(tokensOwned, startTokensOwned + amountWithdraw);
      });

      it("should emit events", async () => {
        await expect(vault.withdrawTokens(erc.target, amountWithdraw))
          .to.emit(vault, "WithdrawedFunds")
          .withArgs(deployer, erc.target, amountWithdraw);
      });

      it("should revert if limit reached", async () => {
        await expect(
          vault.withdrawTokens(erc.target, amount)
        ).to.be.revertedWithCustomError(vault, "VaultChain__LimitReached()");
      });
    });

    it("should revert if funds are equal 0", async () => {
      await expect(
        vault.withdrawTokens(erc.target, amount)
      ).to.be.revertedWithCustomError(vault, "VaultChain__NotEnoughFunds()");
    });
  });

  describe("depositFuse", () => {
    let goal = parseEther("1");
    let limit = parseEther("0.5");
    let amount = parseEther("0.7");
    let address1 = "0x0000000000000000000000000000000000000001";

    beforeEach(async () => {
      const createTx = await vault.createAccount(goal, limit, { value: fee });
      await createTx.wait(1);
    });

    it("should deposit correctly", async () => {
      const tx = await vault.depositFuse({ value: amount });
      await tx.wait(1);

      const account = await vault.getAccountDetails();
      const funds = account[2][0];
      assert.equal(funds, amount);
    });
    it("should emit event correctly", async () => {
      await expect(vault.depositFuse({ value: amount }))
        .to.emit(vault, "DepositedFunds")
        .withArgs(deployer, address1, amount);
    });
    it("should emit event if goal reached", async () => {
      await expect(vault.depositFuse({ value: goal }))
        .to.emit(vault, "GoalReached")
        .withArgs(deployer, address1, goal);
    });
  });

  describe("withdrawFuse", () => {
    let goal = parseEther("1");
    let limit = parseEther("0.5");
    let amount = parseEther("0.7");
    let address1 = "0x0000000000000000000000000000000000000001";

    //should be less than limit
    let amountWithdraw = parseEther("0.1");

    beforeEach(async () => {
      const createTx = await vault.createAccount(goal, limit, { value: fee });
      await createTx.wait(1);
    });

    describe("withDeposit", () => {
      beforeEach(async () => {
        const tx = await vault.depositFuse({ value: amount });
        await tx.wait(1);
      });

      it("should withdraw correctly", async () => {
        const startingAccount = await vault.getAccountDetails();
        const startingFunds = startingAccount[2][0];

        const tx = await vault.withdrawFuse(amountWithdraw);
        await tx.wait(1);

        const account = await vault.getAccountDetails();
        const funds = account[2][0];
        assert.equal(funds, startingFunds - amountWithdraw);
      });

      it("should emit event", async () => {
        await expect(vault.withdrawFuse(amountWithdraw))
          .to.emit(vault, "WithdrawedFunds")
          .withArgs(deployer, address1, amountWithdraw);
      });

      it("should revert if limit reached", async () => {
        await expect(vault.withdrawFuse(amount)).to.be.revertedWithCustomError(
          vault,
          "VaultChain__LimitReached()"
        );
      });
    });

    it("should revert if deposit 0", async () => {
      await expect(vault.withdrawFuse(amount)).to.be.revertedWithCustomError(
        vault,
        "VaultChain__NotEnoughFunds()"
      );
    });
  });
});
