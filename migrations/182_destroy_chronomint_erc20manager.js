const ERC20Manager = artifacts.require("./ERC20Manager.sol");
const StorageManager = artifacts.require("./StorageManager.sol")
const ContractsManager = artifacts.require('./ContractsManager.sol')
const MultiEventsHistory = artifacts.require("./MultiEventsHistory.sol")

module.exports = function(deployer, network, accounts) {
    deployer
    .then(() => StorageManager.deployed())
    .then(_storageManager => _storageManager.blockAccess(ERC20Manager.address, "ERC20Manager"))
    .then(() => MultiEventsHistory.deployed())
    .then(_history => _history.reject(ERC20Manager.address))
    .then(() => ContractsManager.deployed())
    .then(_manager => _manager.removeContract(ERC20Manager.address))

    .then(() => console.log("[MIGRATION] [" + parseInt(require("path").basename(__filename)) + "] ERC20Manager destroy: #done"))
}
