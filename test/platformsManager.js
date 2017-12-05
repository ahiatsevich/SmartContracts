const Setup = require("../setup/setup")
const eventsHelper = require('./helpers/eventsHelper')
const ErrorsEnum = require("../common/errors")
const Reverter = require('./helpers/reverter')
const ChronoBankPlatform = artifacts.require("./ChronoBankPlatform.sol")
const TokenManagementInterface = artifacts.require('./TokenManagementInterface.sol')

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
        await createdPlatform.setupEventsAdmin(Setup.platformsManager.address, { from: platformOwner })
        await Setup.multiEventsHistory.authorize(createdPlatform.address, { from: systemOwner })
        return createdPlatform
    }

    const getAllPlatformsForUser = async (user) => {
        var platformsMetas = await Setup.platformsManager.getPlatformsMetadataForUser.call(user)
        return platformsMetas
    }

    before("setup", function(done) {
        Setup.setup((e) => {
            console.log(e);
            reverter.snapshot((e) => {
                done(e)
            })
        })
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
            let emptyPlatformsCount = await Setup.platformsManager.getPlatformsForUserCount.call(owner)
            assert.equal(emptyPlatformsCount, 0)

            let createPlatformTx = await Setup.platformsManager.createPlatform({from: owner })
            let createPlatformEvent = eventsHelper.extractEvents(createPlatformTx, "PlatformRequested")[0]
            assert.isDefined(createPlatformEvent)
            assert.notEqual(createPlatformEvent.args.tokenExtension, 0x0)

            let platform = await ChronoBankPlatform.at(createPlatformEvent.args.platform)
            await platform.claimContractOwnership({ from: owner })

            let existedPlatformsCount = await Setup.platformsManager.getPlatformsForUserCount.call(owner)
            assert.equal(existedPlatformsCount, 1)
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

    context("update platform ownership", function () {
        let owner = owner1
        let otherOwner = owner2
        let nonOwner = owner3
        let platform

        it("prepare", async () => {
            platform = await createPlatform(otherOwner)
            let successAttachResultCode = await Setup.platformsManager.attachPlatform.call(platform.address, { from: otherOwner })
            assert.equal(successAttachResultCode, ErrorsEnum.OK)
            await Setup.platformsManager.attachPlatform(platform.address, { from: otherOwner })
        })
        it("snapshot", reverter.snapshot)

        it("should update an associated platform ownership when platform contract ownership has changed", async () => {
            await platform.changeContractOwnership(owner, { from: otherOwner })
            await platform.claimContractOwnership({ from: owner })

            let successAssociatedPlatformChangeResultCode = await Setup.platformsManager.replaceAssociatedPlatformFromOwner.call(platform.address, otherOwner, { from: owner })
            assert.equal(successAssociatedPlatformChangeResultCode, ErrorsEnum.OK)
        })
        it("revert", reverter.revert)

        it("should fail on detaching a platform if no accociated ownership changes were made after contract ownership changes", async () => {
            await platform.changeContractOwnership(owner, { from: otherOwner })
            await platform.claimContractOwnership({ from: owner })

            var failedDetachResultCode = await Setup.platformsManager.detachPlatform.call(platform.address, { from: owner })
            assert.equal(failedDetachResultCode, ErrorsEnum.PLATFORMS_INCONSISTENT_INTERNAL_STATE)

            failedDetachResultCode = await Setup.platformsManager.detachPlatform.call(platform.address, { from: otherOwner })
            assert.equal(failedDetachResultCode, ErrorsEnum.UNAUTHORIZED)
        })
        it("revert", reverter.revert)

        it("should fail on updating associated platform ownership when performed by non-contract owner of the platform", async () => {
            await platform.changeContractOwnership(owner, { from: otherOwner })
            await platform.claimContractOwnership({ from: owner })

            let failedAssociatedPlatformChangeResultCode = await Setup.platformsManager.replaceAssociatedPlatformFromOwner.call(platform.address, otherOwner, { from: nonOwner })
            assert.equal(failedAssociatedPlatformChangeResultCode, ErrorsEnum.UNAUTHORIZED)
        })
        it("revert", reverter.revert)

        it("should be successful on updating associated platform ownership when performed by new platform owner", async () => {
            await platform.changeContractOwnership(owner, { from: otherOwner })
            await platform.claimContractOwnership({ from: owner })

            let successAssociatedPlatformChangeResultCode = await Setup.platformsManager.replaceAssociatedPlatformFromOwner.call(platform.address, otherOwner, { from: owner })
            assert.equal(successAssociatedPlatformChangeResultCode, ErrorsEnum.OK)
        })
        it("revert", function (done) {
            reverter.revert(done, reverter.snapshotId - 1)
        })
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

        it('revert', function (done) {
            reverter.revert(done, reverter.snapshotId - 1)
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

        it('revert', function (done) {
            reverter.revert(done, reverter.snapshotId - 1)
        })

    })
})
