var ChronoBankPlatformFactory = artifacts.require('./ChronoBankPlatformFactory.sol');
const ContractsManager = artifacts.require('./ContractsManager.sol')

module.exports = function (deployer, network) {
    deployer
    .then(() => deployer.deploy(ChronoBankPlatformFactory))
    .then(() => console.log("[MIGRATION] [" + parseInt(require("path").basename(__filename)) + "] ChronoBank Platform Factory deploy: #done"))
}
