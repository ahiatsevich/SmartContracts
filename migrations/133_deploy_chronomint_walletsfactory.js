const WalletsFactory = artifacts.require("./WalletsFactory.sol");

module.exports = function (deployer, network) {
    if (!WalletsFactory.isDeployed()) {
        deployer.deploy(WalletsFactory)
            .then(() => console.log("[MIGRATION] [133] WalletsFactory: #done"))
    } else {
        console.log("[MIGRATION] [133] WalletsFactory: #already deployed")
    }
}
