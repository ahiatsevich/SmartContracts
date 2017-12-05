const ContractsManager = artifacts.require('./ContractsManager.sol')
const AssetOwnershipDelegateResolver = artifacts.require('./AssetOwnershipDelegateResolver.sol')
const StorageManager = artifacts.require("./StorageManager.sol")

module.exports = function (deployer, network) {
    deployer
        .then(() => StorageManager.deployed())
        .then(_storageManager => storageManager = _storageManager)
        .then(() => storageManager.giveAccess(AssetOwnershipDelegateResolver.address, 'AssetOwnershipResolver'))
        .then(() => AssetOwnershipDelegateResolver.deployed())
        .then(_resolver => _resolver.init(ContractsManager.address))
        .then(() => console.log("[MIGRATION] [" + parseInt(require("path").basename(__filename)) + "] Assets Ownership Resolver init: #done"))
}
