const Setup = require("../setup/setup")
const eventsHelper = require('./helpers/eventsHelper')
const ErrorsEnum = require("../common/errors")
const Reverter = require('./helpers/reverter')
const ChronoBankPlatform = artifacts.require("./ChronoBankPlatform.sol")
const StorageManager = artifacts.require("StorageManager")
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
        const storageManager = await StorageManager.new()
        let createdPlatform = await ChronoBankPlatform.new({ from: platformOwner })
        await createdPlatform.setManager(storageManager.address)
        await storageManager.giveAccess(createdPlatform.address, "ChronoBankPlatform")
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
        await platformsManager.init(Setup.contractsManager.address, ChronoBankPlatformFactory.address, Setup.storageManagerFactory.address)
        await Setup.multiEventsHistory.authorize(platformsManager.address)

        return platformsManager
    }

    before("setup", async () => {
        await Setup.setupPromise()
        await reverter.promisifySnapshot()
    })

    context("request platform", function () {
        let owner = owner1

        describe("for the same user", () => {
            let firstPlatformAddress
            let secondPlatformAddress

            let beforePlatformsCount

            before(async () => {
                beforePlatformsCount = (await Setup.platformsManager.getPlatformsCount.call()).toNumber()
            })

            after(async () => {
                await reverter.promisifyRevert()
            })

            it("should be able to create platform on request with OK code", async () => {
                assert.equal((await Setup.platformsManager.createPlatform.call({ from: owner })).toNumber(), ErrorsEnum.OK)
            })

            it("should be able to create platform on request", async () => {
                let createPlatformTx = await Setup.platformsManager.createPlatform({ from: owner })
                let createPlatformEvent = (await eventsHelper.findEvent([Setup.platformsManager,], createPlatformTx, "PlatformRequested"))[0]
                assert.isDefined(createPlatformEvent)

                firstPlatformAddress = createPlatformEvent.args.platform
                assert.isTrue(await Setup.platformsManager.isPlatformAttached.call(firstPlatformAddress))
            })

            it("should be able to create the second platform on request with OK code", async () => {
                assert.equal((await Setup.platformsManager.createPlatform.call({ from: owner })).toNumber(), ErrorsEnum.OK)
            })

            it("should be able to create platform on request", async () => {
                let createPlatformTx = await Setup.platformsManager.createPlatform({ from: owner })
                let createPlatformEvent = (await eventsHelper.findEvent([Setup.platformsManager,], createPlatformTx, "PlatformRequested"))[0]
                assert.isDefined(createPlatformEvent)

                secondPlatformAddress = createPlatformEvent.args.platform
                assert.isTrue(await Setup.platformsManager.isPlatformAttached.call(secondPlatformAddress))
            })

            it("should have different addresses for created platforms", async () => {
                assert.notEqual(firstPlatformAddress, secondPlatformAddress)
            })

            it("should have 2 more platforms in platformsManager", async () => {
                assert.equal(await Setup.platformsManager.getPlatformsCount.call(), beforePlatformsCount + 2)
            })
        })
    })

    context("attach platform", function () {
        let owner = owner1
        var platform

        before(async () => {
            platform = await createPlatform(owner)
        })

        after(async () => {
            await reverter.promisifyRevert()
        })

        it("when owner is not CBE", async () => {
            assert.isFalse(await Setup.userManager.getCBE.call(owner))
        })

        it("should be able to attach a platform that is not registered by anyone with MULTISIG_ADDED code", async () => {
            assert.equal((await Setup.platformsManager.attachPlatform.call(platform.address, { from: systemOwner, })).toNumber(), ErrorsEnum.MULTISIG_ADDED)
        })

        it("should be able to attach a platform that is not registered by anyone", async () => {
            const tx = await Setup.platformsManager.attachPlatform(platform.address, { from: owner })
            const attachEvent = (await eventsHelper.findEvent([Setup.shareable,], tx, "AddMultisigTx"))[0]
            assert.isDefined(attachEvent)
            
            await Setup.shareable.confirm(attachEvent.args.hash)

            assert.isTrue(await Setup.platformsManager.isPlatformAttached.call(platform.address))
        })

        it("should not be able to attach a platform that is already attached", async () => {            
            assert.equal((await Setup.platformsManager.attachPlatform.call(platform.address, { from: owner })).toNumber(), ErrorsEnum.PLATFORMS_ATTACHING_PLATFORM_ALREADY_EXISTS)
        })
    })

    context("detach platform", function () {
        let owner = owner1
        let nonOwner = owner2
        let platform

        before(async () => {
            platform = await createPlatform(owner)
        })

        after(async () => {
            await reverter.promisifyRevert()
        })

        it("should not be able to detach a platform that is not registered with PLATFORMS_PLATFORM_DOES_NOT_EXIST code", async () => {
            assert.equal((await Setup.platformsManager.detachPlatform.call(platform.address, { from: owner })).toNumber(), ErrorsEnum.PLATFORMS_PLATFORM_DOES_NOT_EXIST)
        })

        it("should be able to attach created platform", async () => {
            const tx = await Setup.platformsManager.attachPlatform(platform.address, { from: owner })
            const attachEvent = (await eventsHelper.findEvent([Setup.shareable,], tx, "AddMultisigTx"))[0]
            assert.isDefined(attachEvent)

            await Setup.shareable.confirm(attachEvent.args.hash)

            assert.isTrue(await Setup.platformsManager.isPlatformAttached.call(platform.address))
        })

        it("should not be able to detach a platform by a non-owner user with UNAUTHORIZED code", async () => {
            assert.equal((await Setup.platformsManager.detachPlatform.call(platform.address, { from: nonOwner })).toNumber(), ErrorsEnum.UNAUTHORIZED)
        })

        it("should not be able to detach a platform by a non-owner user", async () => {
            await Setup.platformsManager.detachPlatform(platform.address, { from: nonOwner })
            assert.isTrue(await Setup.platformsManager.isPlatformAttached.call(platform.address))
        })

        it("should be able to detach a platform that is registered by an owner of the platform with OK code", async () => {
            assert.equal((await Setup.platformsManager.detachPlatform.call(platform.address, { from: owner })).toNumber(), ErrorsEnum.OK)
        })

        it("should be able to detach a platform that is registered by an owner of the platform", async () => {
            let successDetachTx = await Setup.platformsManager.detachPlatform(platform.address, { from: owner })
            let event = (await eventsHelper.findEvent([Setup.platformsManager,], successDetachTx, "PlatformDetached"))[0]
            assert.isDefined(event)
            assert.equal(platform.address, event.args.platform)
            assert.isFalse(await Setup.platformsManager.isPlatformAttached.call(platform.address))
        })
    })

    context("properties check", function () {
        let owner = owner1
        let nonOwner = owner2
        let platform

        before(async () => {
            platform = await createPlatform(owner)
            let tx = await Setup.platformsManager.attachPlatform(platform.address, { from: owner })
            const attachEvent = (await eventsHelper.findEvent([Setup.shareable,], tx, "AddMultisigTx"))[0]
            assert.isDefined(attachEvent)

            await Setup.shareable.confirm(attachEvent.args.hash)

            await reverter.promisifySnapshot()
        })

        after(async () => {
            await reverter.promisifyRevert(reverter.snapshotId - 1)
        })

        it("should return the same platform for a user who is owning a platform", async () => {
            let gotPlatformAddresses = await getAllPlatformsForUser(owner)
            assert.include(gotPlatformAddresses, platform.address)
        })

        it("should return no platform for non platform owner", async () => {
            let noPlatformAddresses = await getAllPlatformsForUser(nonOwner)
            assert.lengthOf(noPlatformAddresses, 0)
        })
    })

    context("platform's events", function () {
        let owner = accounts[7]
        let platform
        let tokenExtension
        let tokenSymbol = "_TEST"
        let totalTokensBalance = 1000
        
        before(async () => {
            let createPlatformTx = await Setup.platformsManager.createPlatform({ from: owner })
            let event = eventsHelper.extractEvents(createPlatformTx, "PlatformRequested")[0]
            assert.isDefined(event)

            platform = await ChronoBankPlatform.at(event.args.platform)
            tokenExtension = await TokenManagementInterface.at(event.args.tokenExtension)

            await reverter.promisifySnapshot()
        })

        after(async () => {
            await reverter.promisifyRevert(reverter.snapshotId - 1)
        })

        it('creating asset should spawn events from a platform', async () => {
            let issueAssetTx = await platform.issueAsset(tokenSymbol, totalTokensBalance, "test token", "some description", 2, true, owner, { from: owner })
            let issueEvent = eventsHelper.extractEvents(issueAssetTx, "Issue")[0]
            assert.isDefined(issueEvent)
            assert.equal(totalTokensBalance, issueEvent.args.value.toNumber())
        })

        it('reissue asset should spawn events from a platform', async () => {
            let reissueValue = 333
            let reissueAssetTx = await platform.reissueAsset(tokenSymbol, reissueValue, { from: owner })
            let reissueEvent = eventsHelper.extractEvents(reissueAssetTx, "Issue")[0]
            assert.isDefined(reissueEvent)
            assert.equal(reissueValue, reissueEvent.args.value.toNumber())
        })

        it('revoke asset should spawn events from a platform', async () => {
            let revokeValue = 333
            let revokeAssetTx = await platform.revokeAsset(tokenSymbol, revokeValue, { from: owner })
            let revokeEvent = eventsHelper.extractEvents(revokeAssetTx, "Revoke")[0]
            assert.isDefined(revokeEvent)
            assert.equal(revokeValue, revokeEvent.args.value.toNumber())
        })
    })

    context("migration from deprecated PlatformsManager with statistics to cleaned up PlatformsManager contract", () => {
        let oldPlatformsManager
        let owner = accounts[6]
        let createdPlatforms = []

        after(async () => {
            await reverter.promisifyRevert()
        })

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
    })
})
