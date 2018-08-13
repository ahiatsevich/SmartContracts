const Setup = require('../setup/setup')
const eventsHelper = require('./helpers/eventsHelper')
const ErrorsEnum = require("../common/errors")
const Reverter = require('./helpers/reverter')
const utils = require("./helpers/utils")

const ChronoBankAsset = artifacts.require('ChronoBankAsset')
const ChronoBankAssetProxy = artifacts.require('ChronoBankAssetProxy')
const ChronoBankPlatform = artifacts.require('ChronoBankPlatform')
const StorageManager = artifacts.require('StorageManager')
const TokenManagementInterface = artifacts.require("TokenManagementInterface")
const PlatformTokenExtensionGatewayManagerEmitter = artifacts.require("PlatformTokenExtensionGatewayManagerEmitter")

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

    before('setup', async () => {
        await Setup.setupPromise()
        await reverter.promisifySnapshot()
    })

    context("AssetManager", function () {
        context("properties check", function () {
            it("should have token factory setup", async () => {
                let tokenFactory = await Setup.assetsManager.getTokenFactory.call()
                assert.notEqual(tokenFactory, utils.zeroAddress)
            })

            it("should have token extension management factory setup", async () => {
                let tokenExtensionFactory = await Setup.assetsManager.getTokenExtensionFactory.call()
                assert.notEqual(tokenExtensionFactory, utils.zeroAddress)
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
                assert.notEqual(event.args.tokenExtension, utils.zeroAddress)
            })

            it("should have a tokenExtension for a platform", async () => {
                let tokenExtensionAddress = await Setup.assetsManager.getTokenExtension.call(platform.address)
                assert.notEqual(tokenExtensionAddress, utils.zeroAddress)
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

    context("AssetsManager statistics", () => {

        const createToken = async (platform, symbol, owner) => {
            const storageManager = await StorageManager.at(await platform.manager())
            const proxy = await ChronoBankAssetProxy.new({ from: owner, })
            await platform.issueAsset(symbol, 10000, symbol, "", 2, false, owner, { from: systemOwner, })
            await platform.changeOwnership(symbol, owner, { from: systemOwner, })
            await proxy.init(platform.address, symbol, symbol)
            const asset = await ChronoBankAsset.new(platform.address, symbol, { from: owner, })
            await storageManager.giveAccess(asset.address, symbol)
            await asset.init(proxy.address, { from: owner, })
            await proxy.proposeUpgrade(asset.address, { from: owner, })
            await platform.setProxy(proxy.address, symbol, { from: systemOwner, });
        }

        const createTokensOnPlatform = async (platform, symbols, owners) => {            
            for (var _idx = 0; _idx < symbols.length; ++_idx) {                
                const symbol = symbols[_idx]
                const owner = owners[_idx]

                await createToken(platform, symbol, owner)
            }
        }

        const createPlatforms = async (numberOfPlatforms) => {
            let platforms = []
            for (var _platformIdx = 0; _platformIdx < numberOfPlatforms; ++_platformIdx) {
                const tx = await Setup.platformsManager.createPlatform({ from: systemOwner, })
                const event = (await eventsHelper.findEvent([Setup.platformsManager,], tx, "PlatformRequested"))[0]                
                const platform = await ChronoBankPlatform.at(event.args.platform)
                platforms.push({ 
                    id: event.args.platformId,
                    platform: platform,
                })

            }


            return platforms
        }

        after(async () => {
            await reverter.promisifyRevert()
        })

        context("get assets owned by user from platforms", () => {
            const numberOfPlatforms = 2
            let platforms
            let assetsManager
           
            before(async () => {
                assetsManager = Setup.assetsManager
                platforms = await createPlatforms(numberOfPlatforms)
                
                // platform 1
                {
                    const symbols = [ "TRP", "UPS", "MOG", ]
                    const owners = [ owner1, owner2, owner1, ]
                    await createTokensOnPlatform(platforms[0].platform, symbols, owners)
                }
                
                // platform 2
                {
                    const symbols = [ "WQE", "XSD", ]
                    const owners = [ owner3, owner2, ]
                    await createTokensOnPlatform(platforms[1].platform, symbols, owners)
                }
            })
            
            it("should have 3 assets in first platform", async () => {
                assert.equal(await platforms[0].platform.symbolsCount.call(), 3)
            })
            
            it("should have 2 assets in second platform", async () => {
                assert.equal(await platforms[1].platform.symbolsCount.call(), 2)
            })

            it("should be able to add more owners to assets in the first platform", async () => {
                const platform = platforms[0].platform

                await platform.addAssetPartOwner("TRP", owner4, { from: owner1, })
                assert.isTrue(await platform.hasAssetRights.call(owner4, "TRP"))

                await platform.addAssetPartOwner("MOG", owner4, { from: owner1, })
                assert.isTrue(await platform.hasAssetRights.call(owner4, "MOG"))
            })

            it("should show that owner1 has 2 assets in his ownership", async () => {
                const owner = owner1
                let [ gotPlatforms, gotAssets, ] = await assetsManager.getOwnedAssetsFromPlatforms.call(platforms.map(p => p.platform.address), { from: owner, })
                gotAssets = gotAssets.removeZeros()

                assert.lengthOf(gotAssets, 2)
            })

            it("should show that owner3 has 1 asset in his ownership", async () => {
                const owner = owner3
                let [ gotPlatforms, gotAssets, ] = await assetsManager.getOwnedAssetsFromPlatforms.call(platforms.map(p => p.platform.address), { from: owner, })
                gotAssets = gotAssets.removeZeros()

                assert.lengthOf(gotAssets, 1)
            })

            it("should show that owner4 has 2 assets in his ownership", async () => {
                const owner = owner4
                let [ gotPlatforms, gotAssets, ] = await assetsManager.getOwnedAssetsFromPlatforms.call(platforms.map(p => p.platform.address), { from: owner, })
                gotAssets = gotAssets.removeZeros()

                assert.lengthOf(gotAssets, 2)
            })

            it("should show that asset `TRP` has 2 managers", async () => {
                const proxyAddress = await platforms[0].platform.proxies.call("TRP")
                assert.notEqual(proxyAddress, utils.zeroAddress)                            

                let managers = await assetsManager.getManagersForAsset.call(proxyAddress)                
                managers = managers.removeZeros()

                assert.lengthOf(managers, 2)
            })

            it("should show that asset `UPS` has 1 manager only", async () => {
                const proxyAddress = await platforms[0].platform.proxies.call("UPS")
                assert.notEqual(proxyAddress, utils.zeroAddress)

                let managers = await assetsManager.getManagersForAsset.call(proxyAddress)                
                managers = managers.removeZeros()
                
                assert.lengthOf(managers, 1)
            })

            it("should be able to remove one manager from `TRP` asset", async () => {
                const platform = platforms[0].platform

                await platform.removeAssetPartOwner("TRP", owner4, { from: owner1, })
                assert.isFalse(await platform.hasAssetRights.call(owner4, "TRP"))
            })

            it("should show that asset `TRP` has 1 manager left", async () => {
                const proxyAddress = await platforms[0].platform.proxies.call("TRP")
                assert.notEqual(proxyAddress, utils.zeroAddress)

                let managers = await assetsManager.getManagersForAsset.call(proxyAddress)
                managers = managers.removeZeros()

                assert.lengthOf(managers, 1)
            })
        })
    })
})
