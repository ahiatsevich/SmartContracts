const Setup = require("../setup/setup")
const eventsHelper = require('./helpers/eventsHelper')
const ErrorsEnum = require("../common/errors")
const Reverter = require('./helpers/reverter')
const ChronoBankPlatform = artifacts.require("./ChronoBankPlatform.sol")
const TokenManagementInterface = artifacts.require('./TokenManagementInterface.sol')
const PlatformsManagerDammyDeprecated = artifacts.require('./PlatformsManagerDammyDeprecated.sol')
const PlatformsManager = artifacts.require('./PlatformsManager.sol')
const ChronoBankPlatformFactory = artifacts.require('./ChronoBankPlatformFactory.sol')

contract("PlatformsManager", function (accounts) {
    const contractOwner = accounts[0]
    const systemOwner = accounts[0]
    const owner1 = accounts[2]
    const owner2 = accounts[3]
    const owner3 = accounts[4]

    const reverter = new Reverter(web3)

    const createPlatform = async (platformOwner) => {
        let createdPlatform = await ChronoBankPlatform.new({ from: platformOwner })
        await createdPlatform.setupEventsHistory(Setup.multiEventsHistory.address, { from: platformOwner })
        await Setup.multiEventsHistory.authorize(createdPlatform.address, { from: systemOwner })
        return createdPlatform
    }

    const getAllPlatformsForUser = async (user) => {
        var userPlatforms = []
        let platformsCount = await Setup.platformsManager.getPlatformsCount.call()
        let allPlatforms = await Setup.platformsManager.getPlatforms.call(0, platformsCount)
        for (var _platformIdx = 0; _platformIdx < allPlatforms.length; ++_platformIdx) {
            const _platformAddr = allPlatforms[_platformIdx];

            let _platform = await ChronoBankPlatform.at(_platformAddr)
            let _owner = await _platform.contractOwner.call()
            if (_owner === user) {
                userPlatforms.push(_platformAddr)
            }
        }

        return userPlatforms
    }

    const deployPlatformsManagerWithStatistics = async () => {
        let platformsManager = await PlatformsManagerDammyDeprecated.new(Setup.storage.address, "PlatformsManager")
        await Setup.storageManager.giveAccess(platformsManager.address, "PlatformsManager")
        await platformsManager.init(Setup.contractsManager.address, ChronoBankPlatformFactory.address)
        await Setup.multiEventsHistory.authorize(platformsManager.address)

        return platformsManager
    }

    const deployNewPlatformsManager = async () => {
        let platformsManager = await PlatformsManager.new(Setup.storage.address, "PlatformsManager")
        await Setup.storageManager.giveAccess(platformsManager.address, "PlatformsManager")
        await platformsManager.init(Setup.contractsManager.address, ChronoBankPlatformFactory.address)
        await Setup.multiEventsHistory.authorize(platformsManager.address)

        return platformsManager
    }

    before("setup", async () => {
        await Setup.setupPromise()
        await reverter.promisifySnapshot()
    })

    context("request platform", function () {
        let owner = owner1

        it("should create platforms on request even if an user already has some in ownership", async () => {
            let createPlatformTx = await Setup.platformsManager.createPlatform({ from: owner })
            let createPlatformEvent = eventsHelper.extractEvents(createPlatformTx, "PlatformRequested")[0]
            assert.isDefined(createPlatformEvent)

            let platform = await ChronoBankPlatform.at(createPlatformEvent.args.platform)
            await platform.claimContractOwnership({ from: owner })

            let secondCreatePlatformTx = await Setup.platformsManager.createPlatform({ from: owner })
            let secondCreatePlatformEvent = eventsHelper.extractEvents(secondCreatePlatformTx, "PlatformRequested")[0]
            assert.isDefined(secondCreatePlatformEvent)

            assert.notEqual(createPlatformEvent.args.platform, secondCreatePlatformEvent.args.platform)
        })

        it("revert", reverter.revert)

        it("should create a new platform for an user", async () => {
            let beforePlatformsCount = await Setup.platformsManager.getPlatformsCount.call()

            let createPlatformTx = await Setup.platformsManager.createPlatform({from: owner })
            let createPlatformEvent = eventsHelper.extractEvents(createPlatformTx, "PlatformRequested")[0]
            assert.isDefined(createPlatformEvent)
            assert.notEqual(createPlatformEvent.args.tokenExtension, 0x0)

            let platform = await ChronoBankPlatform.at(createPlatformEvent.args.platform)
            await platform.claimContractOwnership({ from: owner })

            let existedPlatformsCount = await Setup.platformsManager.getPlatformsCount.call()
            assert.equal(existedPlatformsCount.toNumber(), beforePlatformsCount.toNumber() + 1)
        })

        it("revert", reverter.revert)
    })

    context("attach platform", function () {
        let owner = owner1
        var platform

        it("should be able to attach a platform that is not registered by platform owner", async () => {
            platform = await createPlatform(owner)
            let attachPlatformResultCode = await Setup.platformsManager.attachPlatform.call(platform.address,  { from: owner })
            assert.equal(attachPlatformResultCode, ErrorsEnum.OK)
        })

        it("should not be able to attach a platform by non-contract (PlatformsManager) owner", async () => {
            let attachPlatformResultCode = await Setup.platformsManager.attachPlatform.call(platform.address, { from: systemOwner })
            assert.equal(attachPlatformResultCode, ErrorsEnum.UNAUTHORIZED)
        })

        it("revert", reverter.revert)

        it("should not be able to attach a platform that is already attached", async () => {
            platform = await createPlatform(owner)
            let attachPlatformResultCode = await Setup.platformsManager.attachPlatform.call(platform.address, { from: owner })
            assert.equal(attachPlatformResultCode, ErrorsEnum.OK)
            await Setup.platformsManager.attachPlatform(platform.address, { from: owner })

            let failedPlatformResultCode = await Setup.platformsManager.attachPlatform.call(platform.address, { from: owner })
            assert.equal(failedPlatformResultCode, ErrorsEnum.PLATFORMS_ATTACHING_PLATFORM_ALREADY_EXISTS)
        })

        it("revert", reverter.revert)
    })

    context("detach platform", function () {
        let owner = owner1
        let nonOwner = owner2
        let platform

        it("should not be able to detach a platform that is not registered", async () => {
            platform = await createPlatform(owner)
            let failedDetachResultCode = await Setup.platformsManager.detachPlatform.call(platform.address, { from: owner })
            assert.equal(failedDetachResultCode, ErrorsEnum.PLATFORMS_PLATFORM_DOES_NOT_EXIST)
        })

        it("should not be able to detach a platform by non-owner of a platform", async () => {
            let successAttachResultCode = await Setup.platformsManager.attachPlatform.call(platform.address, { from: owner })
            assert.equal(successAttachResultCode, ErrorsEnum.OK)
            await Setup.platformsManager.attachPlatform(platform.address, { from: owner })

            let failedDetachResultCode = await Setup.platformsManager.detachPlatform.call(platform.address, { from: nonOwner })
            assert.equal(failedDetachResultCode, ErrorsEnum.UNAUTHORIZED)
        })

        it("should be able to detach a platform that is registered by an owner of the platform", async () => {
            let successDetachResultCode = await Setup.platformsManager.detachPlatform.call(platform.address, { from: owner })
            assert.equal(successDetachResultCode, ErrorsEnum.OK)

            let successDetachTx = await Setup.platformsManager.detachPlatform(platform.address, { from: owner })
            let event = eventsHelper.extractEvents(successDetachTx, "PlatformDetached")[0]
            assert.isDefined(event)
            assert.equal(platform.address, event.args.platform)
        })

        it("revert", reverter.revert)
    })

    context("properties check", function () {
        let owner = owner1
        let nonOwner = owner2
        let platform


        it("prepare", async () => {
            platform = await createPlatform(owner)
            let attachTx = await Setup.platformsManager.attachPlatform(platform.address, { from: owner })
            let event = eventsHelper.extractEvents(attachTx, "PlatformAttached")[0]
            assert.isDefined(event)
        })
        it("snapshot", reverter.snapshot)

        it("should return the same platform for a user who is owning a platform", async () => {
            let gotPlatformAddresses = await getAllPlatformsForUser(owner)
            assert.include(gotPlatformAddresses, platform.address)
        })

        it("should return no platform for non platform owner", async () => {
            let noPlatformAddresses = await getAllPlatformsForUser(nonOwner)
            assert.lengthOf(noPlatformAddresses, 0)
        })

        it('revert', async () => {
            await reverter.promisifyRevert(reverter.snapshotId - 1)
        })
    })

    context("platform's events", function () {
        let owner = accounts[7]
        let platform
        let tokenExtension
        let tokenSymbol = "_TEST"
        let totalTokensBalance = 1000

        it("prepare", async () => {
            let createPlatformTx = await Setup.platformsManager.createPlatform({ from: owner })
            let event = eventsHelper.extractEvents(createPlatformTx, "PlatformRequested")[0]
            assert.isDefined(event)

            platform = await ChronoBankPlatform.at(event.args.platform)
            tokenExtension = await TokenManagementInterface.at(event.args.tokenExtension)
        })

        it('creating asset should spawn events from a platform', async () => {
            let issueAssetTx = await platform.issueAsset(tokenSymbol, totalTokensBalance, "test token", "some description", 2, true, { from: owner })
            let issueEvent = eventsHelper.extractEvents(issueAssetTx, "Issue")[0]
            assert.isDefined(issueEvent)
            assert.equal(totalTokensBalance, issueEvent.args.value.valueOf())
        })

        it('reissue asset should spawn events from a platform', async () => {
            let reissueValue = 333
            let reissueAssetTx = await platform.reissueAsset(tokenSymbol, reissueValue, { from: owner })
            let reissueEvent = eventsHelper.extractEvents(reissueAssetTx, "Issue")[0]
            assert.isDefined(reissueEvent)
            assert.equal(reissueValue, reissueEvent.args.value.valueOf())
        })

        it('revoke asset should spawn events from a platform', async () => {
            let revokeValue = 333
            let revokeAssetTx = await platform.revokeAsset(tokenSymbol, revokeValue, { from: owner })
            let revokeEvent = eventsHelper.extractEvents(revokeAssetTx, "Revoke")[0]
            assert.isDefined(revokeEvent)
            assert.equal(revokeValue, revokeEvent.args.value.valueOf())
        })

        it('revert', async () => {
            await reverter.promisifyRevert(reverter.snapshotId - 1)
        })
    })

    context("migration from deprecated PlatformsManager with statistics to cleaned up PlatformsManager contract", () => {
        let oldPlatformsManager
        let owner = accounts[6]
        let createdPlatforms = []

        it("should be able to able to deploy old platforms manager and create platforms", async () => {
            oldPlatformsManager = await deployPlatformsManagerWithStatistics()

            const numberOfPlatforms = 3
            for (var _iterationIdx = 0; _iterationIdx < numberOfPlatforms; ++_iterationIdx) {
                let createPlatformTx = await oldPlatformsManager.createPlatform({ from: owner })
                let event = eventsHelper.extractEvents(createPlatformTx, "PlatformRequested")[0]
                assert.isDefined(event)

                let platform = await ChronoBankPlatform.at(event.args.platform)
                createdPlatforms.push(platform)
            }

            assert.lengthOf(createdPlatforms, numberOfPlatforms)
            for (platform of createdPlatforms) {
                assert.isTrue(await oldPlatformsManager.isPlatformAttached.call(platform.address))
            }
        })

        it("should be able to attach platform to old platforms manager", async () => {
            let platform = await createPlatform(owner)
            await oldPlatformsManager.attachPlatform(platform.address, { from: owner })

            assert.isTrue(await oldPlatformsManager.isPlatformAttached.call(platform.address))

            createdPlatforms.push(platform)
        })

        it("should be able to migrate platforms to new version of platforms manager without statistics", async () => {
            let updatedPlatformsManager = await deployNewPlatformsManager()

            for (platform of createdPlatforms) {
                assert.isTrue(await updatedPlatformsManager.isPlatformAttached.call(platform.address))
                assert.isFalse(await oldPlatformsManager.isPlatformAttached.call(platform.address))
            }
        })

        it('revert', async () => {
            await reverter.promisifyRevert()
        })
    })
})
