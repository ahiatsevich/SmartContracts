var AssetsManager = artifacts.require("./AssetsManager.sol");
const Storage = artifacts.require('./Storage.sol');
const TokenFactory = artifacts.require("./TokenFactory.sol");
const ChronoBankPlatformFactory = artifacts.require("./ChronoBankPlatformFactory.sol");
const StorageManager = artifacts.require("./StorageManager.sol");
const ContractsManager = artifacts.require("./ContractsManager.sol");
const ChronoBankPlatform = artifacts.require("./ChronoBankPlatform.sol");
const MultiEventsHistory = artifacts.require("./MultiEventsHistory.sol");
const ChronoBankTokenExtensionFactory = artifacts.require("./ChronoBankTokenExtensionFactory.sol")
const PlatformsManager = artifacts.require("./PlatformsManager.sol")

module.exports = function (deployer, network) {
	if (network !== "main") {
		// AssetsManager deployment
    	deployer
		.then(() => deployer.deploy(AssetsManager, Storage.address, 'AssetsManager'))
        .then(() =>  StorageManager.deployed())
        .then(_storageManager => _storageManager.giveAccess(AssetsManager.address, 'AssetsManager'))
        .then(() => AssetsManager.deployed())
        .then(_manager => assetsManager = _manager)

        .then(() => assetsManager.init(ContractsManager.address, ChronoBankTokenExtensionFactory.address, TokenFactory.address))

		// setup events history
        .then(() => MultiEventsHistory.deployed())
        .then(_history => _history.authorize(assetsManager.address))
        .then(() => console.log("[MIGRATION] [25.1] AssetManager: #done"))

		// PlatformsManager deployment
		.then(() => deployer.deploy(PlatformsManager, Storage.address, 'PlatformsManager'))
		.then(() =>  StorageManager.deployed())
        .then(_storageManager => _storageManager.giveAccess(PlatformsManager.address, 'PlatformsManager'))
        .then(() => PlatformsManager.deployed())
        .then(_manager => platformsManager = _manager)
		.then(() => platformsManager.init(ContractsManager.address, ChronoBankPlatformFactory.address))
		// setup events history
		.then(() => MultiEventsHistory.deployed())
        .then(_history => _history.authorize(platformsManager.address))

        .then(() => console.log("[MIGRATION] [25.2] PlatformsManager: #done"))
	}
}
