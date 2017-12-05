const WalletsManager = artifacts.require("./WalletsManager.sol");
const Wallet = artifacts.require("./Wallet.sol");
const StorageManager = artifacts.require("./StorageManager.sol");
const ContractsManager = artifacts.require("./ContractsManager.sol");
const MultiEventsHistory = artifacts.require("./MultiEventsHistory.sol");
const WalletsFactory = artifacts.require("./WalletsFactory.sol");

module.exports = function (deployer, network) {
    deployer
        .then(() =>  StorageManager.deployed())
        .then(_storageManager => _storageManager.giveAccess(WalletsManager.address, 'WalletsManager'))
        .then(() => WalletsManager.deployed())
        .then(_manager => manager = _manager)
        .then(() => manager.init(ContractsManager.address, WalletsFactory.address))
        .then(() => MultiEventsHistory.deployed())
        .then(_history => _history.authorize(manager.address))
        .then(() => console.log("[MIGRATION] [" + parseInt(require("path").basename(__filename)) + "] WalletsManager setup: #done"))
}
