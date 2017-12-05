const WalletsManager = artifacts.require("./WalletsManager.sol");
const StorageManager = artifacts.require("./StorageManager.sol")
const ContractsManager = artifacts.require('./ContractsManager.sol')
const MultiEventsHistory = artifacts.require("./MultiEventsHistory.sol")

module.exports = function(deployer, network, accounts) {
    deployer
    .then(() => StorageManager.deployed())
    .then(_storageManager => _storageManager.blockAccess(WalletsManager.address, "WalletsManager"))
    .then(() => MultiEventsHistory.deployed())
    .then(_history => _history.reject(WalletsManager.address))
    .then(() => ContractsManager.deployed())
    .then(_manager => _manager.removeContract(WalletsManager.address))

    .then(() => console.log("[MIGRATION] [" + parseInt(require("path").basename(__filename)) + "] WalletsManager destroy: #done"))
}
