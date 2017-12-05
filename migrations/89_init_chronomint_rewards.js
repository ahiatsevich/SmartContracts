const Rewards = artifacts.require("./Rewards.sol");
const RewardsWallet = artifacts.require("./RewardsWallet.sol")
const StorageManager = artifacts.require("./StorageManager.sol");
const ContractsManager = artifacts.require("./ContractsManager.sol");
const MultiEventsHistory = artifacts.require("./MultiEventsHistory.sol");
const PlatformsManager = artifacts.require('./PlatformsManager.sol')
const ChronoBankPlatform = artifacts.require('./ChronoBankPlatform.sol')

// already unnecessary
module.exports = function (deployer, network) {
    return;

    deployer
    .then(() => StorageManager.deployed())
    .then(_storageManager => _storageManager.giveAccess(Rewards.address, "Deposits"))
    .then(() => Rewards.deployed())
    .then(_manager => _manager.init(ContractsManager.address, RewardsWallet.address, ChronoBankPlatform.address, 0))
    .then(() => MultiEventsHistory.deployed())
    .then(_history => _history.authorize(Rewards.address))

    .then(() => console.log("[MIGRATION] [" + parseInt(require("path").basename(__filename)) + "] Rewards setup: #done"))
}
