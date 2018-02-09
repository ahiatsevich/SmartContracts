var TokenFactory = artifacts.require("./TokenFactory.sol");
var ChronoBankPlatformFactory = artifacts.require('./ChronoBankPlatformFactory.sol');
var ChronoBankTokenExtensionFactory = artifacts.require('./ChronoBankTokenExtensionFactory.sol')
const ContractsManager = artifacts.require('./ContractsManager.sol')
const StorageManager = artifacts.require("./StorageManager.sol")

const ChronoBankAssetFactory = artifacts.require("./ChronoBankAssetFactory.sol");
const ChronoBankAssetWithFeeFactory = artifacts.require("./ChronoBankAssetWithFeeFactory.sol");
const ChronoBankAssetWithCallbackFactory = artifacts.require("./ChronoBankAssetWithCallbackFactory.sol");
const ChronoBankAssetWithFeeAndCallbackFactory = artifacts.require("./ChronoBankAssetWithFeeAndCallbackFactory.sol");

module.exports = function (deployer, network) {
    deployer.deploy(TokenFactory)
        .then(() => deployer.deploy(ChronoBankAssetFactory))
        .then(() => deployer.deploy(ChronoBankAssetWithFeeFactory))
        .then(() => deployer.deploy(ChronoBankAssetWithCallbackFactory))
        .then(() => deployer.deploy(ChronoBankAssetWithFeeAndCallbackFactory))

        .then(() => TokenFactory.deployed())
        .then(_proxyFactory => proxyFactory = _proxyFactory)
        .then(() => proxyFactory.setAssetFactory("ChronoBankAsset", ChronoBankAssetFactory.address))
        .then(() => proxyFactory.setAssetFactory("ChronoBankAssetWithFee", ChronoBankAssetWithFeeFactory.address))
        .then(() => proxyFactory.setAssetFactory("ChronoBankAssetWithCallback", ChronoBankAssetWithCallbackFactory.address))
        .then(() => proxyFactory.setAssetFactory("ChronoBankAssetWithFeeAndCallback", ChronoBankAssetWithFeeAndCallbackFactory.address))

        .then(() => StorageManager.deployed())
        .then(_storageManager => storageManager = _storageManager)
        .then(() => deployer.deploy(ChronoBankPlatformFactory))
        .then(_contractsManager => deployer.deploy(ChronoBankTokenExtensionFactory, ContractsManager.address))
        .then(() => console.log("[MIGRATION] [24] Factories: #done"))
}
