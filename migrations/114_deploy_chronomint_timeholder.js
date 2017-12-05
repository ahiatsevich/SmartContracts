const TimeHolder = artifacts.require("./TimeHolder.sol");
const Storage = artifacts.require('./Storage.sol');

module.exports = function(deployer, network) {
    deployer
    .then(() => deployer.deploy(TimeHolder, Storage.address, 'Deposits'))

    .then(() => console.log("[MIGRATION] [" + parseInt(require("path").basename(__filename)) + "] TimeHolder deploy: #done"))
}
