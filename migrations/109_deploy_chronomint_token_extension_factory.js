var ChronoBankTokenExtensionFactory = artifacts.require('./ChronoBankTokenExtensionFactory.sol')
const ContractsManager = artifacts.require('./ContractsManager.sol')

module.exports = function (deployer, network) {
    deployer
    .then(() => deployer.deploy(ChronoBankTokenExtensionFactory, ContractsManager.address))
    .then(() => console.log("[MIGRATION] [" + parseInt(require("path").basename(__filename)) + "] Token Management Extension Factory redeploy: #done"))
}
