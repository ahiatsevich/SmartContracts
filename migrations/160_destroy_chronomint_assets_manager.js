const AssetsManager = artifacts.require("./AssetsManager.sol")
const StorageManager = artifacts.require("./StorageManager.sol")
const ContractsManager = artifacts.require('./ContractsManager.sol')
const MultiEventsHistory = artifacts.require("./MultiEventsHistory.sol")

module.exports = function(deployer, network) {
    deployer
    .then(() => StorageManager.deployed())
    .then(_storageManager => _storageManager.blockAccess(AssetsManager.address, "AssetsManager"))
    .then(() => MultiEventsHistory.deployed())
    .then(_history => _history.reject(AssetsManager.address))
    // NOTE: we don't do destroy since it is meaningless here (no storage variables will be freed)
    .then(() => ContractsManager.deployed())
    .then(_manager => _manager.removeContract(AssetsManager.address))

    .then(() => console.log("[MIGRATION] [" + parseInt(require("path").basename(__filename)) + "] AssetsManager destroy: #done"))
}
