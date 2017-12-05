pragma solidity ^0.4.11;

import "../core/common/BaseManager.sol";
import "./WalletsManagerEmitter.sol";
import "../timeholder/FeatureFeeAdapter.sol";

contract WalletsFactoryInterface {
    function createWallet(address[] _owners, uint _required, address _contractsManager, address _eventsEmiter, bool _use2FA, uint _releaseTime) returns(address);
}

contract WalletInterface {
    bool public use2FA;
    function isOwner(address _addr) returns (bool);
}

contract MultiEventsHistoryInterface {
    function authorize(address _caller) returns(bool);
}

contract WalletsManager is WalletsManagerEmitter, FeatureFeeAdapter, BaseManager {
    uint constant ERROR_WALLET_INVALID_INVOCATION = 14000;
    uint constant ERROR_WALLET_EXISTS = 14001;
    uint constant ERROR_WALLET_OWNER_ONLY = 14002;
    uint constant ERROR_WALLET_CANNOT_ADD_TO_REGISTRY = 14003;
    uint constant ERROR_WALLET_UNKNOWN = 14004;

    StorageInterface.OrderedAddressesSet wallets;
    StorageInterface.Address walletsFactory;
    StorageInterface.Address oracleAddress;
    StorageInterface.UInt oraclePrice;

    function WalletsManager(Storage _store, bytes32 _crate) BaseManager(_store, _crate) {
        walletsFactory.init("walletsFactory");
        wallets.init('wallets');
        oracleAddress.init('oracleAddress');
        oraclePrice.init('oraclePrice');
    }

    function init(address _contractsManager, address _walletsFactory)
    public
    onlyContractOwner
    returns (uint)
    {
        BaseManager.init(_contractsManager, "WalletsManager");
        store.set(walletsFactory, _walletsFactory);
        return OK;
    }

    function kill(address[] tokens)
    public
    onlyContractOwner
    returns (uint)
    {
        withdrawnTokens(tokens,msg.sender);
        selfdestruct(msg.sender);
        return OK;
    }

    function getOraclePrice() public constant returns (uint) {
        return store.get(oraclePrice);
    }

    function getOracleAddress() public constant returns (address) {
        return store.get(oracleAddress);
    }

    function getWallets() public constant returns (address[] result, bool[] result2) {
        StorageInterface.Iterator memory iterator = store.listIterator(wallets);
        address wallet;
        result = new address[](store.count(wallets));
        result2 = new bool[](store.count(wallets));
        for(uint j = 0; store.canGetNextWithIterator(wallets, iterator);) {
            wallet = store.getNextWithIterator(wallets, iterator);
            if (isWalletOwner(wallet,msg.sender)) {
                result[j] = wallet;
                result2[j++] = WalletInterface(wallet).use2FA();
            }
        }
        return (result,result2);
    }

    function setOraclePrice(uint _price) external onlyAuthorized returns (uint) {
        store.set(oraclePrice,_price);
        return OK;
    }

    function setOracleAddress(address _address) external onlyAuthorized returns (uint) {
        store.set(oracleAddress,_address);
        return OK;
    }

    function createWallet(address[] _owners, uint _required, uint _releaseTime)
    public
    returns (uint errorCode)
    {
        return _createWallet(_owners, _required, _releaseTime, [uint(0)]);
    }

    function create2FAWallet(uint _releaseTime)
    public
    returns (uint errorCode)
    {
        return _create2FAWallet(_releaseTime, [uint(0)]);
    }

    /**
    *  Deletes sender from a list of wallets if present. Designed to be called only by wallet.
    */
    function removeWallet() public returns (uint) {
        if(!store.includes(wallets,msg.sender)) {
            return _emitError(ERROR_WALLET_UNKNOWN);
        }

        store.remove(wallets,msg.sender);
        return OK;
    }

    function addWallet(address _wallet) public returns (uint) {
        return _addWallet(_wallet, [uint(0)]);
    }

    function isWalletOwner(address _wallet, address _owner) internal returns (bool) {
        return WalletInterface(_wallet).isOwner(_owner);
    }

    function _addWallet(address _wallet, uint[1] memory _result)
    private
    featured(_result)
    returns (uint)
    {
        bool r = _wallet.call.gas(3000).value(0)(bytes4(sha3("isOwner(address)")),msg.sender);
        if(!r) {
            return _emitError(ERROR_WALLET_UNKNOWN);
        }
        if(store.includes(wallets,_wallet)) {
            return _emitError(ERROR_WALLET_EXISTS);
        }
        if(!isWalletOwner(_wallet,msg.sender)) {
            return _emitError(ERROR_WALLET_CANNOT_ADD_TO_REGISTRY);
        }

        store.add(wallets, _wallet);

        _emitWalletAdded(_wallet);

        _result[0] = OK;
        return OK;
    }

    function _createWallet(address[] _owners, uint _required, uint _releaseTime, uint[1] memory _result)
    private
    featured(_result)
    returns (uint errorCode)
    {
        WalletsFactoryInterface factory = WalletsFactoryInterface(store.get(walletsFactory));
        address _wallet = factory.createWallet(_owners,_required,contractsManager,getEventsHistory(), false, _releaseTime);
        MultiEventsHistoryInterface(getEventsHistory()).authorize(_wallet);
        store.add(wallets, _wallet);
        _emitWalletCreated(_wallet);

        _result[0] = OK;
        return OK;
    }

    function _create2FAWallet(uint _releaseTime, uint[1] memory _result)
    private
    featured(_result)
    returns (uint errorCode)
    {
        WalletsFactoryInterface factory = WalletsFactoryInterface(store.get(walletsFactory));
        address[] memory _owners = new address[](2);
        _owners[0] = msg.sender;
        _owners[1] = getOracleAddress();
        address _wallet = factory.createWallet(_owners,2,contractsManager,getEventsHistory(), true, _releaseTime);
        store.add(wallets, _wallet);
        _emitWalletCreated(_wallet);

        _result[0] = OK;
        return OK;
    }

    function _emitError(uint error) internal returns (uint) {
        WalletsManager(getEventsHistory()).emitError(error);
        return error;
    }

    function _emitWalletAdded(address wallet) internal {
        WalletsManager(getEventsHistory()).emitWalletAdded(wallet);
    }

    function _emitWalletCreated(address wallet) internal {
        WalletsManager(getEventsHistory()).emitWalletCreated(wallet);
    }

    function() {
        revert();
    }
}
