const Reverter = require('./helpers/reverter')
const bytes32 = require('./helpers/bytes32')
const bytes32fromBase58 = require('./helpers/bytes32fromBase58')
const eventsHelper = require('./helpers/eventsHelper')
const Setup = require('../setup/setup')
const ErrorsEnum = require("../common/errors");
const TimeMachine = require('./helpers/timemachine')

const Clock = artifacts.require('./Clock.sol')
const Stub = artifacts.require('./Stub.sol')
const MultiEventsHistory = artifacts.require('./MultiEventsHistory.sol')
const PendingManager = artifacts.require("./PendingManager.sol")
const ChronoBankAssetProxy = artifacts.require("./ChronoBankAssetProxy.sol")
const VotingManager = artifacts.require("./VotingManager.sol")
const PollInterface = artifacts.require("./PollInterface.sol")
const VotingManagerEmitter = artifacts.require("./VotingManagerEmitter.sol")
const PollEmitter = artifacts.require("./PollEmitter.sol")
const ERC20Manager = artifacts.require("./ERC20Manager.sol")
const Roles2Library = artifacts.require("./Roles2Library.sol")

const reverter = new Reverter(web3)
const timeMachine = new TimeMachine(web3)
const utils = require('./helpers/utils');

contract('Vote', function(accounts) {
    const admin = accounts[0];
    const owner = accounts[1]
    const owner1 = accounts[2];
    const nonOwner = accounts[7];
    const middlewareAuthorityAddress = admin // NOTE: look in migrations for setup_roles.js
    const SYMBOL = 'TIME'
    const totalTimeTokens = 100000000
    const timeTokensBalance = 50
    const ACTIVE_POLLS_MAX = 20

    let timeTokensToWithdraw75Balance = 75
    let timeTokensToWithdraw40Balance = 40
    let timeTokensToWithdraw45Balance = 45
    let timeTokensToWithdraw20Balance = 20
    let timeTokensToWithdraw25Balance = 25
    let timeTokensToWithdraw5Balance = 5

    let votingManager
    let clock
    let timeAddress
    let helperContract

    let proxyForSymbol = async (symbol) => {
        let tokenAddress = await Setup.erc20Manager.getTokenAddressBySymbol.call(symbol)
        let proxy = await ChronoBankAssetProxy.at(tokenAddress)
        return proxy
    }

    let createPolls = async (count, user) => {
        var polls = []
        for (var idx = 0; idx < count; ++idx) {
            var time = await clock.time.call()
            let tx = await votingManager.createPoll(2, bytes32('auto-created poll'), 150, time.plus(10000), { from: user })
            let emitter = await VotingManagerEmitter.at(votingManager.address)
            let event = (await eventsHelper.findEvent([emitter], tx, 'PollCreated'))[0]
            assert.isDefined(event)
            let poll = await PollInterface.at(event.args.pollAddress)
            try {
                await poll.activatePoll({ from: admin })
            } catch (e) {
                const numberOfActivePolls = (await votingManager.getActivePollsCount.call()).toNumber()
                if (numberOfActivePolls == ACTIVE_POLLS_MAX) {
                    utils.ensureException(e)
                }
                else {
                    throw e
                }
            }

            polls.push(poll)
        }

        return polls
    }

    before('setup', async () => {
        eventor = await PendingManager.at(MultiEventsHistory.address)
        votingManager = await VotingManager.deployed()
        clock = await Clock.deployed()
        let erc20Manager = await ERC20Manager.deployed();
        timeAddress = await erc20Manager.getTokenAddressBySymbol(SYMBOL);
        helperContract = await Stub.deployed()
        await Setup.setupPromise()
    });

    context("owner shares deposit", function () {

        it("should be able to send 100 TIME to owner", async () => {
            let token = await proxyForSymbol(SYMBOL)
            let isTransferSuccess = token.transfer.call(owner, totalTimeTokens, { from: admin })
            assert.isOk(isTransferSuccess)

            await token.transfer(owner, totalTimeTokens, { from: admin })
        })

        it("check Owner has 100 TIME", async () => {
            let token = await proxyForSymbol(SYMBOL)
            let balance = await token.balanceOf.call(owner)
            assert.equal(balance, totalTimeTokens)
        })

        it("owner should be able to approve 50 TIME to Vote", async () => {
            let wallet = await Setup.timeHolder.wallet.call()
            let token = await proxyForSymbol(SYMBOL)
            let isApproved = await token.approve.call(wallet, timeTokensBalance, { from: owner })
            assert.isOk(isApproved)

            await token.approve(wallet, timeTokensBalance, { from: owner })
        })

        it("should be able to deposit 50 TIME from owner", async () => {
            let isDepositSuccess = await Setup.timeHolder.deposit.call(timeAddress,timeTokensBalance, { from: owner })
            assert.isOk(isDepositSuccess)

            await Setup.timeHolder.deposit(timeAddress,timeTokensBalance, { from: owner })

            let depositBalance = await Setup.timeHolder.depositBalance.call(owner, { from: owner })
            assert.equal(depositBalance, timeTokensBalance);
        })

        it("should be able to withdraw 25 TIME from owner", async () => {
            let isWithdrawSuccess = await Setup.timeHolder.withdrawShares.call(timeAddress,timeTokensToWithdraw25Balance, { from: owner })
            assert.isOk(isWithdrawSuccess)

            await Setup.timeHolder.withdrawShares(timeAddress,timeTokensToWithdraw25Balance, { from: owner })

            let depositBalance = await Setup.timeHolder.depositBalance.call(owner, { from: owner })
            assert.equal(depositBalance, timeTokensToWithdraw25Balance);
        })

        it("snapshot", reverter.snapshot)
    })

    context("voting", function () {
        let vote1Obj = { details: bytes32fromBase58("QmTfCejgo2wTwqnDJs8Lu1pCNeCrCDuE4GAwkna93zd999") }
        let pollAddress
        let voteLimit
        let pollEntity
        let otherPollEntity
        let otherPollVotelimit = 75
        let deadline

        context("single voter (owner)", function () {

            it("should be able to create poll", async () => {
                voteLimit = await votingManager.getVoteLimit.call()
                assert.notEqual(voteLimit.toNumber(), 0)
                let currentTime = await clock.time.call()
                deadline = currentTime.plus(10000)

                let createdPollResult = await votingManager.createPoll.call(2, vote1Obj.details, voteLimit, deadline, {
                    from: owner,
                    gas: 3000000
                })
                assert.equal(createdPollResult, ErrorsEnum.OK)

                let createdPollTx = await votingManager.createPoll(2, vote1Obj.details, voteLimit, deadline, {
                    from: owner,
                    gas: 3000000
                })

                let emitter = await VotingManagerEmitter.at(votingManager.address)
                let event = (await eventsHelper.findEvent([emitter], createdPollTx, 'PollCreated'))[0]
                assert.isDefined(event)

                pollAddress = event.args.pollAddress
                pollEntity = await PollInterface.at(pollAddress)
            })

            it("should have owner as an owner of created poll", async () => {
                let pollOwner = await pollEntity.owner.call()
                assert.equal(pollOwner, owner)
            })

            it("should not be able to create a new poll with exceeded vote limit", async () => {
                voteLimit = await votingManager.getVoteLimit.call()
                assert.notEqual(voteLimit.toNumber(), 0)

                let currentTime = await clock.time.call()

                try {
                    let createdPollResult = await votingManager.createPoll.call(2, vote1Obj.details, voteLimit.plus(1), currentTime.plus(10000), {
                        from: owner,
                        gas: 3000000
                    })
                    assert.isTrue(false)
                } catch (e) {
                    assert.isTrue(true)
                }
            })

            it('should not be able to vote before activation of a poll', async () => {
                try {
                    await pollEntity.vote.call(1, { from: owner })
                    assert.isTrue(false)
                } catch (e) {
                    assert.isTrue(true)
                }
            })

            it('admin should be able to activate a poll if poll wasn\'t activated yet', async () => {
                try {
                    let activationTx = await pollEntity.activatePoll({ from: admin })
                    let emitter = await PollEmitter.at(pollEntity.address)
                    let event = (await eventsHelper.findEvent([emitter], activationTx, "PollActivated"))[0]
                    assert.isDefined(event)

                    let isPollActive = await pollEntity.active.call()
                    assert.isOk(isPollActive)
                } catch (e) {
                    assert.isTrue(false);
                }
            })

            it("owner should be able to vote, option 1 ", async () => {
                let successVotingResultCode = await pollEntity.vote.call(1, { from: owner })
                assert.equal(successVotingResultCode, ErrorsEnum.OK)

                let voteTx = await pollEntity.vote(1, { from: owner })
                console.log('vote in poll', voteTx.tx);

                let emitter = await PollEmitter.at(pollEntity.address)
                let event = (await eventsHelper.findEvent([emitter], voteTx, "PollVoted"))[0]
                assert.isDefined(event)
            })

            it("user shouldn\'t be able to vote twice", async () => {
                try {
                    await pollEntity.vote.call(2, { from: owner })
                    assert.isTrue(false)
                } catch (e) {
                    assert.isTrue(true)
                }
            })

            it("should be able to fetch details for a poll", async () => {
                let details = await pollEntity.getDetails.call()
                assert.lengthOf(details, 8)
                assert.equal(details[0], owner)
                assert.equal(details[1], vote1Obj.details)
                assert.equal(details[3].toNumber(), deadline.toNumber())
                assert.isOk(details[4])
                assert.isOk(details[5])
            })

            it("voter (owner) should have option 1 as an option (in other words be a member)", async () => {
                let choice = await pollEntity.memberOptions.call(owner)
                assert.equal(choice, 1)
            })

            // other poll

            it("should be able to create another poll by owner", async () => {
                let currentTime = await clock.time.call()
                deadline = currentTime.plus(10000)

                let createdPollResult = await votingManager.createPoll.call(2, vote1Obj.details, otherPollVotelimit, deadline, {
                    from: owner,
                    gas: 3000000
                })

                assert.equal(createdPollResult, ErrorsEnum.OK)

                let createdPollTx = await votingManager.createPoll(2, vote1Obj.details, otherPollVotelimit, deadline, {
                    from: owner,
                    gas: 3000000
                })
                console.log('create poll', createdPollTx.tx);

                let emitter = await VotingManagerEmitter.at(votingManager.address)
                let event = (await eventsHelper.findEvent([emitter], createdPollTx, 'PollCreated'))[0]
                assert.isDefined(event)

                otherPollEntity = await PollInterface.at(event.args.pollAddress)
                assert.equal(otherPollEntity.address, event.args.pollAddress)
            })

            it('should be different polls created for owner', async () => {
                assert.notEqual(pollEntity.address, otherPollEntity.address)
            })

            it('should return all created polls for owner', async () => {
                let pollsCount = await votingManager.getPollsCount.call()
                var polls = await votingManager.getPollsPaginated.call(0, pollsCount)
                polls = polls.unique()

                assert.equal(pollsCount, 2)
                assert.lengthOf(polls, 2)
                assert.include(polls, pollEntity.address)
                assert.include(polls, otherPollEntity.address)
            })

            it('should be able to have to 2 active polls for owner and vote, option 2', async () => {
                try {
                    await otherPollEntity.activatePoll()

                    let isPollActive = await otherPollEntity.active.call()
                    assert.isOk(isPollActive)
                } catch (e) {
                    assert.isTrue(false);
                }

                let successVotingResultCode = await otherPollEntity.vote.call(2, { from: owner })
                assert.equal(successVotingResultCode, ErrorsEnum.OK)

                let voteTx = await otherPollEntity.vote(2, { from: owner })
            })

            it('should be able to return polls\' details', async () => {
                let pollsDetails = await votingManager.getPollsDetails.call([pollEntity.address, otherPollEntity.address])
                assert.lengthOf(pollsDetails, 7)
                assert.lengthOf(pollsDetails[0], 2)
            })

            it('shouldn\'t allow to update details hash for a poll by a non-owner of a poll', async () => {
                let nonPollOwner = nonOwner

                let updatedDetailsHash = bytes32('updatedhash-333')
                let originalDetails = (await otherPollEntity.getDetails.call())[1]

                let failedResultCode = await otherPollEntity.updatePollDetailsIpfsHash.call(updatedDetailsHash, { from: nonPollOwner })
                assert.equal(failedResultCode, ErrorsEnum.UNAUTHORIZED)

                let updateDetailsTx = await otherPollEntity.updatePollDetailsIpfsHash(updatedDetailsHash, { from: nonPollOwner })
                let emitter = await PollEmitter.at(otherPollEntity.address)
                let event = (await eventsHelper.findEvent([emitter], updateDetailsTx, "PollDetailsHashUpdated"))[0]
                assert.isUndefined(event)

                let newDetails = (await otherPollEntity.getDetails.call())[1]
                assert.equal(newDetails, originalDetails)
            })

            it('should allow to update details hash for a poll by a owner of a poll', async () => {
                let updatedDetailsHash = bytes32('updatedhash-333');
                let originalDetails = (await otherPollEntity.getDetails.call())[1];

                let resultCode = await otherPollEntity.updatePollDetailsIpfsHash.call(updatedDetailsHash, { from: owner });
                assert.equal(resultCode, ErrorsEnum.OK);

                let updateDetailsTx = await otherPollEntity.updatePollDetailsIpfsHash(updatedDetailsHash, { from: owner });
                let emitter = await PollEmitter.at(otherPollEntity.address);
                let event = (await eventsHelper.findEvent([emitter], updateDetailsTx, "PollDetailsHashUpdated"))[0];
                assert.isDefined(event);
                assert.equal(event.args.hash, updatedDetailsHash);

                let newDetails = (await otherPollEntity.getDetails.call())[1];
                assert.equal(newDetails, updatedDetailsHash);
            })
        })

        context('two voters (+ owner1)', function () {

            it('should be able to send 50 TIME tokens to owner1', async () => {
                let token = await proxyForSymbol(SYMBOL)
                let successTransfer = await token.transfer.call(owner1, timeTokensBalance, { from: admin })
                assert.isOk(successTransfer)

                await token.transfer(owner1, timeTokensBalance, { from: admin })
            })

            it('owner1 should have 50 TIME', async () => {
                let token = await proxyForSymbol(SYMBOL)
                let balance = await token.balanceOf.call(owner1)
                assert.equal(balance, timeTokensBalance)
            })

            it('owner1 should be able to approve 50 TIME tokens to TimeHolder', async () => {
                let wallet = await Setup.timeHolder.wallet.call()
                let token = await proxyForSymbol(SYMBOL)
                let successApprove = await token.approve.call(wallet, timeTokensBalance, { from: owner1 })
                assert.isOk(successApprove)

                await token.approve(wallet, timeTokensBalance, { from: owner1 })
            })

            it('should be able to deposit 50 TIME tokens from owner1', async () => {
                let successDeposit = await Setup.timeHolder.deposit.call(timeAddress,timeTokensBalance, { from: owner1 })
                assert.isOk(successDeposit)

                await Setup.timeHolder.deposit(timeAddress,timeTokensBalance, { from: owner1 })
            })

            it('should show 50 TIME tokens owner1 balance', async () => {
                let balance = await Setup.timeHolder.depositBalance.call(owner1, { from: owner1 })
                assert.equal(balance, timeTokensBalance)
            })

            it('owner1 should be able to vote in poll, option 2', async () => {
                let successVotingResultCode = await pollEntity.vote.call(2, { from: owner1 })
                assert.equal(successVotingResultCode, ErrorsEnum.OK)

                let votingTx = await pollEntity.vote(2, { from: owner1 })
            })

            it('shouldn\'t show poll as finished', async () => {
                let details = await pollEntity.getDetails.call()
                assert.isOk(details[5]) // property: 'active'
            })

            it('shouldn\'t show otherPoll as finished', async () => {
                let details = await otherPollEntity.getDetails.call()
                assert.isOk(details[5]) // property: 'active'
            })

            it('owner1 should be able to vote in otherPoll, options 2', async () => {
                let successVotingResultCode = await otherPollEntity.vote.call(2, { from: owner1 })
                assert.equal(successVotingResultCode, ErrorsEnum.OK)

                let votingTx = await otherPollEntity.vote(2, { from: owner1 })
                let emitter = await PollEmitter.at(otherPollEntity.address)
                let event = (await eventsHelper.findEvent([emitter], votingTx, "PollVoted"))[0]
                assert.isDefined(event)
            })

            it('otherPoll should be shown as finished', async () => {
                let details = await otherPollEntity.getDetails.call()
                assert.isNotOk(details[5]) // property: 'active'
            })

            it('should be able to get balances of votes for poll', async () => {
                let optionsAndBalances = await pollEntity.getVotesBalances.call()
                assert.lengthOf(optionsAndBalances, 2)

                let balances = optionsAndBalances[1]
                assert.equal(balances[0], timeTokensToWithdraw25Balance)
                assert.equal(balances[1], timeTokensBalance)
            })

            it('should be able to get balances of votes for otherPoll', async () => {
                let optionsAndBalances = await otherPollEntity.getVotesBalances.call()
                assert.lengthOf(optionsAndBalances, 2)

                let balances = optionsAndBalances[1]
                assert.equal(balances[0], 0)
                assert.equal(balances[1], timeTokensToWithdraw75Balance)
            })
        })

        const maximumPollsCount = 20
        let multiplePolls

        context('multiple polls', function () {

            it('shouldn\'t be able to create more than 20 ACTIVE polls', async () => {
                multiplePolls = await createPolls(30, owner)
                let activePollsCount = await votingManager.getActivePollsCount.call()
                assert.equal(activePollsCount, maximumPollsCount)

                let totalNumberOfPolls = await votingManager.getPollsCount.call()
                assert.equal(totalNumberOfPolls, multiplePolls.length + 2) // 2 - previously created polls
            })

            it('should allow to delete inactive poll for CBE user', async () => {
                let pollToRemove = multiplePolls.pop()
                //let result = await pollToRemove.killPoll.call({ from: admin })
                let killTx = await pollToRemove.killPoll({ from: admin })
                console.log('killTx', killTx.tx);
                let emitter = await VotingManagerEmitter.at(votingManager.address)
                let event = (await eventsHelper.findEvent([emitter], killTx, "PollRemoved"))[0]
                assert.isDefined(event)

                let activePollsCount = await votingManager.getActivePollsCount.call()
                assert.equal(activePollsCount, maximumPollsCount)

                let totalNumberOfPolls = await votingManager.getPollsCount.call()
                assert.equal(totalNumberOfPolls, multiplePolls.length + 2) // 2 - previously created polls
            })

            it('shouldn\'t allow to delete inactive poll for non-CBE user', async () => {
                let pollTryToRemove = multiplePolls[multiplePolls.length - 1]

                await pollTryToRemove.killPoll.call({ from: owner })

                let activePollsCount = await votingManager.getActivePollsCount.call()
                assert.equal(activePollsCount, maximumPollsCount)

                let totalNumberOfPolls = await votingManager.getPollsCount.call()
                assert.equal(totalNumberOfPolls, multiplePolls.length + 2) // 2 - previously created polls
            })

            it('shouldn\'t be able to delete active poll by a user with any access rights', async () => {
                let isActive = await pollEntity.active.call()
                assert.isOk(isActive)

                try {
                    await pollEntity.killPoll.call({ from: admin })
                    assert.isTrue(false)
                } catch (e) {
                    assert.isTrue(true)
                }

                try {
                    await pollEntity.killPoll.call({ from: owner })
                    assert.isTrue(false)
                } catch (e) {
                    assert.isTrue(true)
                }
            })

            it('should allow CBE to end poll', async () => {
                let pollToEnd = multiplePolls[0]
                let isActive = await pollToEnd.active.call()
                assert.isOk(isActive)
                let endTx = await pollToEnd.endPoll({ from: admin })
                console.log('endPollTx', endTx.tx);
                let emitter = await PollEmitter.at(pollToEnd.address)
                let event = (await eventsHelper.findEvent([emitter], endTx, "PollEnded"))[0]
                assert.isDefined(event)

                let activePollsCount = await votingManager.getActivePollsCount.call()
                assert.equal(activePollsCount, maximumPollsCount - 1)

                let totalNumberOfPolls = await votingManager.getPollsCount.call()
                assert.equal(totalNumberOfPolls, multiplePolls.length + 2) // 2 - previously created polls
            })
        })

        context('manipulate balances', function () {
            const registeredUnlockId = "0x000000fffffff"
            const secret = "password123"
            let secretLock

            before(async () => {
                secretLock = await helperContract.getHash(secret)
            })

            it('should be able to withdraw 5 TIME tokens from owner1', async () => {
                let successWithdrawal = await Setup.timeHolder.withdrawShares.call(timeAddress, 5, { from: owner1 })
                assert.equal(successWithdrawal, ErrorsEnum.OK)

                await Setup.timeHolder.withdrawShares(timeAddress, 5, { from: owner1 })

                let totalShares = await Setup.timeHolder.getDepositBalance.call(timeAddress, owner1)
                assert.equal(totalShares, timeTokensToWithdraw45Balance)
            })

            it('should be able to show updated vote balances for poll', async () => {
                let optionsAndBalances = await pollEntity.getVotesBalances.call()
                assert.lengthOf(optionsAndBalances, 2)

                let balances = optionsAndBalances[1]
                assert.equal(balances[0], timeTokensToWithdraw25Balance)
                assert.equal(balances[1], timeTokensToWithdraw45Balance)
            })

            it('should be able to lock 5 TIME tokens from owner1', async () => {
                let successWithdrawal = await Setup.timeHolder.lock.call(timeAddress, 5, { from: owner1 })
                assert.equal(successWithdrawal, ErrorsEnum.OK)

                await Setup.timeHolder.lock(timeAddress, 5, { from: owner1 })

                let totalShares = await Setup.timeHolder.getDepositBalance.call(timeAddress, owner1)
                assert.equal(totalShares, timeTokensToWithdraw40Balance)
            })

            it('should be able to show updated vote balances for poll', async () => {
                let optionsAndBalances = await pollEntity.getVotesBalances.call()
                assert.lengthOf(optionsAndBalances, 2)

                let balances = optionsAndBalances[1]
                assert.equal(balances[0], timeTokensToWithdraw25Balance)
                assert.equal(balances[1], timeTokensToWithdraw40Balance)
            })

            it("should be able to unlock 5 TIME tokens for owner1 and show 45 TIME on vote's balance", async () => {
                const tx = await Setup.timeHolder.registerUnlockShares(registeredUnlockId, timeAddress, 5, owner1, secretLock, { from: middlewareAuthorityAddress })
                // NOTE: uncomment when middlewareAuthorityAddress != CBE
                // {
                //     const event = (await eventsHelper.findEvent([Setup.shareable,], tx, "AddMultisigTx"))[0]
                //     assert.isDefined(event)
                //     await pendingManager.confirm(event.args.hash, { from: admin, })
                // }
                await Setup.timeHolder.unlockShares(registeredUnlockId, secret, { from: owner })

                let totalShares = await Setup.timeHolder.getDepositBalance.call(timeAddress, owner1)
                assert.equal(totalShares, timeTokensToWithdraw45Balance)
            })

            it('should be able to show updated vote balances for poll', async () => {
                let optionsAndBalances = await pollEntity.getVotesBalances.call()
                assert.lengthOf(optionsAndBalances, 2)

                let balances = optionsAndBalances[1]
                assert.equal(balances[0], timeTokensToWithdraw25Balance)
                assert.equal(balances[1], timeTokensToWithdraw45Balance)
            })

            it('should be able to withdraw 45 TIME tokens from owner1', async () => {
                let successWithdrawal = await Setup.timeHolder.withdrawShares.call(timeAddress, timeTokensToWithdraw45Balance, { from: owner1 })
                assert.equal(successWithdrawal, ErrorsEnum.OK)

                await Setup.timeHolder.withdrawShares(timeAddress, timeTokensToWithdraw45Balance, { from: owner1 })
            })

            let remainderTimeTokenBalance = totalTimeTokens - timeTokensToWithdraw25Balance

            it('should be able to approve remainded TIME tokens for voting to owner', async () => {
                let wallet = await Setup.timeHolder.wallet.call()
                let token = await proxyForSymbol(SYMBOL)

                let successApprove = await token.approve.call(wallet, remainderTimeTokenBalance, { from: owner })
                assert.isOk(successApprove)

                await token.approve(wallet, remainderTimeTokenBalance, { from: owner })
            })

            it('should be able to deposit reminded TIME tokens from owner', async () => {
                let successDeposit = await Setup.timeHolder.deposit.call(timeAddress,remainderTimeTokenBalance, { from: owner })
                assert.isOk(successDeposit)

                await Setup.timeHolder.deposit(timeAddress,remainderTimeTokenBalance, { from: owner })
            })

            it('should show 0 TIME tokens for owner1 and all TIME tokens for owner', async () => {
                let token = await proxyForSymbol(SYMBOL)

                // for owner1
                let depositedBalanceForOwner1 = await Setup.timeHolder.depositBalance.call(owner1)
                assert.equal(depositedBalanceForOwner1, 0)

                let totalBalanceForOwner1 = await token.balanceOf.call(owner1)
                assert.equal(totalBalanceForOwner1, timeTokensBalance)

                // for owner
                let depositedBalanceForOwner = await Setup.timeHolder.depositBalance.call(owner)
                assert.equal(depositedBalanceForOwner, totalTimeTokens)

                let totalBalanceForOwner = await token.balanceOf.call(owner)
                assert.equal(totalBalanceForOwner, 0)
            })

            it('should show updated balances for poll votes', async () => {
                let optionsAndBalances = await pollEntity.getVotesBalances.call()
                assert.lengthOf(optionsAndBalances, 2)

                let balances = optionsAndBalances[1]
                assert.equal(balances[0], totalTimeTokens)
                assert.equal(balances[1], 0)
            })
        })

        it('revert', reverter.revert)
    })
})
