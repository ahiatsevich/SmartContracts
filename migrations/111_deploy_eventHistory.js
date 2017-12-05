const MultiEventsHistory = artifacts.require("./MultiEventsHistory.sol");
const ContractsManager = artifacts.require("./ContractsManager.sol");

module.exports = function(deployer,network) {
    deployer.deploy(MultiEventsHistory)
    .then(() => ContractsManager.deployed())
    .then(_contractsManager => _contractsManager.addContract(MultiEventsHistory.address, "MultiEventsHistory"))
    .then(() => console.log("[MIGRATION] [108] Events History: #done"))
}
