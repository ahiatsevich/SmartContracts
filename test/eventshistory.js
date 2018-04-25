const Rewards = artifacts.require("Rewards")
const AssetsManager = artifacts.require("AssetsManager")
const PlatformsManager = artifacts.require("PlatformsManager")
const ExchangeManager = artifacts.require("ExchangeManager")
const PendingManager = artifacts.require("PendingManager")
const FeatureFeeManager = artifacts.require("FeatureFeeManager")
const WalletsManager = artifacts.require("WalletsManager")
const BaseManager = artifacts.require("BaseManager")
const VotingManager = artifacts.require("VotingManager")
const TimeHolder = artifacts.require("TimeHolder")
const LOCManager = artifacts.require("LOCManager")
const UserManager = artifacts.require("UserManager")
const Roles2Library = artifacts.require("Roles2Library")
const MultiEventsHistory = artifacts.require("MultiEventsHistory")
const ERC20Manager = artifacts.require("ERC20Manager")

contract('MultiEventsHistory', (accounts) => {
    let managerContracts =
    [
        AssetsManager,
        PlatformsManager,
        ERC20Manager,
        UserManager,
        Roles2Library,
        ExchangeManager,
        LOCManager,
        PendingManager,
        Rewards,
        FeatureFeeManager,
        TimeHolder,
        VotingManager,
        WalletsManager
    ]

    for (var managerContract of managerContracts) {
        let artifact = managerContract
        it(`should be installed in ${artifact.contractName}`, async () => {
            let manager = await artifact.deployed()
            assert.equal(MultiEventsHistory.address, await manager.getEventsHistory())
        })
    }
})
