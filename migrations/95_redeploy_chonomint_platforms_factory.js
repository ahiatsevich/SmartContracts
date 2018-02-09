var ChronoBankPlatformFactory = artifacts.require('./ChronoBankPlatformFactory.sol');

module.exports = function (deployer, network) {
    deployer
    .then(() => deployer.deploy(ChronoBankPlatformFactory))
    .then(() => console.log("[MIGRATION] [" + parseInt(require("path").basename(__filename)) + "] ChronoBank Platform Factory deploy: #done"))
}
