const ContractsManager = artifacts.require('ContractsManager')
const PlatformsManager = artifacts.require('PlatformsManager')
const AssetsManager = artifacts.require('AssetsManager')
const ChronoBankAssetOwnershipManager = artifacts.require('ChronoBankAssetOwnershipManager')
const TokenManagementInterface = artifacts.require('./TokenManagementInterface.sol')
const LOCWallet = artifacts.require('LOCWallet')
const RewardsWallet = artifacts.require('RewardsWallet')
const Rewards = artifacts.require('Rewards')
const path = require("path")

const bytes32fromBase58 = require('../test/helpers/bytes32fromBase58')
const eventsHelper = require('../test/helpers/eventsHelper')

module.exports = function(deployer, network, accounts) {

    const LHT_SYMBOL = 'LHT'
    const LHT_NAME = 'Labour-hour Token'
    const LHT_DESCRIPTION = 'ChronoBank Lht Assets'
    const LHT_BASE_UNIT = 8
    const IS_REISSUABLE = true
    const WITH_FEE = true

    const FEE_VALUE = 100 // 1%

    const systemOwner = accounts[0]

    var lhtIconIpfsHash = ""
    if (network !== "test") {
        //https://ipfs.infura.io:5001
        lhtIconIpfsHash = "Qmdhbz5DTrd3fLHWJ8DY2wyAwhffEZG9MoWMvbm3MRwh8V";
    }

    deployer.then(async () => {
        const platformsManager = await PlatformsManager.deployed()
        const assetsManager = await AssetsManager.deployed()

        const createPlatformTx = await platformsManager.createPlatform()
        let platformAddr
        const event = (await eventsHelper.findEvent([platformsManager,], createPlatformTx, "PlatformRequested"))[0]
        if (event === undefined) {
            platformAddr = await platformsManager.getPlatformForUserAtIndex.call(systemOwner, 0)
        } else {
            platformAddr = event.args.platform
        }

        const tokenExtensionAddr = await assetsManager.getTokenExtension.call(platformAddr)
        const tokenExtension = await TokenManagementInterface.at(tokenExtensionAddr)
        const createLhtResultCode = (await tokenExtension.createAssetWithFee.call(
            LHT_SYMBOL,
            LHT_NAME,
            LHT_DESCRIPTION,
            0,
            LHT_BASE_UNIT,
            IS_REISSUABLE,
            RewardsWallet.address,
            FEE_VALUE,
            bytes32fromBase58(lhtIconIpfsHash)
        )).toNumber()

        if (createLhtResultCode === 1) {
            await tokenExtension.createAssetWithFee(
                LHT_SYMBOL,
                LHT_NAME,
                LHT_DESCRIPTION,
                0,
                LHT_BASE_UNIT,
                IS_REISSUABLE,
                RewardsWallet.address,
                FEE_VALUE,
                bytes32fromBase58(lhtIconIpfsHash)
            )
        } 
        else {
            throw `Cannot create token LHT. Result code: + ${createLhtResultCode}`
        }

        const assetOwnershipManagerAddr = await tokenExtension.getAssetOwnershipManager.call()
        const assetOwnershipManager = ChronoBankAssetOwnershipManager.at(assetOwnershipManagerAddr)
        await assetOwnershipManager.addAssetPartOwner(LHT_SYMBOL, LOCWallet.address)

        const contractsManager = await ContractsManager.deployed()
        await contractsManager.removeContract(Rewards.address)
        const rewards = await Rewards.deployed()
        await rewards.init(ContractsManager.address, RewardsWallet.address, platformAddr, 0)

        console.log(`[MIGRATION] [${parseInt(path.basename(__filename))}] PlatformsManager reinit with LHT: #done`)
    })
}
