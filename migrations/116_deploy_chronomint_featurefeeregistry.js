const FeatureFeeManager = artifacts.require("./FeatureFeeManager.sol");
const Storage = artifacts.require('./Storage.sol');

module.exports = function(deployer, network) {
    deployer
    .then(() => deployer.deploy(FeatureFeeManager, Storage.address, 'FeatureFeeManager'))
    .then(() => console.log("[MIGRATION] [" + parseInt(require("path").basename(__filename)) + "] FeatureFeeManager deploy: #done"))
}
