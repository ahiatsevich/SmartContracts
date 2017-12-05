const FeatureFeeManager = artifacts.require("./FeatureFeeManager.sol");
const StorageManager = artifacts.require('./StorageManager.sol');
const ContractsManager = artifacts.require("./ContractsManager.sol");
const MultiEventsHistory = artifacts.require("./MultiEventsHistory.sol");

module.exports = function(deployer, network, accounts) {
    deployer
    .then(() => StorageManager.deployed())
    .then(_storageManager => storageManager = _storageManager)
    .then(() => FeatureFeeManager.deployed())
    .then(_featureFeeRegistry => featureFeeRegistry = _featureFeeRegistry)

    .then(() => storageManager.giveAccess(FeatureFeeManager.address, 'FeatureFeeManager'))
    .then(() => featureFeeRegistry.init(ContractsManager.address))
    .then(() => MultiEventsHistory.deployed())
    .then(_history => _history.authorize(featureFeeRegistry.address))

    .then(() => console.log("[MIGRATION] [" + parseInt(require("path").basename(__filename)) + "] FeatureFeeManager setup: #done"))
}
