const PlatformsManager = artifacts.require("./PlatformsManager.sol")
const StorageManager = artifacts.require("./StorageManager.sol")
const ContractsManager = artifacts.require("./ContractsManager.sol")
const MultiEventsHistory = artifacts.require("./MultiEventsHistory.sol")
const ChronoBankPlatformFactory = artifacts.require("./ChronoBankPlatformFactory.sol")
const ChronoBankPlatform = artifacts.require("./ChronoBankPlatform.sol")

module.exports = function(deployer, network) {
    deployer
    .then(() => StorageManager.deployed())
    .then(_storageManager => _storageManager.giveAccess(PlatformsManager.address, "PlatformsManager"))
    .then(() => PlatformsManager.deployed())
    .then(_platformsManager => platformsManager = _platformsManager)
    .then(() => platformsManager.init(ContractsManager.address, ChronoBankPlatformFactory.address))
    .then(() => MultiEventsHistory.deployed())
    .then(_history => _history.authorize(PlatformsManager.address))

    .then(() => console.log("[MIGRATION] [" + parseInt(require("path").basename(__filename)) + "] PlatformsManager deploy: #done"))
}
