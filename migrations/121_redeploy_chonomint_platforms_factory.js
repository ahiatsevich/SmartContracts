var ChronoBankPlatformFactory = artifacts.require('./ChronoBankPlatformFactory.sol');
var MultiEventsHistory = artifacts.require('./MultiEventsHistory.sol');
const AssetOwnershipDelegateResolver = artifacts.require('./AssetOwnershipDelegateResolver.sol')

module.exports = function (deployer, network) {
    deployer
    .then(() => deployer.deploy(ChronoBankPlatformFactory, AssetOwnershipDelegateResolver.address))
    .then(() => MultiEventsHistory.deployed())
    .then(_history => _history.authorize(ChronoBankPlatformFactory.address))
    .then(() => console.log("[MIGRATION] [" + parseInt(require("path").basename(__filename)) + "] ChronoBank Platform Factory redeploy: #done"))
}
