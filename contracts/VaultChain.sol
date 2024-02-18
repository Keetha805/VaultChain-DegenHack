// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import "hardhat/console.sol";

error VaultChain__ValueLessThanFee();
error VaultChain__AccountDoesNotExist();
error VaultChain__NotEnoughFunds();
error VaultChain__CoinNotAdded();
error VaultChain__AmountValueZero();
error VaultChain__CoinAlreadyAdded();
error VaultChain__TokenAddressZero();
error VaultChain__LimitReached();

contract VaultChain {
    uint256 constant FEE = 0.00001 ether;

    struct Account {
        address account;
        //address(1) = fuseToken
        address[] coins;
        //index = 1 ; fuseToken
        uint256[] funds;
        uint256[] goals;
        uint256[] limits;
    }

    mapping(address accountAddress => Account account) public addressToAccount;

    event DepositedFunds(address indexed _from, address indexed _tokenAddress, uint256 indexed _amount);
    event WithdrawedFunds(address indexed _from, address indexed _tokenAddress, uint256 indexed _amount);

    event GoalReached(address indexed _from, address indexed _tokenAddress, uint256 indexed _goal);

    event CoinCreated(address indexed _from, address indexed _tokenAddress, uint256 goal, uint256 limit);
    event FundDeleted(address indexed _from, address indexed _tokenAddress);

    event LimitUpdated(address indexed _from, address indexed _tokenAddress, uint256 indexed limit);
    event GoalUpdated(address indexed _from, address indexed _tokenAddress, uint256 indexed limit);

    event AccountCreated(address indexed _account);
    event AccountDeleted(address indexed _account);

    modifier existingOwnedAccount() {
        Account storage account = addressToAccount[msg.sender];
        if (account.account == address(0)) {
            revert VaultChain__AccountDoesNotExist();
        }

        _;
    }

    modifier existingCoin(address _tokenAddress) {
        if (_coinIndex(_tokenAddress) == type(uint256).max || _tokenAddress == address(0)) {
            revert VaultChain__CoinNotAdded();
        }
        _;
    }

    modifier amountNotZero(uint256 _values) {
        if (_values == 0) {
            revert VaultChain__AmountValueZero();
        }
        _;
    }

    function createAccount(uint256 _goal, uint256 _limit) public payable amountNotZero(_goal) amountNotZero(_limit) {
        //paying fee
        if (msg.value < FEE) {
            revert VaultChain__ValueLessThanFee();
        }

        //intializing account
        Account memory account = Account({
            account: msg.sender,
            coins: new address[](1),
            goals: new uint256[](1),
            funds: new uint256[](1),
            limits: new uint256[](1)
        });
        account.coins[0] = address(1);
        account.goals[0] = _goal;
        account.limits[0] = _limit;
        account.funds[0] += msg.value - FEE;

        //adding account to storage
        addressToAccount[msg.sender] = account;
        //emitting event
        emit AccountCreated(msg.sender);
    }

    function addCoin(address _tokenAddress, uint256 _goal, uint256 _limit)
        public
        existingOwnedAccount
        amountNotZero(_goal)
        amountNotZero(_limit)
    {
        if (_tokenAddress == address(0)) revert VaultChain__TokenAddressZero();

        Account storage account = addressToAccount[msg.sender];
        address[] memory coins = account.coins;

        //checking if already added
        for (uint256 i = 0; i < coins.length; i++) {
            if (coins[i] == _tokenAddress) {
                revert VaultChain__CoinAlreadyAdded();
            }
        }

        //addingCoin
        account.coins.push(_tokenAddress);
        account.funds.push(0);
        account.goals.push(_goal);
        account.limits.push(_limit);

        //emitting event
        emit CoinCreated(msg.sender, _tokenAddress, _goal, _limit);
    }

    function updateLimit(address _tokenAddress, uint256 _newLimit)
        public
        existingCoin(_tokenAddress)
        amountNotZero(_newLimit)
    {
        Account storage account = addressToAccount[msg.sender];
        uint256 index = _coinIndex(_tokenAddress);
        account.limits[index] = _newLimit;
    }

    function updateGoal(address _tokenAddress, uint256 _newGoal)
        public
        existingCoin(_tokenAddress)
        amountNotZero(_newGoal)
    {
        Account storage account = addressToAccount[msg.sender];
        uint256 index = _coinIndex(_tokenAddress);
        account.goals[index] = _newGoal;
    }

    function removeToken(address _tokenAddress) public existingOwnedAccount existingCoin(_tokenAddress) {
        Account storage account = addressToAccount[msg.sender];
        uint256 index = _coinIndex(_tokenAddress);

        //returning everything to user
        withdrawTokens(_tokenAddress, account.funds[index]);

        delete account.goals[index];
        //removingCoinSettings
        delete account.goals[index];
        delete account.limits[index];

        //emitting event
        emit FundDeleted(msg.sender, _tokenAddress);
    }

    function deleteAccount() public existingOwnedAccount {
        Account storage account = addressToAccount[msg.sender];
        address[] memory coins = account.coins;

        //returning fuse and tokens to user
        withdrawFuse(account.funds[0]);
        for (uint256 i = 1; i < coins.length; i++) {
            if (i == 0) {} else {
                withdrawTokens(account.coins[i], account.funds[i]);
            }
        }

        //deleting account
        delete addressToAccount[msg.sender];

        //emitting event
        emit AccountDeleted(msg.sender);
    }

    function depositTokens(address _tokenAddress, uint256 _amount)
        public
        existingOwnedAccount
        amountNotZero(_amount)
        existingCoin(_tokenAddress)
    {
        //moving tokens
        IERC20(_tokenAddress).transferFrom(msg.sender, address(this), _amount);

        //updating account
        Account storage account = addressToAccount[msg.sender];
        uint256 index = _coinIndex(_tokenAddress);
        account.funds[index] += _amount;

        //emitting events
        emit DepositedFunds(msg.sender, _tokenAddress, _amount);

        uint256 goal = account.goals[index];
        uint256 funds = account.funds[index];

        if (funds >= goal) {
            emit GoalReached(msg.sender, _tokenAddress, funds);
        }
    }

    function depositFuse() public payable existingOwnedAccount amountNotZero(msg.value) {
        //updating account
        Account storage account = addressToAccount[msg.sender];
        account.funds[0] += msg.value;

        //emitting events
        emit DepositedFunds(msg.sender, address(1), msg.value);

        uint256 goal = account.goals[0];
        uint256 funds = account.funds[0];

        if (funds >= goal) {
            emit GoalReached(msg.sender, address(1), goal);
        }
    }

    function withdrawTokens(address _tokenAddress, uint256 _amount)
        public
        existingOwnedAccount
        existingCoin(_tokenAddress)
        amountNotZero(_amount)
    {
        Account storage account = addressToAccount[msg.sender];
        uint256 index = _coinIndex(_tokenAddress);

        //checking enough funds
        if (account.funds[index] < _amount) {
            revert VaultChain__NotEnoughFunds();
        }

        //checking for limit
        if (_amount > account.limits[index]) {
            revert VaultChain__LimitReached();
        }

        //updating account
        account.funds[index] -= _amount;

        //transfering tokens
        IERC20(_tokenAddress).transfer(account.account, _amount);

        //emitting events

        emit WithdrawedFunds(msg.sender, _tokenAddress, _amount);
    }

    function withdrawFuse(uint256 _amount) public existingOwnedAccount amountNotZero(_amount) {
        Account storage account = addressToAccount[msg.sender];

        //checking enough funds
        if (account.funds[0] < _amount) {
            revert VaultChain__NotEnoughFunds();
        }

        //checking for limits
        if (_amount > account.limits[0]) {
            revert VaultChain__LimitReached();
        }

        //updating account
        account.funds[0] -= _amount;

        //transfering funds
        (bool success,) = payable(msg.sender).call{value: _amount}("");
        require(success, "Withdraw failed");

        //emitting events

        emit WithdrawedFunds(msg.sender, address(1), _amount);
    }

    function _coinIndex(address _tokenAddress) private view returns (uint256) {
        Account memory account = addressToAccount[msg.sender];
        for (uint256 i = 0; i < account.coins.length; i++) {
            if (account.coins[i] == _tokenAddress && account.goals[i] != 0) {
                return i;
            }
        }

        return type(uint256).max;
    }

    function getAccountDetails() public view existingOwnedAccount returns (Account memory) {
        return addressToAccount[msg.sender];
    }

    function getFee() public pure returns (uint256) {
        return FEE;
    }
}
