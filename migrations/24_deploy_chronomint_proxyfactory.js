var ProxyFactory = artifacts.require("./ProxyFactory.sol");
var ChronoBankPlatformFactory = artifacts.require('./ChronoBankPlatformFactory.sol');
var ChronoBankTokenExtensionFactory = artifacts.require('./ChronoBankTokenExtensionFactory.sol')
const ContractsManager = artifacts.require('./ContractsManager.sol')
const StorageManager = artifacts.require("./StorageManager.sol")

module.exports = function (deployer, network) {
    deployer.deploy(ProxyFactory)
        .then(() => StorageManager.deployed())
        .then(_storageManager => storageManager = _storageManager)
        .then(() => deployer.deploy(ChronoBankPlatformFactory))
        .then(_contractsManager => deployer.deploy(ChronoBankTokenExtensionFactory, ContractsManager.address))
        .then(() => console.log("[MIGRATION] [24] Factories: #done"))
}
