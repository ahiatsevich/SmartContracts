const MultiEventsHistory = artifacts.require("./MultiEventsHistory.sol")
const TimePlatform = artifacts.require("./TimePlatform.sol")
const TimeAsset = artifacts.require("./TimeAsset.sol")
const TimeAssetProxy = artifacts.require("./TimeAssetProxy.sol")
const TimePlatformEmitter = artifacts.require("./TimePlatformEmitter.sol")

const VotingManager = artifacts.require("./VotingManager.sol")
const ERC20Manager = artifacts.require("./ERC20Manager.sol")
const ERC20Interface = artifacts.require("./ERC20Interface.sol")
const TimeHolder = artifacts.require("./TimeHolder.sol")
const ContractsManager = artifacts.require("./ContractsManager.sol")
const TimeHolderWallet = artifacts.require("./TimeHolderWallet.sol")
const ERC20DepositStorage = artifacts.require("./ERC20DepositStorage.sol")
const AssetDonator = artifacts.require("./AssetDonator.sol")

module.exports = async (deployer, network, accounts) => {
    if (network !== "main") {
      deployer.then(async () => {
          const TIME_SYMBOL = 'TIME';
          const TIME_NAME = 'Time Token';
          const TIME_DESCRIPTION = 'ChronoBank Time Shares';
          const TIME_BASE_UNIT = 8;

          let erc20Manager = await ERC20Manager.deployed();
          let oldTimeAddress = await erc20Manager.getTokenAddressBySymbol("TIME");
          let timeHolder = await TimeHolder.deployed();
          await timeHolder.removeListener(oldTimeAddress, VotingManager.address);
          
          let totalTimeShares = await timeHolder.totalShares(oldTimeAddress);

          await erc20Manager.setToken(oldTimeAddress, TimeAssetProxy.address, TIME_NAME, TIME_SYMBOL, "", TIME_BASE_UNIT, "", "");

          let time = ERC20Interface.at(TimeAssetProxy.address);
          await time.transfer(AssetDonator.address, 1000000000000);

          await timeHolder.init(ContractsManager.address, time.address, TimeHolderWallet.address, accounts[0], ERC20DepositStorage.address)
          await time.transfer(TimeHolderWallet.address, totalTimeShares);

          console.log("[MIGRATION] [" + parseInt(require("path").basename(__filename)) + "] Original Time init: #done")
      })
    }
}
