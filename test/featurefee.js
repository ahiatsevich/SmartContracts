const Setup = require('../setup/setup')
const ErrorsEnum = require("../common/errors")
const eventsHelper = require('./helpers/eventsHelper')
const FeatureFeeManager = artifacts.require('./FeatureFeeManager.sol')
const AssetDonator = artifacts.require('./AssetDonator.sol')
const WalletsManager = artifacts.require('./WalletsManager.sol')
const ERC20Manager = artifacts.require('./ERC20Manager.sol')
const TimeHolder = artifacts.require('./TimeHolder.sol')
const ChronoBankAssetProxy = artifacts.require('./ChronoBankAssetProxy.sol')

contract("FeatureFeeManager", function(accounts) {
    let featureFeeManager;
    let assetDonator;
    let walletsManager;
    let timeHolder;
    let timeHolderWallet;
    let feeHolderWallet;
    let TIME;

    let timeHolder1 = accounts[2];
    let timeHolder2 = accounts[3];
    let timeHolder3 = accounts[4];
    let timeHolder4 = accounts[5];

    const CreateWalletFeatureRequiredBalance = 2;
    const CreateWalletFeatureFee = 1;

    const AddWalletFeatureRequiredBalance = 4;
    const AddWalletFeatureFee = 3;

    before("setup", function(done) {
        FeatureFeeManager.deployed()
        .then(_featureFeeManager => featureFeeManager = _featureFeeManager)
        .then(() => TimeHolder.deployed())
        .then(_timeHolder => timeHolder = _timeHolder)
        .then(() => timeHolder.wallet.call())
        .then(_timeHolderWallet => timeHolderWallet = _timeHolderWallet)
        .then(() => timeHolder.feeWallet.call())
        .then(_feeHolderWallet => feeHolderWallet = _feeHolderWallet)
        .then(() => ERC20Manager.deployed())
        .then(erc20Manager => erc20Manager.getTokenAddressBySymbol.call("TIME"))
        .then(timeAddress => ChronoBankAssetProxy.at(timeAddress))
        .then(_TIME => TIME = _TIME)
        .then(() => AssetDonator.deployed())
        .then((_assetDonator) => assetDonator = _assetDonator)

        .then(() => WalletsManager.deployed())
        .then((_walletsManager) => walletsManager = _walletsManager)
        .then(() => {
            let sig = walletsManager.contract.createWallet.getData([0],0,0).slice(0, 10);
            return featureFeeManager.setFeatureFee(WalletsManager.address, sig, CreateWalletFeatureRequiredBalance, CreateWalletFeatureFee);
        })

        .then(() => {
            let sig = walletsManager.contract.addWallet.getData(0).slice(0, 10);
            return featureFeeManager.setFeatureFee(WalletsManager.address, sig, AddWalletFeatureRequiredBalance, AddWalletFeatureFee);
        })

        .then(() => assetDonator.sendTime({from: timeHolder1}))
        .then(() => TIME.approve(timeHolderWallet, 10000, {from: timeHolder1}))
        .then(() => timeHolder.deposit(10000, {from : timeHolder1}))
        .then(() => Setup.setup(done))
    })

    it("should allow to execute WalletsManager#createWallet() account with deposit > feature_price", async () => {
        let holderBalance;
        let feeWalletBalance;

        return Promise.resolve()
        .then(() => timeHolder.depositBalance.call(timeHolder1))
        .then(_balance => {
            holderBalance = _balance;
            assert.isTrue(holderBalance >= CreateWalletFeatureRequiredBalance)
        })
        .then(() => TIME.balanceOf(feeHolderWallet))
        .then(_feeWalletBalance => feeWalletBalance = _feeWalletBalance)
        .then(() => walletsManager.createWallet.call([timeHolder1, timeHolder2], 1, 0,  {from :timeHolder1}))
        .then(r => assert.equal(r, ErrorsEnum.OK))
        .then(() => walletsManager.createWallet([timeHolder1, timeHolder2], 1, 0,  {from :timeHolder1}))
        .then(tx => eventsHelper.extractEvents(tx, "WalletCreated"))
        .then(events => assert.equal(events.length, 1))
        .then(() => timeHolder.depositBalance.call(timeHolder1))
        .then(_balance => assert.equal(holderBalance - _balance, CreateWalletFeatureFee))
        .then(() => TIME.balanceOf(feeHolderWallet))
        .then(_feeWalletBalance => assert.equal(_feeWalletBalance - feeWalletBalance, CreateWalletFeatureFee))
    })

    it("should not allow to execute WalletsManager#createWallet() account with deposit < feature_price", async () => {
        let holderBalance;

        return Promise.resolve()
        .then(() => timeHolder.depositBalance.call(timeHolder4))
        .then(_balance => {
            holderBalance = _balance;
            assert.isTrue(holderBalance <= CreateWalletFeatureRequiredBalance)
        })
        .then(() => walletsManager.createWallet.call([timeHolder1, timeHolder2], 1, 0,  {from :timeHolder4}))
        .then(r => assert.equal(r, ErrorsEnum.FEATURE_IS_UNAVAILABE))
        .then(() => walletsManager.createWallet([timeHolder1, timeHolder2], 1, 0,  {from :timeHolder4}))
        .then(tx => eventsHelper.extractEvents(tx, "WalletCreated"))
        .then(events => assert.equal(events.length, 0))
        .then(() => timeHolder.depositBalance.call(timeHolder4))
        .then(_balance => assert.equal(holderBalance.toNumber(), _balance.toNumber()))
    })

    it("should allow to execute WalletsManager#addWallet() account with deposit > feature_price")

    it("should not allow to execute WalletsManager#addWallet() account with deposit < feature_price")

    it("should not take fee if WalletsManager#addWallet() execution is failed",  async () => {
        let holderBalance;
        let walletAddress;

        return Promise.resolve()
        .then(() => walletsManager.createWallet([timeHolder1, timeHolder2], 1, 0,  {from :timeHolder1}))
        .then(tx => eventsHelper.extractEvents(tx, "WalletCreated"))
        .then(events => walletAddress = events[0].args.wallet)

        .then(() => timeHolder.depositBalance.call(timeHolder1))
        .then(_balance => {
            holderBalance = _balance;
            assert.isTrue(holderBalance >= AddWalletFeatureRequiredBalance)
        })
        .then(() => walletsManager.addWallet.call(walletAddress, {from :timeHolder1}))
        .then(r => assert.equal(r, ErrorsEnum.ERROR_WALLET_EXISTS))
        .then(() => walletsManager.addWallet(walletAddress,  {from :timeHolder1}))
        .then(tx => eventsHelper.extractEvents(tx, "Error"))
        .then(events => assert.equal(events.length, 1))
        .then(() => timeHolder.depositBalance.call(timeHolder1))
        .then(_balance => assert.equal(holderBalance.toNumber(), _balance.toNumber()))
    })

    it("should allow to execute TokenManagementInterface#createAssetWithoutFee() account with deposit > feature_price")

    it("should not allow to execute TokenManagementInterface#createAssetWithoutFee() account with deposit < feature_price")

    it("should allow to execute TokenManagementInterface#createAssetWithFee() account with deposit > feature_price")

    it("should not allow to execute TokenManagementInterface#createAssetWithFee() account with deposit < feature_price")

    it("should allow to execute TokenManagementInterface#createCrowdsaleCampaign() account with deposit > feature_price")

    it("should not allow to execute TokenManagementInterface#createCrowdsaleCampaign() account with deposit < feature_price")

    it("should allow to execute PlatformManager#createPlatform() account with deposit > feature_price")

    it("should not allow to execute PlatformManager#createPlatform() account with deposit < feature_price")
})
