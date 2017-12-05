const Wallet = artifacts.require('./Wallet.sol')
const FakeCoin = artifacts.require("./FakeCoin.sol")
const ChronoBankAssetProxy = artifacts.require("./ChronoBankAssetProxy.sol")
const bytes32 = require('./helpers/bytes32')
const Setup = require('../setup/setup')
const eventsHelper = require('./helpers/eventsHelper')
const MultiEventsHistory = artifacts.require('./MultiEventsHistory.sol')
const ErrorsEnum = require("../common/errors")
const Clock = artifacts.require('./Clock.sol')
const TimeMachine = require('./helpers/timemachine');

contract('Wallets Manager', function(accounts) {
    let owner = accounts[0]
    let owner1 = accounts[1]
    let owner2 = accounts[2]
    let owner3 = accounts[3]
    let owner4 = accounts[4]
    let owner5 = accounts[5]
    let nonOwner = accounts[6]
    let wallet
    let wallet2FA
    let txId
    let watcher
    let clock
    let coin
    let eventor
    let unix = Math.round(+new Date()/1000)
    let timeMachine = new TimeMachine(web3);

    before('setup', function(done) {
        Wallet.at(MultiEventsHistory.address).then((instance) => {
            eventor = instance
            return Clock.deployed()
            .then(_clock => clock = _clock)
        })
        Setup.setup(done)
    })

    const SYMBOL = 'TOKEN';

    context("initial tests", function() {

        it("Token and balances initialization should pass.", function () {
            return FakeCoin.deployed().then(function (instance) {
                coin = instance
                return Wallet.new([owner,owner1], 2, Setup.contractsManager.address, Setup.multiEventsHistory.address, false, 0).then(function (instance) {
                    wallet = instance
                    return Setup.multiEventsHistory.authorize(wallet.address).then(function () {
                        return Setup.erc20Manager.addToken(coin.address, SYMBOL, SYMBOL, '0x1', 2, '0x1', '0x1', {
                            from: owner,
                            gas: 3000000
                        }).then(function (tx) {
                            return coin.mint(accounts[0], 10000).then(() => {
                                return coin.mint(wallet.address, 10000)
                            }).then(() => {
                                web3.eth.sendTransaction({to: wallet.address, value: 10000, from: accounts[0]})
                                balanceETH = web3.eth.getBalance(wallet.address)
                                assert.equal(balanceETH, 10000)
                                return coin.balanceOf.call(wallet.address).then((balanceERC20) => {
                                    assert.equal(balanceERC20, 10000)
                                })
                            })
                        })
                    })
                })
            })
        })

    })

    context("CRUD test", function(){

        it("can create new MultiSig Wallet contract", function() {
            return Setup.walletsManager.createWallet.call([owner,owner1],2, 0).then(function(r1) {
                return Setup.walletsManager.createWallet([owner,owner1],2, 0, {
                    from: owner,
                    gas: 3000000
                }).then((tx) => {
                    const walletCreatedEvents = eventsHelper.extractEvents(tx, "WalletCreated")
                    assert.notEqual(walletCreatedEvents.length, 0)
                    const walletAddress = walletCreatedEvents[0].args.wallet
                    return Wallet.at(walletAddress).then(function(instance) {
                        return instance.m_required.call().then(function(r2) {
                            return instance.m_numOwners.call().then(function(r3) {
                                assert.equal(r1, ErrorsEnum.OK)
                                assert.equal(r2, 2)
                                assert.equal(r3, 2)
                            })
                        })
                    })
                })
            })
        })

        it("doesn't allow add not owned Multisig Wallet contract", function() {
            return Setup.walletsManager.addWallet.call(wallet.address, {from: owner2,
                gas: 3000000 }).then(function (r) {
                return Setup.walletsManager.addWallet(wallet.address, {
                    from: owner2,
                    gas: 3000000
                }).then(function (tx) {
                    return Setup.walletsManager.getWallets.call({from:owner2}).then(function (r2) {
                        assert.equal(r, ErrorsEnum.ERROR_WALLET_CANNOT_ADD_TO_REGISTRY)
                        assert.equal(r2[0].length, 1)
                    })
                })
            })
        })

        it("allow add Multisig Wallet contract", function() {
            return Setup.walletsManager.addWallet.call(wallet.address).then(function (r) {
                return Setup.walletsManager.addWallet(wallet.address, {
                    from: owner,
                    gas: 3000000
                }).then(function (tx) {
                    return Setup.walletsManager.getWallets.call().then(function (r2) {
                        assert.equal(r, ErrorsEnum.OK)
                        assert.equal(r2[0].length, 2)
                    })
                })
            })
        })

        it("doesn't allow add same Multisig Wallet contract twice ", function() {
            return Setup.walletsManager.addWallet.call(wallet.address).then(function (r) {
                return Setup.walletsManager.addWallet(wallet.address, {
                    from: owner,
                    gas: 3000000
                }).then(function (tx) {
                    return Setup.walletsManager.getWallets.call().then(function (r2) {
                        assert.equal(r, ErrorsEnum.ERROR_WALLET_EXISTS)
                        assert.equal(r2[0].length, 2)
                    })
                })
            })
        })

        it("doesn't allow add non Multisig Wallet contract", function() {
            return Setup.erc20Manager.getTokenAddressBySymbol('TIME').then(_address => ChronoBankAssetProxy.at(_address))
                .then(_proxy => _proxy.getLatestVersion.call())
                .then(_assetAddress => {
                    return Setup.walletsManager.addWallet.call(_assetAddress).then(_code => {
                        assert.equal(_code, ErrorsEnum.ERROR_WALLET_UNKNOWN)
                    })
                })
        })

        it('should be able to multisig send ETH', function() {
            eventsHelper.setupEvents(eventor)
            watcher = eventor.ConfirmationNeeded()
            balanceETH = web3.eth.getBalance(wallet.address)
            return wallet.transfer.call(owner3, 5000, 'ETH').then(function (r) {
                return wallet.transfer(owner3, 5000, 'ETH').then(function (tx) {
                    return eventsHelper.getEvents(tx, watcher)
                }).then(function (events) {
                    assert.notEqual(events.length, 0)
                    const confirmationHash = events[0].args.operation
                    const old_balance = web3.eth.getBalance(owner3)
                    return wallet.confirm.call(confirmationHash, {from: owner1}).then(function (r2) {
                        return wallet.confirm(confirmationHash, {from: owner1}).then(function () {
                            assert.equal(r, 14014)
                            assert.equal(r2, 1)
                            const new_balance = web3.eth.getBalance(owner3)
                            assert.isTrue(new_balance.equals(old_balance.add(5000)))
                        })
                    })
                })
            })
        })

        it("shouldn't be able to multisig send ETH if balance not enough", function() {
            return wallet.transfer.call(owner3, 6000, 'ETH').then(function (r) {
                assert.equal(r,14019)
            })
        })

        it("should be able to multisig send ERC20", function() {
            return wallet.transfer.call(owner3,5000,SYMBOL, {from: owner}).then(function(r) {
                return wallet.transfer(owner3,5000,SYMBOL, {from: owner}).then(function(tx) {
                    return eventsHelper.getEvents(tx, watcher)
                }).then(function (events) {
                    assert.notEqual(events.length, 0)
                    const confirmationHash = events[0].args.operation
                    return wallet.confirm.call(confirmationHash, {from:owner1}).then(function(r2) {
                        return wallet.confirm(confirmationHash, {from:owner1}).then(function() {
                            return coin.balanceOf.call(owner3).then(function(r3)
                            {
                                assert.equal(r, 14014)
                                assert.equal(r2, 1)
                                assert.equal(r3, 5000)
                            })
                        })
                    })
                })
            })
        })

        it("shouldn't be able to multisig send ERC20 if balance no enough", function() {
            return wallet.transfer.call(owner3,6000,SYMBOL, {from: owner}).then(function(r) {
                assert.equal(r,14019)
            })
        })

        it("should multisig change owner", function() {
            return wallet.isOwner.call(owner1)
                .then(r => assert.isTrue(r))
                .then(() => wallet.isOwner.call(owner2))
                .then(r => assert.isFalse(r))
                .then(() => wallet.changeOwner(owner1, owner2))
                // .then(tx => console.log(tx.logs))
                // .then(() => wallet.getPendings.call())
                // .then(pendings => console.log(pendings))
                .then(() => wallet.changeOwner(owner1, owner2, {from:owner1}))
                .then(() => wallet.isOwner.call(owner1))
                .then(r => assert.isFalse(r))
                .then(() => wallet.isOwner.call(owner2))
                .then(r => assert.isTrue(r))
        })

        it("should multisig add owner", function() {
            return wallet.isOwner.call(owner1).then(function(r) {
                assert.isFalse(r)
                return wallet.addOwner(owner1).then(function () {
                    return wallet.addOwner(owner1, {from:owner2}).then(function () {
                        return wallet.isOwner.call(owner1).then(function (r) {
                            assert.isTrue(r)
                        })
                    })
                })
            })
        })

        it("should multisig change requirement", function() {
            return wallet.m_required.call().then(function(r) {
                assert.equal(r,2)
                return wallet.changeRequirement(3).then(function() {
                    return wallet.changeRequirement(3,{from:owner1}).then(function() {
                        return wallet.m_required.call().then(function (r) {
                            assert.equal(r, 3)
                        })
                    })
                })
            })
        })

        it("should multisig kill and transfer funds", function() {
            return coin.balanceOf.call(wallet.address).then(function (r) {
                const wallet_erc20_balance = r
                const wallet_eth_balance = web3.eth.getBalance(wallet.address)
                const old_balance = web3.eth.getBalance(owner4)
                return wallet.kill(owner4, {from: owner}).then(function () {
                    return wallet.kill(owner4, {from: owner1}).then(function () {
                        return wallet.kill.call(owner4, {from: owner2}).then(function (r) {
                            return wallet.kill(owner4, {from: owner2}).then(function () {
                                return coin.balanceOf.call(owner4).then(function (r2) {
                                    const new_balance = web3.eth.getBalance(owner4)
                                    assert(r, 1)
                                    assert.isTrue(new_balance.equals(old_balance.add(wallet_eth_balance)))
                                    assert.isTrue(wallet_erc20_balance.equals(r2))
                                })
                            })
                        })
                    })
                })
            })
        })

        it("should allow to set multisig oracle address for owner", function() {
            return Setup.walletsManager.setOracleAddress.call(owner2).then(function (r) {
                return Setup.walletsManager.setOracleAddress(owner2, {
                    from: owner,
                    gas: 3000000
                }).then(function (tx) {
                    return Setup.walletsManager.getOracleAddress.call().then(function (r2) {
                        assert.equal(r,ErrorsEnum.OK)
                        assert.equal(r2, owner2)
                    })
                })
            })
        })

        it("shouldn't allow to set multisig oracle address for nonowner", function() {
            return Setup.walletsManager.setOracleAddress.call(owner3).then(function (r) {
                return Setup.walletsManager.setOracleAddress(owner3, {
                    from: owner1,
                    gas: 3000000
                }).then(function (tx) {
                    return Setup.walletsManager.getOracleAddress.call().then(function (r2) {
                        assert.equal(r,ErrorsEnum.OK)
                        assert.equal(r2, owner2)
                    })
                })
            })
        })

        it("should allow to set multisig oracle price for owner", function() {
            return Setup.walletsManager.setOraclePrice.call(10).then(function (r) {
                return Setup.walletsManager.setOraclePrice(10, {
                    from: owner,
                    gas: 3000000
                }).then(function (tx) {
                    return Setup.walletsManager.getOraclePrice.call().then(function (r2) {
                        assert.equal(r,ErrorsEnum.OK)
                        assert.equal(r2, 10)
                    })
                })
            })
        })

        it("shouldn't allow to set multisig oracle price for nonowner", function() {
            return Setup.walletsManager.setOraclePrice.call(20).then(function (r) {
                return Setup.walletsManager.setOraclePrice(20, {
                    from: owner1,
                    gas: 3000000
                }).then(function (tx) {
                    return Setup.walletsManager.getOraclePrice.call().then(function (r2) {
                        assert.equal(r,ErrorsEnum.OK)
                        assert.equal(r2, 10)
                    })
                })
            })
        })

        it("can create new 2FA Wallet contract", function() {
            return Setup.walletsManager.create2FAWallet.call(0).then(function(r1) {
                return Setup.walletsManager.create2FAWallet(0, {
                    from: owner,
                    gas: 3000000
                }).then((tx) => {
                    const walletCreatedEvents = eventsHelper.extractEvents(tx, "WalletCreated")
                    assert.notEqual(walletCreatedEvents.length, 0)
                    const walletAddress = walletCreatedEvents[0].args.wallet
                    wallet2FA = walletAddress;
                    return Wallet.at(walletAddress).then(function(instance) {
                        return instance.m_required.call().then(function(r2) {
                            return instance.m_numOwners.call().then(function(r3) {
                                assert.equal(r1, ErrorsEnum.OK)
                                assert.equal(r2, 2)
                                assert.equal(r3, 2)
                            })
                        })
                    })
                })
            })
        })

        it("can't add owner to 2FA Wallet", function() {
            return Wallet.at(wallet2FA).then(function(instance) {
                return instance.addOwner.call(owner1).then(function (r) {
                    assert.equal(r, 14010)
                })
            })
        })

        it("can't change owner to 2FA Wallet", function() {
            return Wallet.at(wallet2FA).then(function(instance) {
                return instance.changeOwner.call(owner2, owner3).then(function (r) {
                    assert.equal(r, 14010)
                })
            })
        })

        it("can't remove owner to 2FA Wallet", function() {
            return Wallet.at(wallet2FA).then(function(instance) {
                return instance.removeOwner.call(owner1).then(function (r) {
                    assert.equal(r, 14010)
                })
            })
        })

        it("can't change requirement for 2FA Wallet", function() {
            return Wallet.at(wallet2FA).then(function(instance) {
                return instance.changeRequirement.call(owner1).then(function (r) {
                    assert.equal(r, 14010)
                })
            })
        })

        it("can create timelocked Wallet contract", function() {
            return clock.time.call()
                .then(_time => currentTime = _time)
                .then(() => console.log("Testrpc current date:", secondsToDate(currentTime)))
                .then(() => {
                    var currentDate = secondsToDate(currentTime)
                    currentDate.setMonth(currentDate.getMonth() + 5)
                    return Setup.walletsManager.createWallet.call([owner],1, currentDate.valueOf() / 1000 ).then(function(r1) {
                        return Setup.walletsManager.createWallet([owner],1, currentDate.valueOf() / 1000, {
                            from: owner,
                            gas: 3000000
                        }).then((tx) => {
                            const walletCreatedEvents = eventsHelper.extractEvents(tx, "WalletCreated")
                            assert.notEqual(walletCreatedEvents.length, 0)
                            const walletAddress = walletCreatedEvents[0].args.wallet
                            web3.eth.sendTransaction({to: walletAddress, value: 10000, from: accounts[0]})
                            balanceETH = web3.eth.getBalance(walletAddress)
                            assert.equal(balanceETH, 10000)
                            return Wallet.at(walletAddress).then(function (instance) {
                                return instance.m_required.call().then(function (r2) {
                                    return instance.m_numOwners.call().then(function (r3) {
                                        return instance.releaseTime.call().then(function (r4) {
                                            assert.equal(r1, ErrorsEnum.OK)
                                            assert.equal(r2, 1)
                                            assert.equal(r3, 1)
                                            assert.equal(r4,currentDate.valueOf() / 1000)
                                            return instance.transfer.call(owner3, 6000, 'ETH').then(function (r) {
                                                assert.equal(r, 14020)
                                                currentDate.setMonth(currentDate.getMonth() + 1)
                                                return timeMachine.jump(currentDate.getTime() / 1000 - currentTime).then(function () {
                                                    return clock.time.call().then(_time2 => {
                                                        return instance.transfer.call(owner3, 6000, 'ETH').then(function (r2) {
                                                            assert.equal(r2, ErrorsEnum.OK)
                                                        })
                                                    })
                                                })
                                            })
                                        })

                                    })
                                })
                            })
                        })
                    })
                })
        })

    })
})

let secondsToDate = (seconds) => {
    var t = new Date(1970, 0, 1); t.setSeconds(seconds);
    return t;
}
