const AssetsManager = artifacts.require("./AssetsManager.sol");
const StorageManager = artifacts.require("./StorageManager.sol");
const ContractsManager = artifacts.require("./ContractsManager.sol");
const MultiEventsHistory = artifacts.require("./MultiEventsHistory.sol");
const TokenFactory = artifacts.require("./TokenFactory.sol");
const ChronoBankTokenExtensionFactory = artifacts.require("./ChronoBankTokenExtensionFactory.sol")

module.exports = function (deployer, network) {
    deployer
    .then(() => StorageManager.deployed())
    .then(_storageManager => _storageManager.giveAccess(AssetsManager.address, 'AssetsManager'))
    .then(() => AssetsManager.deployed())
    .then(_assetsManager => _assetsManager.init(ContractsManager.address, ChronoBankTokenExtensionFactory.address, TokenFactory.address))
    .then(() => MultiEventsHistory.deployed())
    .then(_history => _history.authorize(AssetsManager.address))

    .then(() => console.log("[MIGRATION] [" + parseInt(require("path").basename(__filename)) + "] AssetManager setup: #done"))
}
