const PlatformTokenExtensionGatewayManager = artifacts.require("./PlatformTokenExtensionGatewayManager.sol")
const ContractsManager = artifacts.require("./ContractsManager.sol")
const StorageManager = artifacts.require("./StorageManager.sol")
const MultiEventsHistory = artifacts.require("./MultiEventsHistory.sol")

module.exports = function(deployer, network) {
    deployer
    .then(() => StorageManager.deployed())
    .then(_storageManager => _storageManager.giveAccess(PlatformTokenExtensionGatewayManager.address, "TokenExtensionGateway"))
    .then(() => PlatformTokenExtensionGatewayManager.deployed())
    .then(_manager => tokenExtensionManager = _manager)
    .then(() => tokenExtensionManager.init(ContractsManager.address))
    .then(() => MultiEventsHistory.deployed())
    .then(_history => _history.authorize(PlatformTokenExtensionGatewayManager.address))

    .then(() => console.log("[MIGRATION] [" + parseInt(require("path").basename(__filename)) + "] Platform Token Extension Gateway Manager init: #done"))
}
