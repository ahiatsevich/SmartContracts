const Rewards = artifacts.require("Rewards")
const RewardsWallet = artifacts.require("RewardsWallet")
const ContractsManager = artifacts.require("ContractsManager")
const PendingManager = artifacts.require("PendingManager")
const TimeHolder = artifacts.require("TimeHolder")
const TimeHolderDeprecated = artifacts.require("TimeHolderDeprecated")
const ERC20DepositStorage = artifacts.require("ERC20DepositStorage")
const TimeHolderWallet = artifacts.require("TimeHolderWallet")
const TimeHolderDammyWallet = artifacts.require("TimeHolderDammyWallet")
const LOCManager = artifacts.require("LOCManager")
const LOCWallet = artifacts.require("LOCWallet")
const FakeCoin = artifacts.require("FakeCoin")
const FakeCoin2 = artifacts.require("FakeCoin2")
const FakeCoin3 = artifacts.require("FakeCoin3")
const UserManager = artifacts.require("UserManager")
const Roles2Library = artifacts.require("Roles2Library")
const AssetsManagerMock = artifacts.require("AssetsManagerMock")
const MultiEventsHistory = artifacts.require("MultiEventsHistory")
const Storage = artifacts.require("Storage")
const ERC20Manager = artifacts.require("ERC20Manager")
const ManagerMock = artifacts.require("ManagerMock")
const Stub = artifacts.require("Stub")

const Reverter = require("./helpers/reverter")
const bytes32 = require("./helpers/bytes32")
const eventsHelper = require("./helpers/eventsHelper")
const utils = require("./helpers/utils")
const ErrorsEnum = require("../common/errors")

function bindConfirmMultisig(pendingMananger) {
    return async (tx, cbes) => {
        let confirmationHash

        if (tx.receipt === undefined) {
            confirmationHash = tx
        }
        else {
            const doneEvent = (await eventsHelper.findEvent([pendingMananger,], tx, "Done"))[0]
            if (doneEvent !== undefined) {
                return [ true, tx, ]
            }
        
            const addTxEvent = (await eventsHelper.findEvent([pendingMananger,], tx, "AddMultisigTx"))[0]
            const confirmEvent = (await eventsHelper.findEvent([pendingMananger,], tx, "Confirmation"))[0]
        
            if (addTxEvent !== undefined) {
                confirmationHash = addTxEvent.args.hash
            }
            else if (confirmEvent !== undefined) {
                confirmationHash = confirmEvent.args.hash
            }
            else {
                return [ false, tx, ]
            }
        }

        var lastTx
        for (var cbe of cbes) {
            lastTx = await pendingMananger.confirm(confirmationHash, { from: cbe, })
            // console.log(`### cbe (${cbe}) confirms: ${JSON.stringify(lastTx, null, 4)}`)
            const doneEvent = (await eventsHelper.findEvent([pendingMananger,], lastTx, "Done"))[0]
            
            // console.log(`### cbe (${cbe}) doneEvent: ${JSON.stringify(doneEvent, null, 4)}`)
            if (doneEvent !== undefined) {
                return [ true, lastTx, ]
            }
        }

        console.log(`### "Done" not found`)
        
        return [ false, lastTx || tx, ]  
    }
}


