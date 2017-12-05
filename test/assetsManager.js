const Setup = require('../setup/setup')
const eventsHelper = require('./helpers/eventsHelper')
const ErrorsEnum = require("../common/errors")
const Reverter = require('./helpers/reverter')
const ChronoBankAssetProxy = artifacts.require('./ChronoBankAssetProxy.sol')
const ChronoBankPlatform = artifacts.require('./ChronoBankPlatform.sol')
const TokenManagementInterface = artifacts.require("./TokenManagementInterface.sol")
const PlatformTokenExtensionGatewayManagerEmitter = artifacts.require("./PlatformTokenExtensionGatewayManagerEmitter.sol")

contract('Assets Manager', function(accounts) {
    const contractOwner = accounts[0]
    const systemOwner = accounts[0]
    const owner1 = accounts[1]
    const owner2 = accounts[2]
    const owner3 = accounts[3]
    const owner4 = accounts[4]
    const owner5 = accounts[5]
    const nonOwner = accounts[6]

    const reverter = new Reverter(web3)

    var unix = Math.round(+new Date()/1000)
    let utils = web3._extend.utils

    const zeroAddress = '0x' + utils.padLeft(utils.toHex("0").substr(2), 40)

    before('setup', function(done) {
        Setup.setup((e) => {
            console.log(e);
            reverter.snapshot((e) => {
                done(e)
            })
        })
    })

    context("AssetManager", function () {
        context("properties check", function () {
            it("should have token factory setup", async () => {
                let tokenFactory = await Setup.assetsManager.getTokenFactory.call()
                assert.notEqual(tokenFactory, zeroAddress)
            })

            it("should have token extension management factory setup", async () => {
                let tokenExtensionFactory = await Setup.assetsManager.getTokenExtensionFactory.call()
                assert.notEqual(tokenExtensionFactory, zeroAddress)
            })
        })

        context("platform-related", function () {
            let owner = owner1
            let platformId
            let platform

            it("prepare", async () => {
                let successRequestPlatfortTx = await Setup.platformsManager.createPlatform({ from: owner })
                let event = eventsHelper.extractEvents(successRequestPlatfortTx, "PlatformRequested")[0]
                assert.isDefined(event)
                platform = await ChronoBankPlatform.at(event.args.platform)
                platformToId = event.args.platformId
                assert.notEqual(event.args.tokenExtension, zeroAddress)
            })

            it("should have a tokenExtension for a platform", async () => {
                let tokenExtensionAddress = await Setup.assetsManager.getTokenExtension.call(platform.address)
                assert.notEqual(tokenExtensionAddress, zeroAddress)
            })

            it("should have the same token extension if it already exists", async () => {
                let tokenExtensionAddress = await Setup.assetsManager.getTokenExtension.call(platform.address)
                let tokenExtensionRequestResultCode = await Setup.assetsManager.requestTokenExtension.call(platform.address)
                assert.equal(tokenExtensionRequestResultCode, ErrorsEnum.OK)

                let tokenExtensionRequestTx = await Setup.assetsManager.requestTokenExtension(platform.address)
                let event = eventsHelper.extractEvents(tokenExtensionRequestTx, "TokenExtensionRequested")[0]
                assert.isDefined(event)
                assert.equal(event.args.tokenExtension, tokenExtensionAddress)
            })

            it("should return no assets for a newly created platform without any assets", async () => {
                let assetsCount = await Setup.assetsManager.getAssetsForOwnerCount.call(platform.address, owner)
                assert.equal(assetsCount, 0)
            })

            it("should return one asset after creating an asset on a platform", async () => {
                let symbol = "MTT"
                let desc = 'My Test Token'

                let tokenExtensionAddress = await Setup.assetsManager.getTokenExtension.call(platform.address)
                let tokenExtension = await TokenManagementInterface.at(tokenExtensionAddress)
                let tokenEmitter = await PlatformTokenExtensionGatewayManagerEmitter.at(tokenExtensionAddress)
                let assetResultCode = await tokenExtension.createAssetWithoutFee.call(symbol, desc, "", 0, 8, true, 0x0, { from: owner })
                assert.equal(assetResultCode, ErrorsEnum.OK)

                let assetTx = await tokenExtension.createAssetWithoutFee(symbol, desc, "", 0, 8, true, 0x0, { from: owner })
                let logs = await eventsHelper.extractReceiptLogs(assetTx, tokenEmitter.AssetCreated())
                assert.isDefined(logs[0])

                let assetsCount = await Setup.assetsManager.getAssetsForOwnerCount.call(platform.address, owner)
                assert.equal(assetsCount, 1)

                let isAssetOwner = await Setup.assetsManager.isAssetOwner.call(symbol, owner)
                assert.isOk(isAssetOwner)
            })

            it("revert", reverter.revert)
        })

        context("asset owner related", function () {
            it("prepare")
            it("should recognize an user added through platform as an asset owner in AssetsManager")
            it("should remove an asset owner from a platform and show it in AssetsManager")
        })

        context("statistics", function () {
            it("should have 1 platform count for a user")
            it("should have 2 platforms after creating a new platform")
            it("should have 1 total token number from two platforms")
            it("should have 3 total token number after creating 2 tokens on different platforms")
            it("should have 2 managers for LHT token")
            it("should have 1 manager for newly created token")
            it("should have 2 managers in total from all platforms")
        })
    })
})
