const PlatformsManager = artifacts.require("./PlatformsManager.sol")
const StorageManager = artifacts.require("./StorageManager.sol")
const ContractsManager = artifacts.require('./ContractsManager.sol')
const MultiEventsHistory = artifacts.require("./MultiEventsHistory.sol")

module.exports = function(deployer, network, accounts) {
    deployer
    .then(() => StorageManager.deployed())
    .then(_storageManager => _storageManager.blockAccess(PlatformsManager.address, "PlatformsManager"))
    .then(() => MultiEventsHistory.deployed())
    .then(_history => _history.reject(PlatformsManager.address))
    // NOTE: we don't do destroy since it is meaningless here (no storage variables will be freed)
    .then(() => ContractsManager.deployed())
    .then(_manager => _manager.removeContract(PlatformsManager.address))

    .then(() => console.log("[MIGRATION] [" + parseInt(require("path").basename(__filename)) + "] PlatformsManager destroy: #done"))
}