contract('New version of TimeHolder', (accounts) => {
    const systemUser = accounts[0]
    const rootUser = systemUser
    const middlewareAuthorityAddress = accounts[5]
    const users = {
        user1: accounts[1],
        user2: accounts[2],
        user3: accounts[3],
    }

    let reverter = new Reverter(web3)

    let contractsManager
    let pendingManager
    let reward
    let rewardsWallet
    let timeHolder
    let erc20DepositStorage
    let timeHolderDeprecated
    let timeHolderWallet
    let storage
    let userManager
    let rolesLibrary
    let multiEventsHistory
    let assetsManager
    let chronoMint
    let chronoMintWallet
    let erc20Manager
    let shares
    let asset1
    let asset2
    let timeHolderDammyWallet
    let helperContract

    const fakeArgs = [0,0,0,0,0,0,0,0]
    const ZERO_INTERVAL = 0
    const SHARES_BALANCE = 100000000
    const CHRONOBANK_PLATFORM_ID = 1
    const STUB_PLATFORM_ADDRESS = 0x0
    let confirmMultisig

    const roles = {
		middlewareAuthority: 9,
	}

    before('Setup', async() => {
        storage = await Storage.new()
        rewardsWallet = await RewardsWallet.new(storage.address, "RewardsWallet")
        reward = await Rewards.new(storage.address, "Deposits")
        assetsManager = await AssetsManagerMock.deployed()
        chronoMintWallet = await LOCWallet.new(storage.address, "LOCWallet")
        chronoMint = await  LOCManager.new(storage.address, "LOCManager")
        timeHolderWallet = await TimeHolderWallet.new(storage.address, "TimeHolderWallet")
        timeHolderDammyWallet = await TimeHolderDammyWallet.new()
        timeHolder = await TimeHolder.new(storage.address, "Deposits")
        erc20DepositStorage = await ERC20DepositStorage.new(storage.address, "Deposits")
        timeHolderDeprecated = await TimeHolderDeprecated.new(storage.address, "Deposits")
        contractsManager = await ContractsManager.new(storage.address, "ContractsManager")
        pendingManager = await PendingManager.new(storage.address, "PendingManager")
        userManager = await UserManager.new(storage.address, "UserManager")
        rolesLibrary = await Roles2Library.new(storage.address, "Roles2Library")
        multiEventsHistory = await MultiEventsHistory.deployed()
        erc20Manager = await ERC20Manager.new(storage.address, "ERC20Manager")
        shares = await FakeCoin.deployed()
        asset1 = await FakeCoin2.deployed()
        asset2 = await FakeCoin3.deployed()
        helperContract = await Stub.deployed()

        await shares.mint(systemUser, SHARES_BALANCE)
        await shares.mint(users.user1, SHARES_BALANCE)
        await shares.mint(users.user2, SHARES_BALANCE)

        await asset1.mint(systemUser, SHARES_BALANCE)
        await asset1.mint(users.user1, SHARES_BALANCE)

        await asset2.mint(systemUser, SHARES_BALANCE)
        await asset2.mint(users.user1, SHARES_BALANCE)

        await storage.setManager(ManagerMock.address)
        await contractsManager.addContract(multiEventsHistory.address, "MultiEventsHistory")
        await erc20Manager.init(contractsManager.address)
        {
            await erc20Manager.addToken(shares.address, "", await shares.symbol.call(), await shares.decimals.call(), "", 0x0, 0x0)
            await erc20Manager.addToken(asset1.address, "", await asset1.symbol.call(), await asset1.decimals.call(), "", 0x0, 0x0)
            await erc20Manager.addToken(asset2.address, "", await asset2.symbol.call(), await asset2.decimals.call(), "", 0x0, 0x0)
        }
        await assetsManager.init(contractsManager.address)
        await rewardsWallet.init(contractsManager.address)
        await reward.init(contractsManager.address, rewardsWallet.address, STUB_PLATFORM_ADDRESS, ZERO_INTERVAL)
        await chronoMintWallet.init(contractsManager.address)
        await chronoMint.init(contractsManager.address, chronoMintWallet.address)
        await userManager.init(contractsManager.address)
        await rolesLibrary.init(contractsManager.address)
        {
            await rolesLibrary.setRootUser(rootUser, true, { from: systemUser, })
            await rolesLibrary.addUserRole(middlewareAuthorityAddress, roles.middlewareAuthority, { from: rootUser, })
            {
                const signature = timeHolder.contract.registerUnlockShares.getData("", 0x0, 0, 0x0, "").slice(0, 10)
                await rolesLibrary.addRoleCapability(roles.middlewareAuthority, timeHolder.address, signature, { from: rootUser, })
            }
            {
                const signature = timeHolder.contract.unregisterUnlockShares.getData("").slice(0, 10)
                await rolesLibrary.addRoleCapability(roles.middlewareAuthority, timeHolder.address, signature, { from: rootUser, })
            }
        }
        await timeHolderWallet.init(contractsManager.address)
        await erc20DepositStorage.init(contractsManager.address)
        await timeHolderDeprecated.init(contractsManager.address, shares.address, timeHolderDammyWallet.address, accounts[0])
        await timeHolder.init(contractsManager.address, shares.address, timeHolderDammyWallet.address, accounts[0], erc20DepositStorage.address)
        await pendingManager.init(contractsManager.address)
        await assetsManager.addAsset(asset1.address, 'LHT', chronoMintWallet.address)
        await multiEventsHistory.authorize(reward.address)
        await multiEventsHistory.authorize(rolesLibrary.address)
        await multiEventsHistory.authorize(timeHolder.address)
        await multiEventsHistory.authorize(pendingManager.address)

        confirmMultisig = bindConfirmMultisig(pendingManager)

        await reverter.promisifySnapshot()
    })

    context("deposit", function () {

        afterEach('revert', reverter.revert)

        it('should take into account deposits already made', async () => {
            const DEPOSIT_AMOUNT = 200

            assert.equal(await timeHolderDeprecated.deposit.call(DEPOSIT_AMOUNT), ErrorsEnum.OK)
            await timeHolderDeprecated.deposit(DEPOSIT_AMOUNT)

            assert.equal(await timeHolderDeprecated.depositBalance(accounts[0]), DEPOSIT_AMOUNT)

            assert.equal(await timeHolder.getDepositBalance(shares.address, accounts[0]), DEPOSIT_AMOUNT)
        })

        it('should correct handle default shares', async () => {
            const DEPOSIT_AMOUNT = 200

            assert.equal(await timeHolder.deposit.call(shares.address, DEPOSIT_AMOUNT), ErrorsEnum.OK)
            await timeHolder.deposit(shares.address, DEPOSIT_AMOUNT)

            assert.equal(await timeHolder.getDepositBalance(shares.address, accounts[0]), DEPOSIT_AMOUNT)

            assert.equal(await timeHolderDeprecated.depositBalance(accounts[0]), DEPOSIT_AMOUNT)
        })

        it('shouldn\'t allow blaklisted assest', async () => {
            const DEPOSIT_AMOUNT1 = 200
            const DEPOSIT_AMOUNT2 = 201

            assert.equal(await timeHolder.getDepositBalance(asset1.address, accounts[0]), 0)
            assert.equal(await timeHolder.getDepositBalance(asset2.address, accounts[0]), 0)

            assert.equal(await timeHolder.deposit.call(asset1.address, DEPOSIT_AMOUNT1), ErrorsEnum.TIMEHOLDER_ONLY_REGISTERED_SHARES)
            assert.equal(await timeHolder.deposit.call(asset2.address, DEPOSIT_AMOUNT2), ErrorsEnum.TIMEHOLDER_ONLY_REGISTERED_SHARES)

            await timeHolder.deposit(asset1.address, DEPOSIT_AMOUNT1)
            await timeHolder.deposit(asset2.address, DEPOSIT_AMOUNT2)

            assert.equal(await timeHolder.getDepositBalance(asset1.address, accounts[0]), 0)
            assert.equal(await timeHolder.getDepositBalance(asset2.address, accounts[0]), 0)
        })

        it('should permit whitelisted assests', async () => {
            const DEPOSIT_AMOUNT1 = 200
            const DEPOSIT_AMOUNT2 = 201

            await timeHolder.allowShares([asset1.address, asset2.address], [SHARES_BALANCE, SHARES_BALANCE])

            assert.equal(await timeHolder.getDepositBalance(asset1.address, accounts[0]), 0)
            assert.equal(await timeHolder.getDepositBalance(asset2.address, accounts[0]), 0)

            assert.equal(await timeHolder.deposit.call(asset1.address, DEPOSIT_AMOUNT1), ErrorsEnum.OK)
            assert.equal(await timeHolder.deposit.call(asset2.address, DEPOSIT_AMOUNT2), ErrorsEnum.OK)

            await timeHolder.deposit(asset1.address, DEPOSIT_AMOUNT1)
            await timeHolder.deposit(asset2.address, DEPOSIT_AMOUNT2)

            assert.equal(await timeHolder.getDepositBalance(asset1.address, accounts[0]), DEPOSIT_AMOUNT1)
            assert.equal(await timeHolder.getDepositBalance(asset2.address, accounts[0]), DEPOSIT_AMOUNT2)

            await timeHolder.denyShares([asset1.address, asset2.address])

            assert.equal(await timeHolder.deposit.call(asset1.address, DEPOSIT_AMOUNT1), ErrorsEnum.TIMEHOLDER_ONLY_REGISTERED_SHARES)
            assert.equal(await timeHolder.deposit.call(asset2.address, DEPOSIT_AMOUNT2), ErrorsEnum.TIMEHOLDER_ONLY_REGISTERED_SHARES)
        })
    })

    context("withdraw", function () {

        afterEach('revert', reverter.revert)

        it('should take into account deposits already made', async () => {
            const DEPOSIT_AMOUNT = 200

            const initialBalance = await shares.balanceOf(accounts[0])

            assert.equal(await timeHolderDeprecated.deposit.call(DEPOSIT_AMOUNT), ErrorsEnum.OK)
            await timeHolderDeprecated.deposit(DEPOSIT_AMOUNT)

            assert.equal(await shares.balanceOf(accounts[0]), initialBalance - DEPOSIT_AMOUNT)

            assert.equal(await timeHolderDeprecated.depositBalance(accounts[0]), DEPOSIT_AMOUNT)
            assert.equal(await timeHolder.getDepositBalance(shares.address, accounts[0]), DEPOSIT_AMOUNT)
            assert.equal(await shares.balanceOf(await timeHolder.wallet()), DEPOSIT_AMOUNT)

            await timeHolder.withdrawShares(shares.address, DEPOSIT_AMOUNT)

            assert.equal(await timeHolder.getDepositBalance(shares.address, accounts[0]), 0)

            assert.equal(initialBalance.cmp(await shares.balanceOf(accounts[0])), 0)
        })

        it('shouls allow to withdraw nondefault assets', async () => {
            const DEPOSIT_AMOUNT1 = 200
            const DEPOSIT_AMOUNT2 = 201

            const initialBalance1 = await asset1.balanceOf(accounts[0])
            const initialBalance2 = await asset2.balanceOf(accounts[0])

            await timeHolder.allowShares([asset1.address, asset2.address], [SHARES_BALANCE, SHARES_BALANCE])

            assert.equal(await timeHolder.getDepositBalance(asset1.address, accounts[0]), 0)
            assert.equal(await timeHolder.getDepositBalance(asset2.address, accounts[0]), 0)

            assert.equal(await timeHolder.deposit.call(asset1.address, DEPOSIT_AMOUNT1), ErrorsEnum.OK)
            assert.equal(await timeHolder.deposit.call(asset2.address, DEPOSIT_AMOUNT2), ErrorsEnum.OK)

            await timeHolder.deposit(asset1.address, DEPOSIT_AMOUNT1)
            await timeHolder.deposit(asset2.address, DEPOSIT_AMOUNT2)

            assert.equal(await timeHolder.getDepositBalance(asset1.address, accounts[0]), DEPOSIT_AMOUNT1)
            assert.equal(await timeHolder.getDepositBalance(asset2.address, accounts[0]), DEPOSIT_AMOUNT2)

            await timeHolder.withdrawShares(asset1.address, DEPOSIT_AMOUNT1)
            await timeHolder.withdrawShares(asset2.address, DEPOSIT_AMOUNT2)

            assert.equal(await timeHolder.getDepositBalance(asset1.address, accounts[0]), 0)
            assert.equal(await timeHolder.getDepositBalance(asset1.address, accounts[0]), 0)

            assert.equal(initialBalance1.cmp(await asset1.balanceOf(accounts[0])), 0)
            assert.equal(initialBalance2.cmp(await asset2.balanceOf(accounts[0])), 0)
        })

        it('should have right deposit balance after several deposits and single withdrawal', async () => {
            let user = accounts[0]
            const DEPOSIT_AMOUNT = 100
            let initialBalance = await timeHolder.getDepositBalance.call(shares.address, user)
            let initialAccountBalance = await shares.balanceOf(user)

            await timeHolder.deposit(shares.address, DEPOSIT_AMOUNT, { from: user })
            await timeHolder.deposit(shares.address, DEPOSIT_AMOUNT, { from: user })

            let accountBalanceAfterDeposit = await shares.balanceOf.call(user)
            assert.equal(accountBalanceAfterDeposit.toNumber(), initialAccountBalance.toNumber() - DEPOSIT_AMOUNT * 2)

            let balanceAfterDeposit = await timeHolder.getDepositBalance.call(shares.address, user)
            assert.equal(balanceAfterDeposit.toNumber(), DEPOSIT_AMOUNT * 2)

            await timeHolder.withdrawShares(shares.address, DEPOSIT_AMOUNT, { from: user })

            let accountBalanceAfterWithdrawal = await shares.balanceOf.call(user)
            assert.equal(accountBalanceAfterWithdrawal.toNumber(), accountBalanceAfterDeposit.toNumber() + DEPOSIT_AMOUNT)

            let balanceAfterWithdrawal = await timeHolder.getDepositBalance.call(shares.address, user)
            assert.equal(balanceAfterWithdrawal.toNumber(), balanceAfterDeposit.toNumber() - DEPOSIT_AMOUNT)
        })

        it('should allow to withdraw deposits in case of emergency for contract owner', async () => {
            const DEPOSIT_AMOUNT = 200
            let user = accounts[1]
            let owner = accounts[0]

            await timeHolder.deposit(shares.address, DEPOSIT_AMOUNT, {from: user})
            assert.equal(await timeHolder.depositBalance(user), DEPOSIT_AMOUNT)

            let walletBalance = await shares.balanceOf(await timeHolder.wallet())
            let ownerBalance = await shares.balanceOf(owner)

            assert.equal(await timeHolder.forceWithdrawShares.call(user, shares.address, DEPOSIT_AMOUNT), ErrorsEnum.OK)
            await timeHolder.forceWithdrawShares(user, shares.address, DEPOSIT_AMOUNT)

            assert.equal(await shares.balanceOf(await timeHolder.wallet()), walletBalance - DEPOSIT_AMOUNT)
            assert.equal(await timeHolder.depositBalance(user), 0)
            assert.equal(ownerBalance.add(DEPOSIT_AMOUNT).cmp(await shares.balanceOf(owner)), 0)
        })

        it('shouldn\'t allow to withdraw deposits in case of emergency for non-owner', async () => {
            const DEPOSIT_AMOUNT = 200
            let user = accounts[1]

            await timeHolder.deposit(shares.address, DEPOSIT_AMOUNT, {from: user})
            assert.equal(await timeHolder.depositBalance(user), DEPOSIT_AMOUNT)
            let walletBalance = await shares.balanceOf(await timeHolder.wallet())

            assert.equal(await timeHolder.forceWithdrawShares.call(user, shares.address, DEPOSIT_AMOUNT, {from: accounts[2]}), ErrorsEnum.UNAUTHORIZED)
            await timeHolder.forceWithdrawShares(user, shares.address, DEPOSIT_AMOUNT, {from: accounts[2]})

            assert.equal(await timeHolder.depositBalance(user), DEPOSIT_AMOUNT)
            assert.equal(walletBalance.cmp(await shares.balanceOf(await timeHolder.wallet())), 0)
        })
    })

    context("lock/unlock", () => {
        const DEPOSIT_AMOUNT = 1000
        const LOCK_AMOUNT = 700
        const user1 = users.user1
        const user2 = users.user2

        let userDeposit

        let revertedSnapshotId
        
        before("prepare", async () => {
            await timeHolder.deposit(shares.address, DEPOSIT_AMOUNT, { from: user1, })
            await timeHolder.deposit(shares.address, DEPOSIT_AMOUNT, { from: user2, })

            userDeposit = (await timeHolder.getDepositBalance.call(shares.address, user1)).toNumber()

            assert.isAtMost((await userManager.required.call()).toNumber(), 1);
            assert.isTrue(await userManager.getCBE.call(systemUser))

            revertedSnapshotId = reverter.snapshotId
            await reverter.promisifySnapshot()
        })

        after("revert", async () => {
            await reverter.promisifyRevert(revertedSnapshotId)
        })

        describe("lock", () => {

            it("shouldn't be allowed to lock not registered share token with TIMEHOLDER_ONLY_REGISTERED_SHARES code", async () => {
                assert.equal((await timeHolder.lock.call(asset1.address, LOCK_AMOUNT, { from: user1, })).toNumber(), ErrorsEnum.TIMEHOLDER_ONLY_REGISTERED_SHARES)
            })

            it("shouldn't be allowed to lock not registered share token", async () => {
                const tx = await timeHolder.lock(asset1.address, LOCK_AMOUNT, { from: user1, })
                const event = (await eventsHelper.findEvent([timeHolder,], tx, "Lock"))[0]
                assert.isUndefined(event)
            })

            it("deposited balance should not change", async () => {
                assert.equal((await timeHolder.getDepositBalance.call(shares.address, user1)).toNumber(), userDeposit)
            })

            it("shouldn't be able to lock more than deposited with TIMEHOLDER_LOCK_LIMIT_EXCEEDED code", async () => {
                assert.equal((await timeHolder.lock.call(shares.address, userDeposit + 1, { from: user1, })).toNumber(), ErrorsEnum.TIMEHOLDER_LOCK_LIMIT_EXCEEDED)
            })

            it("shouldn't be able to lock more than deposited", async () => {
                const tx = await timeHolder.lock(shares.address, userDeposit + 1, { from: user1, })
                const event = (await eventsHelper.findEvent([timeHolder,], tx, "Lock"))[0]
                assert.isUndefined(event)
            })

            it("deposited balance should not change", async () => {
                assert.equal((await timeHolder.getDepositBalance.call(shares.address, user1)).toNumber(), userDeposit)
            })

            it("should be able to lock less than deposited with OK code", async () => {
                assert.equal((await timeHolder.lock.call(shares.address, LOCK_AMOUNT, { from: user1, })).toNumber(), ErrorsEnum.OK)
            })

            it("should be able to lock less than deposited", async () => {
                const tx = await timeHolder.lock(shares.address, LOCK_AMOUNT, { from: user1, })
                const event = (await eventsHelper.findEvent([timeHolder,], tx, "Lock"))[0]
                assert.isDefined(event)
                assert.equal(event.args.token, shares.address)
                assert.equal(event.args.who, user1)
                assert.equal(event.args.amount, LOCK_AMOUNT)
            })

            it("locked balance should be equal to passed lock amount", async () => {
                assert.equal((await timeHolder.getLockedBalance.call(shares.address)).toNumber(), LOCK_AMOUNT)
            })

            it("deposited balance should decrease after a lock", async () => {
                assert.equal((await timeHolder.getDepositBalance.call(shares.address, user1)).toNumber(), userDeposit - LOCK_AMOUNT)
            })

            it("shouldn't be able to lock more than deposited amount with TIMEHOLDER_LOCK_LIMIT_EXCEEDED code", async () => {
                const availableToLockAmount = userDeposit - LOCK_AMOUNT
                assert.equal((await timeHolder.lock.call(shares.address, availableToLockAmount + 1, { from: user1, })).toNumber(), ErrorsEnum.TIMEHOLDER_LOCK_LIMIT_EXCEEDED)
            })

            it("shouldn't be able to lock more than deposited amount", async () => {
                const availableToLockAmount = userDeposit - LOCK_AMOUNT
                const tx = await timeHolder.lock(shares.address, availableToLockAmount + 1, { from: user1, })
                const event = (await eventsHelper.findEvent([timeHolder,], tx, "Lock"))[0]
                assert.isUndefined(event)
            })
            
            it("shouldn't be allowed to withdraw shares more than available (after 'deposited - locked') with TIMEHOLDER_INSUFFICIENT_BALANCE code", async () => {
                const availableToWithdrawAmount = userDeposit - LOCK_AMOUNT
                assert.equal((await timeHolder.withdrawShares.call(shares.address, availableToWithdrawAmount + 1, { from: user1, })).toNumber(), ErrorsEnum.TIMEHOLDER_INSUFFICIENT_BALANCE)
            })
            
            it("should be allowed to withdraw an amount less than deposited with OK code", async () => {
                const availableToWithdrawAmount = userDeposit - LOCK_AMOUNT
                assert.equal((await timeHolder.withdrawShares.call(shares.address, availableToWithdrawAmount - 1, { from: user1, })).toNumber(), ErrorsEnum.OK)  
            })

            it("should be able to lock the rest of deposited amount with OK code", async () => {
                const availableToLockAmount = userDeposit - LOCK_AMOUNT
                assert.equal((await timeHolder.lock.call(shares.address, availableToLockAmount, { from: user1, })).toNumber(), ErrorsEnum.OK)
            })
            
            it("should be able to lock the rest of deposited amount", async () => {
                const availableToLockAmount = userDeposit - LOCK_AMOUNT
                const tx = await timeHolder.lock(shares.address, availableToLockAmount, { from: user1, })
                const event = (await eventsHelper.findEvent([timeHolder,], tx, "Lock"))[0]
                assert.isDefined(event)
                assert.equal(event.args.token, shares.address)
                assert.equal(event.args.who, user1)
                assert.equal(event.args.amount, availableToLockAmount)
            })

            it("should show deposited == 0", async () => {
                assert.equal((await timeHolder.getDepositBalance.call(shares.address, user1)).toNumber(), 0)
            })

            it("locked balance should be equal to originally deposited", async () => {
                assert.equal((await timeHolder.getLockedBalance.call(shares.address)).toNumber(), userDeposit)
            })
        })

        describe("unlock", () => {
            const secret = "do not tell anyone"
            const wrongSecret = "tell anyone"
            let secretLock
            const registrationId = "0xfefefefe"
            const notExistedRegistrationId = "0x001001001"
            let lockedAmount

            before(async () => {
                assert.notEqual(secret, wrongSecret)

                lockedAmount = (await timeHolder.getLockedBalance.call(shares.address)).toNumber()
                secretLock = await helperContract.getHash.call(secret)
            })

            // after(reverter.revert)

            it(`shouldn't have any registered unlocks with "${registrationId}" registration ID`, async () => {
                const [ unlockToken, unlockAmount, unlockHolder, ] = await timeHolder.checkUnlockedShares.call(registrationId, { from: systemUser, })
                assert.equal(unlockToken, 0x0)
                assert.equal(unlockAmount, 0)
                assert.equal(unlockHolder, 0x0)
            })
            
            it("shouldn't be able to unlock without certain registrationID with TIMEHOLDER_NO_REGISTERED_UNLOCK_FOUND code", async () => {
                assert.equal((await timeHolder.unlockShares.call(registrationId, secret)).toNumber(), ErrorsEnum.TIMEHOLDER_NO_REGISTERED_UNLOCK_FOUND)
            })
            
            it("shouldn't be able to unlock without certain registrationID", async () => {
                const tx = await timeHolder.unlockShares(registrationId, secret)
                const event = (await eventsHelper.findEvent([timeHolder,], tx, "UnlockShares"))[0]
                assert.isUndefined(event)
            })

            it("shouldn't allow to register unlock by non-middleware role address with UNAUTHORIZED code", async () => {
                assert.equal((await timeHolder.registerUnlockShares.call(
                    registrationId, 
                    shares.address, 
                    lockedAmount, 
                    user1, 
                    secretLock, 
                    { from: user1, }
                )).toNumber(), ErrorsEnum.UNAUTHORIZED)
            })

            it("shouldn't allow to register unlock to non-middleware role address", async () => {
                const tx = await timeHolder.registerUnlockShares(
                    registrationId, 
                    shares.address, 
                    lockedAmount, 
                    user1, 
                    secretLock, 
                    { from: user1, }
                )
                {
                    const event = (await eventsHelper.findEvent([timeHolder,], tx, "RegisterUnlockShares"))[0]
                    assert.isUndefined(event)
                }
                {
                    const event = (await eventsHelper.findEvent([timeHolder,], tx, "RoleAuthorizationFailed"))[0]
                    assert.isDefined(event)
                }
            })

            it("shouldn't allow to register unlock for more tokens then were locked with TIMEHOLDER_UNLOCK_LIMIT_EXCEEDED code", async () => {
                const multisigTx = await timeHolder.registerUnlockShares(
                    registrationId, 
                    shares.address, 
                    lockedAmount + 1, 
                    user1, 
                    secretLock, 
                    { from: middlewareAuthorityAddress, }
                )
                const [ success, tx, ] = await confirmMultisig(multisigTx, [systemUser,])
                assert.isTrue(success, "have no multisig in tx")
                
                {
                    const event = (await eventsHelper.findEvent([timeHolder,pendingManager,], tx, "RegisterUnlockShares"))[0]
                    assert.isUndefined(event)
                }
                {
                    const event = (await eventsHelper.findEvent([timeHolder,pendingManager,], tx, "Error"))[0]
                    assert.isDefined(event)
                    assert.equal(event.args.errorCode, ErrorsEnum.TIMEHOLDER_UNLOCK_LIMIT_EXCEEDED)
                }
            })

            it("should THROW and doesn't allow to register unlock for 0 amount of tokens", async () => {
                try {
                    await timeHolder.registerUnlockShares.call(
                        registrationId, 
                        shares.address, 
                        0, 
                        user1, 
                        secretLock, 
                        { from: middlewareAuthorityAddress, }
                    )
                    assert(false)
                }
                catch (e) {
                    utils.ensureException(e)
                }
            })

            let partedLockAmount

            it("should be able to register unlock for some amount of locked tokens with MULTISIG_ADDED code", async () => {
                partedLockAmount = Math.floor(lockedAmount / 3)
                assert.equal((await timeHolder.registerUnlockShares.call(
                    registrationId, 
                    shares.address, 
                    partedLockAmount, 
                    user1, 
                    secretLock, 
                    { from: middlewareAuthorityAddress, }
                )).toNumber(), ErrorsEnum.MULTISIG_ADDED)
            })

            it("should be able to register unlock for some amount of locked tokens", async () => {
                partedLockAmount = Math.floor(lockedAmount / 3)
                const multisigTx = await timeHolder.registerUnlockShares(
                    registrationId, 
                    shares.address, 
                    partedLockAmount, 
                    user1, 
                    secretLock, 
                    { from: middlewareAuthorityAddress, }
                )
                const [ success, tx, ] = await confirmMultisig(multisigTx, [systemUser,])
                assert.isTrue(success, "have no multisig in tx")
                {
                    const event = (await eventsHelper.findEvent([timeHolder,], tx, "RegisterUnlockShares"))[0]
                    assert.isDefined(event)
                    assert.equal(event.args.registrationId, await helperContract.toBytes32(registrationId))
                    assert.equal(event.args.token, shares.address)
                    assert.equal(event.args.amount, partedLockAmount)
                    assert.equal(event.args.holder, user1)
                }
                {
                    const event = (await eventsHelper.findEvent([timeHolder,], tx, "RoleAuthorizationFailed"))[0]
                    assert.isUndefined(event)
                }
            })

            it("should be able to get info about registered unlock", async () => {
                const [ unlockToken, unlockAmount, unlockHolder, ] = await timeHolder.checkUnlockedShares.call(registrationId, { from: user1, })
                assert.equal(unlockToken, shares.address)
                assert.equal(unlockAmount, partedLockAmount)
                assert.equal(unlockHolder, user1)
            })

            it("deposited balance should not change and be equal 0", async () => {
                assert.equal((await timeHolder.getDepositBalance.call(shares.address, user1)).toNumber(), 0)
            })

            it("shouldn't be able to register unlock for an existed registrationID with TIMEHOLDER_REGISTRATION_ID_EXISTS code", async () => {
                const availableLockAmount = lockedAmount - partedLockAmount
                assert.equal((await timeHolder.registerUnlockShares.call(
                    registrationId, 
                    shares.address, 
                    availableLockAmount, 
                    user1, 
                    secretLock, 
                    { from: middlewareAuthorityAddress, }
                )).toNumber(), ErrorsEnum.TIMEHOLDER_REGISTRATION_ID_EXISTS)
            })

            it("shouldn't be able to register unlock for an existed registrationID", async () => {
                const availableLockAmount = lockedAmount - partedLockAmount
                const multisigTx = await timeHolder.registerUnlockShares(
                    registrationId, 
                    shares.address, 
                    availableLockAmount, 
                    user1, 
                    secretLock, 
                    { from: middlewareAuthorityAddress, }
                )
                const [ success, tx, ] = await confirmMultisig(multisigTx, [systemUser,])
                assert.isFalse(success, "have multisig in tx")

                const event = (await eventsHelper.findEvent([timeHolder,], tx, "RegisterUnlockShares"))[0]
                assert.isUndefined(event)
            })
            
            it("should keep original info for registrationID", async () => {
                const [ unlockToken, unlockAmount, unlockHolder, ] = await timeHolder.checkUnlockedShares.call(registrationId, { from: user1, })
                assert.equal(unlockToken, shares.address)
                assert.equal(unlockAmount, partedLockAmount)
                assert.equal(unlockHolder, user1)
            })

            it("users shouldn't be able to unlock shares with wrong secret with TIMEHOLDER_WRONG_SECRET code", async () => {
                assert.equal((await timeHolder.unlockShares.call(registrationId, wrongSecret, { from: user2, })).toNumber(), ErrorsEnum.TIMEHOLDER_WRONG_SECRET)
            })

            it("users shouldn't be able to unlock shares with wrong secret", async () => {
                const tx = await timeHolder.unlockShares(registrationId, wrongSecret, { from: user2, })
                const event = (await eventsHelper.findEvent([timeHolder,], tx, "UnlockShares"))[0]
                assert.isUndefined(event)
            })

            it("holder should keep original locked amount of shares", async () => {
                assert.equal((await timeHolder.getLockedBalance.call(shares.address)).toNumber(), lockedAmount)
            })

            it("any user should be able to unlock shares with OK code", async () => {
                assert.equal((await timeHolder.unlockShares.call(registrationId, secret, { from: user2, })).toNumber(), ErrorsEnum.OK)
            })

            it("any user should be able to unlock shares", async () => {
                const tx = await timeHolder.unlockShares(registrationId, secret, { from: user2, })
                const event = (await eventsHelper.findEvent([timeHolder,], tx, "UnlockShares"))[0]
                assert.isDefined(event)
                assert.equal(event.args.token, shares.address)
                assert.equal(event.args.who, user2)
                assert.equal(event.args.amount, partedLockAmount)
                assert.equal(event.args.receiver, user1)
            })

            it("holder should have a decreased locked balance", async () => {
                assert.equal((await timeHolder.getLockedBalance.call(shares.address)).toNumber(), lockedAmount - partedLockAmount)
            })

            it("deposited balance should increase on the unlocked amount", async () => {
                assert.equal((await timeHolder.getDepositBalance.call(shares.address, user1)).toNumber(), partedLockAmount)
            })
        })

        describe("unregister unlock", () => {
            const secret = "do not tell anyone"
            const wrongSecret = "tell anyone"
            let secretLock
            const registrationId = "0xfefefefe"
            const notExistedRegistrationId = "0x001001001"
            let lockedAmount
            let needToUnlockAmount

            before(async () => {
                assert.notEqual(secret, wrongSecret)

                lockedAmount = (await timeHolder.getLockedBalance.call(shares.address)).toNumber()
                needToUnlockAmount = Math.floor(lockedAmount / 2)

                secretLock = await helperContract.getHash.call(secret)
            })

            after(reverter.revert)

            it("user should have locked tokens", async () => {
                assert.notEqual(lockedAmount, 0)
            })

            it(`middleware should be able to register unlock with "${registrationId}" registrationId`, async () => {
                const multisigTx = await timeHolder.registerUnlockShares(
                    registrationId, 
                    shares.address, 
                    needToUnlockAmount, 
                    user1, 
                    secretLock, 
                    { from: middlewareAuthorityAddress, }
                )
                const [ success, tx, ] = await confirmMultisig(multisigTx, [systemUser,])
                assert.isTrue(success, "have no multisig in tx")

                const event = (await eventsHelper.findEvent([timeHolder,], tx, "RegisterUnlockShares"))[0]
                assert.isDefined(event)
            })

            it(`shouldn't allow to unregister a lock with not existed "${notExistedRegistrationId}" registrationID with TIMEHOLDER_NO_REGISTERED_UNLOCK_FOUND code`, async () => {
                assert.equal((await timeHolder.unregisterUnlockShares.call(
                    notExistedRegistrationId, 
                    { from: middlewareAuthorityAddress, }
                )).toNumber(), ErrorsEnum.TIMEHOLDER_NO_REGISTERED_UNLOCK_FOUND)
            })
            
            it("shouldn't allow to unregister a lock by non-middleware role with UNAUTHORIZED code", async () => {
                assert.equal((await timeHolder.unregisterUnlockShares.call(
                    registrationId, 
                    { from: user1, }
                )).toNumber(), ErrorsEnum.UNAUTHORIZED)
            })
            
            it("shouldn't allow to unregister a lock by non-middleware role", async () => {
                const tx = await timeHolder.unregisterUnlockShares(registrationId, { from: user1, })
                {
                    const event = (await eventsHelper.findEvent([timeHolder,], tx, "UnregisterUnlockShares"))[0]
                    assert.isUndefined(event)
                }
                {
                    const event = (await eventsHelper.findEvent([timeHolder,], tx, "RoleAuthorizationFailed"))[0]
                    assert.isDefined(event)
                }
            })

            it("registered unlock should exist", async () => {
                const [ unlockToken, unlockAmount, unlockHolder, ] = await timeHolder.checkUnlockedShares.call(registrationId, { from: user1, })
                assert.equal(unlockToken, shares.address)
                assert.equal(unlockAmount, needToUnlockAmount)
                assert.equal(unlockHolder, user1)
            })

            it("should allow to unregister a lock by middleware role with OK code", async () => {
                assert.equal((await timeHolder.unregisterUnlockShares.call(
                    registrationId, 
                    { from: middlewareAuthorityAddress, }
                )).toNumber(), ErrorsEnum.OK)
            })

            it("should allow to unregister a lock by middleware role", async () => {
                const tx = await timeHolder.unregisterUnlockShares(registrationId, { from: middlewareAuthorityAddress, })
                {
                    const event = (await eventsHelper.findEvent([timeHolder,], tx, "UnregisterUnlockShares"))[0]
                    assert.isDefined(event)
                    assert.equal(event.args.registrationId, await helperContract.toBytes32(registrationId))
                }
                {
                    const event = (await eventsHelper.findEvent([timeHolder,], tx, "RoleAuthorizationFailed"))[0]
                    assert.isUndefined(event)
                }
            })

            it("user shouldn't be able to unlock shares with unregistered ID with TIMEHOLDER_NO_REGISTERED_UNLOCK_FOUND code", async () => {
                assert.equal((await timeHolder.unregisterUnlockShares.call(
                    notExistedRegistrationId, 
                    { from: middlewareAuthorityAddress, }
                )).toNumber(), ErrorsEnum.TIMEHOLDER_NO_REGISTERED_UNLOCK_FOUND)
            })

            it("user shouldn't be able to unlock shares with unregistered ID", async () => {
                const tx = await timeHolder.unregisterUnlockShares(registrationId, { from: middlewareAuthorityAddress, })
                const event = (await eventsHelper.findEvent([timeHolder,], tx, "UnregisterUnlockShares"))[0]
                assert.isUndefined(event)
            })
        })

        describe("double lock", () => {
            const LOCK_AMOUNT_1 = Math.floor(DEPOSIT_AMOUNT / 3)
            const LOCK_AMOUNT_2 = DEPOSIT_AMOUNT - LOCK_AMOUNT_1
            const TOTAL_LOCK_AMOUNT = LOCK_AMOUNT_1 + LOCK_AMOUNT_2
            const secret = "do not tell anyone"
            let secretLock
            let depositedBalance
            const registrationId1 = "0x111111"
            const registrationId2 = "0x222222"
            const registrationId3 = "0x333333"
            let lockedAmount

            before(async () => {
                depositedBalance = (await timeHolder.getDepositBalance.call(shares.address, user1)).toNumber()

                secretLock = await helperContract.getHash.call(secret)
            })

            after(reverter.revert)

            it(`should have no locked shares`, async () => {
                assert.equal((await timeHolder.getLockedBalance.call(shares.address)).toNumber(), 0)
            })

            it(`user should be able to make first lock for ${LOCK_AMOUNT_1}`, async () => {
                const tx = await timeHolder.lock(shares.address, LOCK_AMOUNT_1, { from: user1, })
                const event = (await eventsHelper.findEvent([timeHolder,], tx, "Lock"))[0]
                assert.isDefined(event)
            })

            it(`locked amount should be equal to ${LOCK_AMOUNT_1}`, async () => {
                assert.equal((await timeHolder.getLockedBalance.call(shares.address)).toNumber(), LOCK_AMOUNT_1)
            })

            it(`deposited balance should decrease for the locked amount`, async () => {
                assert.equal((await timeHolder.getDepositBalance.call(shares.address, user1)).toNumber(), depositedBalance - LOCK_AMOUNT_1)
            })

            it(`middleware should be able to register unlock for first user's amount ${LOCK_AMOUNT_1}`, async () => {
                const multisigTx = await timeHolder.registerUnlockShares(
                    registrationId1,
                    shares.address, 
                    LOCK_AMOUNT_1,
                    user1,
                    secretLock,
                    { from: middlewareAuthorityAddress, }
                )
                const [ success, tx, ] = await confirmMultisig(multisigTx, [systemUser,])
                assert.isTrue(success, "have no multisig in tx")

                const event = (await eventsHelper.findEvent([timeHolder,], tx, "RegisterUnlockShares"))[0]
                assert.isDefined(event)
            })

            it(`user should be able to make the second lock for ${LOCK_AMOUNT_2}`, async () => {
                const tx = await timeHolder.lock(shares.address, LOCK_AMOUNT_2, { from: user1, })
                const event = (await eventsHelper.findEvent([timeHolder,], tx, "Lock"))[0]
                assert.isDefined(event)
            })

            it(`locked amount should be equal to ${TOTAL_LOCK_AMOUNT}`, async () => {
                assert.equal((await timeHolder.getLockedBalance.call(shares.address)).toNumber(), TOTAL_LOCK_AMOUNT)
            })

            it(`deposited balance should decrease for the locked amount`, async () => {
                assert.equal((await timeHolder.getDepositBalance.call(shares.address, user1)).toNumber(), depositedBalance - TOTAL_LOCK_AMOUNT)
            })

            it(`middleware should be able to register unlock for the second user's amount ${LOCK_AMOUNT_2}`, async () => {
                const multisigTx = await timeHolder.registerUnlockShares(
                    registrationId2,
                    shares.address, 
                    LOCK_AMOUNT_2,
                    user1,
                    secretLock,
                    { from: middlewareAuthorityAddress, }
                )
                const [ success, tx, ] = await confirmMultisig(multisigTx, [systemUser,])
                assert.isTrue(success, "have no multisig in tx")

                const event = (await eventsHelper.findEvent([timeHolder,], tx, "RegisterUnlockShares"))[0]
                assert.isDefined(event)
            })

            it(`middleware shoulb be able to register unlock for the third amount ${TOTAL_LOCK_AMOUNT}`, async () => {
                const multisigTx = await timeHolder.registerUnlockShares(
                    registrationId3,
                    shares.address, 
                    TOTAL_LOCK_AMOUNT,
                    user1,
                    secretLock,
                    { from: middlewareAuthorityAddress, }
                )
                const [ success, tx, ] = await confirmMultisig(multisigTx, [systemUser,])
                assert.isTrue(success, "have no multisig in tx")

                const event = (await eventsHelper.findEvent([timeHolder,], tx, "RegisterUnlockShares"))[0]
                assert.isDefined(event)
            })

            it(`user should be able to unlock third registered record with OK code`, async () => {
                assert.equal((await timeHolder.unlockShares.call(registrationId3, secret, { from: user2, })).toNumber(), ErrorsEnum.OK)
            })

            it(`user should be able to unlock firstly locked shares (${LOCK_AMOUNT_1})`, async () => {
                const tx = await timeHolder.unlockShares(registrationId1, secret, { from: user2, })
                const event = (await eventsHelper.findEvent([timeHolder,], tx, "UnlockShares"))[0]
                assert.isDefined(event)
                assert.equal(event.args.amount, LOCK_AMOUNT_1)
                assert.equal(event.args.receiver, user1)
            })

            it("the second registered unlock should exist", async () => {
                const [unlockToken,] = await timeHolder.checkUnlockedShares.call(registrationId2, { from: user1, })
                assert.equal(unlockToken, shares.address)
            })

            it(`should have reduced locked shares equal to ${LOCK_AMOUNT_2}`, async () => {
                assert.equal((await timeHolder.getLockedBalance.call(shares.address)).toNumber(), LOCK_AMOUNT_2)
            })

            it("user shouldn't be able to unlock third locked shares with TIMEHOLDER_UNLOCK_LIMIT_EXCEEDED code", async () => {
                assert.equal((await timeHolder.unlockShares.call(registrationId3, secret, { from: user2, })).toNumber(), ErrorsEnum.TIMEHOLDER_UNLOCK_LIMIT_EXCEEDED)
            })

            it("user shouldn't be able to unlock third locked shares", async () => {
                const tx = await timeHolder.unlockShares(registrationId3, secret, { from: user2, })
                const event = (await eventsHelper.findEvent([timeHolder,], tx, "UnlockShares"))[0]
                assert.isUndefined(event)
            })

            it("the third registered unlock should exist", async () => {
                const [unlockToken,] = await timeHolder.checkUnlockedShares.call(registrationId3, { from: user1, })
                assert.equal(unlockToken, shares.address)
            })

            it("user should be able to unlock secondly locked shares", async () => {
                const tx = await timeHolder.unlockShares(registrationId2, secret, { from: user2, })
                const event = (await eventsHelper.findEvent([timeHolder,], tx, "UnlockShares"))[0]
                assert.isDefined(event)
                assert.equal(event.args.amount, LOCK_AMOUNT_2)
                assert.equal(event.args.receiver, user1)
            })

            it("user should have full deposits unlocked", async () => {
                assert.equal((await timeHolder.getLockedBalance.call(shares.address)).toNumber(), 0)
            })

            it(`deposited balance should be equal to original amount`, async () => {
                assert.equal((await timeHolder.getDepositBalance.call(shares.address, user1)).toNumber(), depositedBalance)
            })
        })

        describe("lock by user1, unlock by user2", () => {
            const LOCK_AMOUNT = Math.floor(DEPOSIT_AMOUNT / 3)
            const secret = "do not tell anyone"
            let secretLock
            const registrationId = "0x111111"
            let initialUser2Balance

            before(async () => {
                initialUser2Balance = (await timeHolder.getDepositBalance.call(shares.address, user2)).toNumber()

                secretLock = await helperContract.getHash.call(secret)
            })

            after("revert", reverter.revert)

            it("should have no locked balance in TimeHolder", async () => {
                assert.equal((await timeHolder.getLockedBalance.call(shares.address)).toNumber(), 0)
            })

            it("should be able to lock balance for user1", async () => {
                const tx = await timeHolder.lock(shares.address, LOCK_AMOUNT, { from: user1, })
                const event = (await eventsHelper.findEvent([timeHolder,], tx, "Lock"))[0]
                assert.isDefined(event)
            })

            it("should have some locked balance", async () => {
                assert.equal((await timeHolder.getLockedBalance.call(shares.address)).toNumber(), LOCK_AMOUNT)
            })

            it("should be allowed to register unlock to user2", async () => {
                const multisigTx = await timeHolder.registerUnlockShares(
                    registrationId, 
                    shares.address, 
                    LOCK_AMOUNT, 
                    user2, 
                    secretLock, 
                    { from: middlewareAuthorityAddress, }
                )
                const [ success, tx, ] = await confirmMultisig(multisigTx, [systemUser,])
                assert.isTrue(success, "have no multisig in tx")

                const event = (await eventsHelper.findEvent([timeHolder,], tx, "RegisterUnlockShares"))[0]
                assert.isDefined(event)
            })

            it("an unlock should be able to be performed", async () => {
                const tx = await timeHolder.unlockShares(registrationId, secret, { from: user1, })
                const event = (await eventsHelper.findEvent([timeHolder,], tx, "UnlockShares"))[0]
                assert.isDefined(event)
            })

            it(`user2 should have ${LOCK_AMOUNT} added to his balance`, async () => {
                assert.equal((await timeHolder.getDepositBalance.call(shares.address, user2)).toNumber(), initialUser2Balance + LOCK_AMOUNT)
            })

            it(`user1 should still have ${DEPOSIT_AMOUNT - LOCK_AMOUNT} on his balance`, async () => {
                assert.equal((await timeHolder.getDepositBalance.call(shares.address, user1)).toNumber(), DEPOSIT_AMOUNT - LOCK_AMOUNT)
            })

            it("should have no locked balance", async () => {
                assert.equal((await timeHolder.getLockedBalance.call(shares.address)).toNumber(), 0)
            })
        })

        describe("lock by several users, unlock by one", () => {
            const user3 = users.user3
            const LOCK_AMOUNT_1 = Math.floor(DEPOSIT_AMOUNT / 3)
            const LOCK_AMOUNT_2 = Math.floor(DEPOSIT_AMOUNT / 5)
            const TOTAL_LOCK_AMOUNT = LOCK_AMOUNT_1 + LOCK_AMOUNT_2
            const UNLOCK_AMOUNT = Math.floor(TOTAL_LOCK_AMOUNT / 2)
            const secret = "do not tell anyone"
            let secretLock
            const registrationId = "0x111111"
            let initialUser3Balance

            before(async () => {
                initialUser3Balance = (await timeHolder.getDepositBalance.call(shares.address, user3)).toNumber()

                secretLock = await helperContract.getHash.call(secret)
            })

            after("revert", reverter.revert)

            it("should have no locked balance in TimeHolder", async () => {
                assert.equal((await timeHolder.getLockedBalance.call(shares.address)).toNumber(), 0)
            })

            it(`user1 should be able to lock ${LOCK_AMOUNT_1} amount`, async () => {
                const tx = await timeHolder.lock(shares.address, LOCK_AMOUNT_1, { from: user1, })
                const event = (await eventsHelper.findEvent([timeHolder,], tx, "Lock"))[0]
                assert.isDefined(event)
            })

            it(`user2 should be able to lock ${LOCK_AMOUNT_2} amount`, async () => {
                const tx = await timeHolder.lock(shares.address, LOCK_AMOUNT_2, { from: user2, })
                const event = (await eventsHelper.findEvent([timeHolder,], tx, "Lock"))[0]
                assert.isDefined(event)
            })

            it(`total locked balance should be equal to ${TOTAL_LOCK_AMOUNT}`, async () => {
                assert.equal((await timeHolder.getLockedBalance.call(shares.address)).toNumber(), TOTAL_LOCK_AMOUNT)
            })

            it(`middleware agent should be able to register unlock request to user3 for ${UNLOCK_AMOUNT}`, async () => {
                const multisigTx = await timeHolder.registerUnlockShares(
                    registrationId, 
                    shares.address, 
                    UNLOCK_AMOUNT, 
                    user3, 
                    secretLock, 
                    { from: middlewareAuthorityAddress, }
                )
                const [ success, tx, ] = await confirmMultisig(multisigTx, [systemUser,])
                assert.isTrue(success, "have no multisig in tx")

                const event = (await eventsHelper.findEvent([timeHolder,], tx, "RegisterUnlockShares"))[0]
                assert.isDefined(event)
            })

            it("any user should be able to unlock registered request to user3", async () => {
                const tx = await timeHolder.unlockShares(registrationId, secret, { from: user1, })
                const event = (await eventsHelper.findEvent([timeHolder,], tx, "UnlockShares"))[0]
                assert.isDefined(event)
            })

            it(`user3 should have increased balance by ${UNLOCK_AMOUNT}`, async () => {
                assert.equal((await timeHolder.getDepositBalance.call(shares.address, user3)).toNumber(), initialUser3Balance + UNLOCK_AMOUNT)
            })

            it(`should have locked balance equal to ${TOTAL_LOCK_AMOUNT - UNLOCK_AMOUNT}`, async () => {
                assert.equal((await timeHolder.getLockedBalance.call(shares.address)).toNumber(), TOTAL_LOCK_AMOUNT - UNLOCK_AMOUNT)
            })
        })

        describe("force unlock", () => {
            const user3 = users.user3
            const LOCK_AMOUNT_1 = Math.floor(DEPOSIT_AMOUNT / 3)
            const LOCK_AMOUNT_2 = Math.floor(DEPOSIT_AMOUNT / 5)
            const TOTAL_LOCK_AMOUNT = LOCK_AMOUNT_1 + LOCK_AMOUNT_2
            const UNLOCK_AMOUNT = Math.floor(TOTAL_LOCK_AMOUNT / 2)
            const secret = "do not tell anyone"
            let secretLock
            const registrationId = "0x111111"
            let systemOwnerBalance

            before(async () => {
                systemOwnerBalance = (await shares.balanceOf.call(systemUser)).toNumber()

                secretLock = await helperContract.getHash.call(secret)
            })

            after("revert", reverter.revert)

            it("systemOwner should have no deposited tokens in TimeHolder", async () => {
                assert.equal((await timeHolder.getDepositBalance.call(shares.address, systemUser)).toNumber(), 0)
            })

            it(`user1 should be able to lock tokens for ${LOCK_AMOUNT_1} amount`, async () => {
                const tx = await timeHolder.lock(shares.address, LOCK_AMOUNT_1, { from: user1, })
                const event = (await eventsHelper.findEvent([timeHolder,], tx, "Lock"))[0]
                assert.isDefined(event)
            })

            it(`user2 should be able to lock tokens for ${LOCK_AMOUNT_2} amount`, async () => {
                const tx = await timeHolder.lock(shares.address, LOCK_AMOUNT_2, { from: user2, })
                const event = (await eventsHelper.findEvent([timeHolder,], tx, "Lock"))[0]
                assert.isDefined(event)
            })

            it("middleware should be able to register unlock request with recepient user3", async () => {
                const multisigTx = await timeHolder.registerUnlockShares(
                    registrationId, 
                    shares.address, 
                    UNLOCK_AMOUNT, 
                    user3, 
                    secretLock, 
                    { from: middlewareAuthorityAddress, }
                )
                const [ success, tx, ] = await confirmMultisig(multisigTx, [systemUser,])
                assert.isTrue(success, "have no multisig in tx")

                const event = (await eventsHelper.findEvent([timeHolder,], tx, "RegisterUnlockShares"))[0]
                assert.isDefined(event)
            })

            it(`should not be able to call forceUnlock by middleware with UNAUTHORIZED code`, async () => {
                assert.equal((await timeHolder.forceUnlockShares.call(shares.address, TOTAL_LOCK_AMOUNT, { from: middlewareAuthorityAddress, })).toNumber(), ErrorsEnum.UNAUTHORIZED)
            })

            it(`should not be able to call forceUnlock by user3 with UNAUTHORIZED code`, async () => {
                assert.equal((await timeHolder.forceUnlockShares.call(shares.address, TOTAL_LOCK_AMOUNT, { from: user3, })).toNumber(), ErrorsEnum.UNAUTHORIZED)
            })

            it(`systemUser should be able to forceUnlock for ${TOTAL_LOCK_AMOUNT} without a need to register request from a middleware`, async () => {
                const tx = await timeHolder.forceUnlockShares(shares.address, TOTAL_LOCK_AMOUNT, { from: systemUser, })
                {
                    const event = (await eventsHelper.findEvent([timeHolder,], tx, "UnlockShares"))[0]
                    assert.isDefined(event)
                    assert.equal(event.args.token, shares.address)
                    assert.equal(event.args.who, systemUser)
                    assert.equal(event.args.amount, TOTAL_LOCK_AMOUNT)
                    assert.equal(event.args.receiver, systemUser)
                }
                {
                    const event = (await eventsHelper.findEvent([timeHolder,], tx, "Deposit"))[0]
                    assert.isUndefined(event)
                }
                {
                    const event = (await eventsHelper.findEvent([timeHolder,], tx, "WithdrawShares"))[0]
                    assert.isUndefined(event)
                }
            })
            
            it("locked balance should be equal to 0", async () => {
                assert.equal((await timeHolder.getLockedBalance.call(shares.address)).toNumber(), 0)
            })

            it(`systemUser should receive unlocked tokens on his balance`, async () => {
                assert.equal((await shares.balanceOf.call(systemUser)).toNumber(), systemOwnerBalance + TOTAL_LOCK_AMOUNT)
            })

            it(`systemUser still shouldn't have tokens in TimeHolder`, async () => {
                assert.equal((await timeHolder.getDepositBalance.call(shares.address, systemUser)).toNumber(), 0)
            })

            it("user3 shouldn't be able to unlock registered shares with TIMEHOLDER_UNLOCK_LIMIT_EXCEEDED code", async () => {
                assert.equal((await timeHolder.unlockShares.call(registrationId, secret, { from: user3, })).toNumber(), ErrorsEnum.TIMEHOLDER_UNLOCK_LIMIT_EXCEEDED)
            })

            it("user3 shouldn't be able to unlock registered shares", async () => {
                const tx = await timeHolder.unlockShares(registrationId, secret, { from: user3, })
                {
                    const event = (await eventsHelper.findEvent([timeHolder,], tx, "UnlockShares"))[0]
                    assert.isUndefined(event)
                }
                {
                    const event = (await eventsHelper.findEvent([timeHolder,], tx, "Error"))[0]
                    assert.isDefined(event)
                }
            })
        })
    })
})
