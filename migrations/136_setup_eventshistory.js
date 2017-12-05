const UserManager = artifacts.require("./UserManager.sol");
const PendingManager = artifacts.require("./PendingManager.sol");
const LOCManager = artifacts.require("./LOCManager.sol");
const MultiEventsHistory = artifacts.require("./MultiEventsHistory.sol");

module.exports = function (deployer, network) {
    deployer
        .then(() => MultiEventsHistory.deployed())
        .then(_history => history = _history)

        .then(() => UserManager.deployed())
        .then(_manager => _manager.setEventsHistory(MultiEventsHistory.address))
        .then(() => history.authorize(UserManager.address))

        .then(() => PendingManager.deployed())
        .then(_manager => _manager.setEventsHistory(MultiEventsHistory.address))
        .then(() => history.authorize(PendingManager.address))

        .then(() => LOCManager.deployed())
        .then(_manager => _manager.setEventsHistory(MultiEventsHistory.address))
        .then(() => history.authorize(LOCManager.address))

        .then(() => console.log("[MIGRATION] [" + parseInt(require("path").basename(__filename)) + "] EventsHitory setup: #done"))
}
