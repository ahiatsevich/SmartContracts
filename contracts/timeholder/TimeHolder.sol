/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.21;


import "./TimeHolderEmitter.sol";
import "../core/common/RolesBaseManager.sol";
import "../core/common/ListenerInterface.sol";
import {ERC20Interface as Asset} from "../core/erc20/ERC20Interface.sol";
import {ERC20Manager as ERC20Service} from "../core/erc20/ERC20Manager.sol";
import "./DepositWalletInterface.sol";
import "./ERC20DepositStorage.sol";
import "../core/lib/SafeMath.sol";


/// @title TimeHolder
/// @notice Contract allows to block some amount of shares' balance to unlock
/// functionality inside a system.
contract TimeHolder is RolesBaseManager, TimeHolderEmitter {

    using SafeMath for uint;

    /** Error codes */

    uint constant TIMEHOLDER_ALREADY_ADDED = 12000;
    uint constant TIMEHOLDER_TRANSFER_FAILED = 12003;
    uint constant TIMEHOLDER_INSUFFICIENT_BALANCE = 12006;
    uint constant TIMEHOLDER_LIMIT_EXCEEDED = 12007;
    uint constant TIMEHOLDER_LOCK_LIMIT_EXCEEDED = 12008;
    uint constant TIMEHOLDER_INSUFFICIENT_LOCKED_BALANCE = 12009;
    uint constant TIMEHOLDER_ONLY_REGISTERED_SHARES = 12010;
    uint constant TIMEHOLDER_NO_REGISTERED_UNLOCK_FOUND = 12011;
    uint constant TIMEHOLDER_UNLOCK_LIMIT_EXCEEDED = 12012;
    uint constant TIMEHOLDER_INVALID_INVOCATION = 12013;
    uint constant TIMEHOLDER_REGISTRATION_ID_EXISTS = 12014;
    uint constant TIMEHOLDER_WRONG_SECRET = 12015;


    /** Storage keys */

    /// @dev Contains addresses of tokens that are used as shares
    StorageInterface.AddressesSet sharesTokenStorage;
    /// @dev Mapping of (token address => limit value) for storing deposit limits
    StorageInterface.AddressUIntMapping limitsStorage;
    /// @dev Mapping of (token address => list of listeners) for holding list of listeners for each share token
    StorageInterface.AddressOrderedSetMapping listeners;
    /// @dev Address of TimeHolder wallet
    StorageInterface.Address walletStorage;
    /// @dev Address of fee destination
    StorageInterface.Address feeWalletStorage;
    /// @dev Address of ERC20DepositStorage contract
    StorageInterface.Address erc20DepositStorage;

    /// @dev Guards invokations only for FeatureManager
    modifier onlyFeatureFeeManager {
        require(msg.sender == lookupManager("FeatureFeeManager"));
        _;
    }

    /// @dev only token registered in whitelist
    modifier onlyAllowedToken(address _token) {
        if (!store.includes(sharesTokenStorage, _token)) {
            assembly {
                mstore(0, 12010) // TIMEHOLDER_ONLY_REGISTERED_SHARES
                return(0, 32)
            }
        }
        _;
    }

    /// @dev Guards from accessing with registered ID key
    modifier onlyNotRegisteredUnlock(bytes32 _registrationId) {
        if (getDepositStorage().isUnlockRegistered(_registrationId)) {
            assembly {
                mstore(0, 12014) // TIMEHOLDER_REGISTRATION_ID_EXISTS
                return(0, 32)
            }
        }
        _;
    }

    /// @dev Guards from accessing with not registered ID key
    modifier onlyRegisteredUnlock(bytes32 _registrationId) {
        if (!getDepositStorage().isUnlockRegistered(_registrationId)) {
            assembly {
                mstore(0, 12011) // TIMEHOLDER_NO_REGISTERED_UNLOCK_FOUND
                return(0, 32)
            }
        }
        _;
    }

    /// @dev Guards from accessing with wrong secret
    modifier onlyWithSecret(bytes32 _registrationId, bytes32 _secret) {
        bytes32 _secretLock = getDepositStorage().getRegisteredSecretLock(_registrationId);
        if (keccak256(_secret) != _secretLock) {
            assembly {
                mstore(0, 12015) // TIMEHOLDER_WRONG_SECRET
                return(0, 32)
            }
        }
        _;
    }

    /// @notice Constructor
    function TimeHolder(Storage _store, bytes32 _crate) RolesBaseManager(_store, _crate) public {
        sharesTokenStorage.init("sharesContractsStorage_v2");
        limitsStorage.init("limitAmountsStorage_v2");
        listeners.init("listeners_v2");
        walletStorage.init("timeHolderWalletStorage");
        feeWalletStorage.init("timeHolderFeeWalletStorage");
        erc20DepositStorage.init("erc20DepositStorage");
    }

    /// @notice Init TimeHolder contract.
    /// @param _contractsManager address.
    /// @return result code of an operation
    function init(
        address _contractsManager,
        address _defaultToken,
        address _wallet,
        address _feeWallet,
        address _erc20DepositStorage
    )
    onlyContractOwner
    public
    returns (uint)
    {
        require(_defaultToken != 0x0);
        require(_wallet != 0x0);
        require(_feeWallet != 0x0);
        require(_erc20DepositStorage != 0x0);

        RolesBaseManager.init(_contractsManager, "TimeHolder");

        store.set(walletStorage, _wallet);
        store.set(feeWalletStorage, _feeWallet);
        store.set(erc20DepositStorage, _erc20DepositStorage);

        store.add(sharesTokenStorage, _defaultToken);
        store.set(limitsStorage, _defaultToken, 2**255);

        ERC20DepositStorage(_erc20DepositStorage).setSharesContract(_defaultToken);

        return OK;
    }

    /// @notice Gets shares amount deposited by a particular shareholder.
    /// @param _depositor shareholder address
    /// @return deposited shares amount
    function depositBalance(address _depositor) public view returns (uint) {
        return getDepositBalance(getDefaultShares(), _depositor);
    }

    /// @notice Gets shares amount locked by a particular shareholder
    /// @return locked shares amount
    function lockedBalance() public view returns (uint) {
        return getLockedBalance(getDefaultShares());
    }

    /// @notice Gets balance of tokens deposited to TimeHolder
    /// @param _token token to check
    /// @param _depositor shareholder address
    /// @return shares amount
    function getDepositBalance(
        address _token,
        address _depositor
    )
    public
    view
    returns (uint)
    {
        return getDepositStorage().depositBalance(_token, _depositor);
    }

    /// @notice Gets balance of tokens locked in TimeHolder
    /// @param _token token to check
    /// @return shares amount
    function getLockedBalance(
        address _token
    )
    public
    view
    returns (uint)
    {
        return getDepositStorage().lockBalance(_token);
    }

    /// @notice Adds ERC20-compatible token symbols and put them in the whitelist to be used then as
    /// shares for other contracts and allow users to deposit for this share.
    /// @dev Allowed only for CBEs
    /// @param _whitelist list of token addresses that will be allowed to be deposited in TimeHolder
    /// @param _limits list of limits
    function allowShares(address[] _whitelist, uint[] _limits)
    onlyAuthorized
    external
    {
        require(_whitelist.length == _limits.length);

        ERC20Service erc20Service = lookupERC20Service();
        for (uint _idx = 0; _idx < _whitelist.length; ++_idx) {
            require(erc20Service.isTokenExists(_whitelist[_idx]));

            store.add(sharesTokenStorage, _whitelist[_idx]);
            store.set(limitsStorage, _whitelist[_idx], _limits[_idx]);

            _emitSharesWhiteListAdded(_whitelist[_idx], _limits[_idx]);
        }
    }

    /// @notice Removes ERC20-compatible token symbols from TimeHolder so they will be removed
    /// from the whitelist and will not be accessible to be used as shares.
    /// All deposited amounts still will be available to withdraw.
    /// @dev Allowed only for CBEs
    /// @param _blacklist list of token addresses that will be removed from TimeHolder
    function denyShares(address[] _blacklist)
    onlyAuthorized
    external
    {
        for (uint _idx = 0; _idx < _blacklist.length; ++_idx) {
            store.remove(sharesTokenStorage, _blacklist[_idx]);
            store.set(limitsStorage, _blacklist[_idx], 0);

            _emitSharesWhiteListRemoved(_blacklist[_idx]);
        }
    }

    /// @notice Adds provided listener to observe changes of passed symbol when some amount will be deposited/withdrawn.
    /// Checks passed listener for HolderListenerInterface compatibility.
    /// @dev Allowed only for CBEs
    /// @param _token token symbol to watch deposits and withdrawals
    /// @param _listener address of a listener to add
    function addListener(address _token, address _listener)
    onlyAuthorized
    external
    {
        require(_token != 0x0);
        require(_listener != 0x0);

        store.add(listeners, bytes32(_token), _listener);

        _emitListenerAdded(_listener, _token);
    }

    /// @notice Removes provided listener from observing changes of passed symbol.
    /// @dev Allowed only for CBEs
    /// @param _token token symbol to stop watching by a listener
    /// @param _listener address of a listener to remove
    function removeListener(address _token, address _listener)
    onlyAuthorized
    external
    {
        store.remove(listeners, bytes32(_token), _listener);

        _emitListenerRemoved(_listener, _token);
    }

    /// @notice Checks if provided address is actual listener for token updates
    /// @param _token token address which changes listen to
    /// @param _listener address to check
    function isListener(address _token, address _listener) public view returns (bool) {
        return store.includes(listeners, bytes32(_token), _listener);
    }

    /// @notice Sets fee wallet address.
    /// @param _feeWallet wallet address to which fee will be directed
    function setFeeWallet(address _feeWallet)
    onlyAuthorized
    public
    {
        store.set(feeWalletStorage, _feeWallet);
    }

    /// @notice Deposits shares with provided symbol and prove possesion.
    /// Amount should be less than or equal to current allowance value.
    ///
    /// Proof should be repeated for each active period. To prove possesion without
    /// depositing more shares, specify 0 amount.
    ///
    /// @param _token token address for shares
    /// @param _amount amount of shares to deposit, or 0 to just prove.
    ///
    /// @return result code of an operation.
    function deposit(address _token, uint _amount) public returns (uint) {
        return depositFor(_token, msg.sender, _amount);
    }

    /// @notice Locks deposited shares with provided amount.
    /// Amount should be less or equal to current deposited balance.
    /// Used for shares disabling, for example, cross-chain operations.
    /// Deposited balance will be constantly decreased for a locked amount.
    /// Emits 'Lock' event.
    /// @param _token token address of a share
    /// @param _amount amount of shares to lock
    /// @return result code of an operation
    function lock(
        address _token, 
        uint _amount
    )
    onlyAllowedToken(_token)
    public 
    returns (uint) 
    {
        address _target = msg.sender;
        uint _depositBalance = getDepositBalance(_token, _target);
        if (_amount > _depositBalance) {
            return _emitError(TIMEHOLDER_LOCK_LIMIT_EXCEEDED);
        }

        getDepositStorage().lock(_token, _target, _amount);

        _goThroughListeners(_token, _target, _amount, _notifyWithdrawListener);
        
        _emitLock(_token, _target, _amount);
        return OK;
    } 

    /// @notice Deposit own shares and prove possession for arbitrary shareholder.
    /// Amount should be less than or equal to caller current allowance value.
    ///
    /// Proof should be repeated for each active period. To prove possesion without
    /// depositing more shares, specify 0 amount.
    ///
    /// This function meant to be used by some backend application to prove shares possesion
    /// of arbitrary shareholders.
    ///
    /// @param _token token address for shares
    /// @param _target to deposit and prove for.
    /// @param _amount amount of shares to deposit, or 0 to just prove.
    ///
    /// @return result code of an operation.
    function depositFor(address _token, address _target, uint _amount)
    onlyAllowedToken(_token)
    public
    returns (uint)
    {
        if (_amount > getLimitForToken(_token)) {
            return _emitError(TIMEHOLDER_LIMIT_EXCEEDED);
        }

        if (!DepositWalletInterface(wallet()).deposit(_token, msg.sender, _amount)) {
            return _emitError(TIMEHOLDER_TRANSFER_FAILED);
        }

        getDepositStorage().depositFor(_token, _target, _amount);

        _goThroughListeners(_token, _target, _amount, _notifyDepositListener);
        _emitDeposit(_token, _target, _amount);
        return OK;
    }

    /// @notice Withdraw shares from the contract, updating the possession proof in active period.
    /// @param _token token symbol to withdraw from.
    /// @param _amount amount of shares to withdraw.
    /// @return _resultCode result code of an operation.
    function withdrawShares(address _token, uint _amount)
    public
    returns (uint _resultCode)
    {
        _resultCode = _withdrawShares(_token, msg.sender, msg.sender, _amount);
        if (_resultCode != OK) {
            return _emitError(_resultCode);
        }

        _emitWithdrawShares(_token, msg.sender, _amount, msg.sender);
    }

    /// @notice Registers receiver to allow to unlock locked tokens.
    /// First of two-steps operation of unlocking tokens.
    /// Should be called only by specific role (middleware actor or root user).
    /// Function execution protected by a multisignature.
    /// @param _registrationId unique identifier to associate this unlock operation
    /// @param _token token address which was previously locked for some amount
    /// @param _amount amount of tokens that is supposed to be unlocked
    /// @param _receiver user who are going to receive locked tokens
    /// @param _secretLock hashed secret that user should provide to unlock his tokens back
    /// @return _resultCode. result code of an operation
    function registerUnlockShares(
        bytes32 _registrationId,
        address _token, 
        uint _amount,
        address _receiver,
        bytes32 _secretLock
    )
    onlyAuthorizedRole
    onlyNotRegisteredUnlock(_registrationId)
    external 
    returns (uint _resultCode) 
    {
        require(_token != 0x0);
        require(_amount != 0);
        require(_receiver != 0x0);
        require(_secretLock != bytes32(0));

        _resultCode = multisig();
        if (OK != _resultCode) {
            return _emitError(_resultCode);
        }

        uint _lockedBalance = getLockedBalance(_token);
        if (_amount > _lockedBalance) {
            return _emitError(TIMEHOLDER_UNLOCK_LIMIT_EXCEEDED);
        }

        getDepositStorage().registerUnlock(_registrationId, _token, _amount, _receiver, _secretLock);

        _emitRegisterUnlockShares(_registrationId, _token, _amount, _receiver);
        return OK;
    }

    /// @notice Unlocks shares in TimeHolder and deposit them back to user's account.
    /// Second of two-steps operation of unlocking locked tokens.
    /// Could be called by anyone: tokens will be transferred only to an actual receiver.
    /// To perform 'unlock' an amount of locked tokens on this very moment should be greater
    /// or equal to registered amount of tokens to unlock.
    /// @param _registrationId unique identifier; was created on 'registerUnlockShares' step
    /// @param _secret secret that was hashed to prove an actual ownership rights
    /// @return result code of an operation
    function unlockShares(bytes32 _registrationId, bytes32 _secret)
    onlyRegisteredUnlock(_registrationId)
    onlyWithSecret(_registrationId, _secret)
    public 
    returns (uint) 
    {
        address _token;
        uint _amount;
        address _receiver;
        (_token, _amount, _receiver) = getDepositStorage().getRegisteredUnlock(_registrationId);
        uint _lockedAmount = getLockedBalance(_token);

        if (_amount > _lockedAmount) {
            return _emitError(TIMEHOLDER_UNLOCK_LIMIT_EXCEEDED);
        }
        
        getDepositStorage().unlockShares(_registrationId);

        _goThroughListeners(_token, _receiver, _amount, _notifyDepositListener);

        _emitUnlockShares(_token, msg.sender, _amount, _receiver);
        return OK;
    }

    /// @notice Unlocks locked tokens without a neet to register through middleware.
    /// Supposed to be used as 'the last resort' solution to withdraw tokens that got stuck
    /// in TimeHolder.
    /// The only receiver is contractOwner.
    /// @param _token token with locked balance
    /// @param _amount amount of locked token to unlock
    /// @return result code of an operation
    function forceUnlockShares(
        address _token, 
        uint _amount
    ) 
    onlyContractOwner 
    external 
    returns (uint) 
    {
        require(_token != 0x0);
        require(_amount != 0);

        uint _lockedAmount = getLockedBalance(_token);
        if (_amount > _lockedAmount) {
            return _emitError(TIMEHOLDER_UNLOCK_LIMIT_EXCEEDED);
        }

        address _receiver = contractOwner;
        if (!DepositWalletInterface(wallet()).withdraw(_token, _receiver, _amount)) {
            return _emitError(TIMEHOLDER_TRANSFER_FAILED);
        }

        getDepositStorage().directUnlockShares(_token, _amount);

        _emitUnlockShares(_token, msg.sender, _amount, _receiver);
        return OK;
    }

    /// @notice Unregisters (declines) previously registered unlock operation.
    /// After unregistration no one could perform 'unlockShares'.
    /// Registration identifier will be released and will be available to 'registerUnlockshares'.
    /// Should be called only by specific role (middleware actor or root user).
    /// @param _registrationId unique identifier; was created on 'registerUnlockShares' step
    /// @return result code of an operation
    function unregisterUnlockShares(bytes32 _registrationId)
    onlyAuthorizedRole
    onlyRegisteredUnlock(_registrationId)
    public 
    returns (uint) 
    {
        getDepositStorage().unregisterUnlockShares(_registrationId);

        _emitUnregisterUnlockShares(_registrationId);
        return OK;
    }

    /// @notice Checks state for registered unlock request
    /// @param _registrationId unique identifier; was created on 'registerUnlockShares' step
    /// @return {
    ///     "_token": "token address",   
    ///     "_amount": "amount of tokens that were locked",   
    ///     "_receiver": "holder address"   
    /// }
    function checkUnlockedShares(bytes32 _registrationId) public view returns (
        address _token,
        uint _amount,
        address _receiver
    ) {
        return getDepositStorage().getRegisteredUnlock(_registrationId);
    }

    /// @notice Force Withdraw Shares
    /// Only CBE members are permited to call this function.
    /// Multisig concensus is required to withdraw shares from shareholder "_from"
    /// and send it to "_to".
    function forceWithdrawShares(address _from, address _token, uint _amount)
    onlyContractOwner
    public
    returns (uint _resultCode) 
    {
        _resultCode = _withdrawShares(_token, _from, contractOwner, _amount);
        if (_resultCode != OK) {
            return _emitError(_resultCode);
        }

        _emitWithdrawShares(_token, _from, _amount, contractOwner);
    }

    /// @notice Provides a way to support getting additional fee for using features of the system.
    /// @param _account holder of deposits, will pay for using a features
    /// @param _amount size of a fee
    /// @return _resultCode result code of the operation
    function takeFeatureFee(address _account, uint _amount)
    onlyFeatureFeeManager
    public
    returns (uint _resultCode)
    {
        require(_account != 0x0);
        address _feeWallet = feeWallet();
        assert(_feeWallet != 0x0);

        _resultCode = _withdrawShares(getDefaultShares(), _account, _feeWallet, _amount);
        if (_resultCode != OK) {
            return _emitError(_resultCode);
        }

        _emitFeatureFeeTaken(_account, _feeWallet, _amount);
    }

    /// @notice Gets an associated wallet for the time holder
    function wallet() public view returns (address) {
        return store.get(walletStorage);
    }

    /// @notice Gets an associated fee wallet for the time holder
    function feeWallet() public view returns (address) {
        return store.get(feeWalletStorage);
    }

    /// @notice Total amount of shares for provided symbol
    /// @param _token token address to check total shares amout
    /// @return total amount of shares
    function totalShares(address _token) public view returns (uint) {
        return getDepositStorage().totalShares(_token);
    }

    /// @notice Number of shareholders
    /// @return number of shareholders
    function defaultShareholdersCount() public view returns (uint) {
        return getDepositStorage().shareholdersCount(getDefaultShares());
    }

    /// @notice Number of shareholders
    /// @return number of shareholders
    function shareholdersCount(address _token) public view returns (uint) {
        return getDepositStorage().shareholdersCount(_token);
    }

    /// @notice Returns deposit/withdraw limit for shares with provided symbol
    /// @param _token token address to get limit
    /// @return limit number for specified shares
    function getLimitForToken(address _token) public view returns (uint) {
        return store.get(limitsStorage, _token);
    }

    /// @notice Gets shares contract that is set up as default (usually TIMEs)
    function getDefaultShares() public view returns (address) {
        return getDepositStorage().getSharesContract();
    }

    /// @notice Withdraws deposited amount of tokens from account to a receiver address.
    /// Emits its own errorCodes if some will be encountered.
    /// @param _account an address that have deposited tokens
    /// @param _receiver an address that will receive tokens from _account
    /// @param _amount amount of tokens to withdraw to the _receiver
    /// @return result code of the operation
    function _withdrawShares(
        address _token,
        address _account,
        address _receiver,
        uint _amount
    )
    internal
    returns (uint)
    {
        uint _depositBalance = getDepositBalance(_token, _account);
        if (_depositBalance == 0 || _amount > _depositBalance) {
            return _emitError(TIMEHOLDER_INSUFFICIENT_BALANCE);
        }

        if (!DepositWalletInterface(wallet()).withdraw(_token, _receiver, _amount)) {
            return _emitError(TIMEHOLDER_TRANSFER_FAILED);
        }

        getDepositStorage().withdrawShares(_token, _account, _amount);

        _goThroughListeners(_token, _account, _amount, _notifyWithdrawListener);
        return OK;
    }

    /// @dev Notifies listener about depositing token with symbol
    function _notifyDepositListener(address _listener, address _token, address _target, uint _amount, uint _balance)
    private
    {
        HolderListenerInterface(_listener).tokenDeposit(_token, _target, _amount, _balance);
    }

    /// @dev Notifies listener about withdrawing token with symbol
    function _notifyWithdrawListener(address _listener, address _token, address _target, uint _amount, uint _balance)
    private
    {
        HolderListenerInterface(_listener).tokenWithdrawn(_token, _target, _amount, _balance);
    }

    /// @dev Iterates through listeners of provided symbol and notifies by calling notification function
    function _goThroughListeners(
        address _token,
        address _target,
        uint _amount,
        function (address, address, address, uint, uint) _notification)
    private
    {
        uint _availableBalance = getDepositBalance(_token, _target);
        StorageInterface.Iterator memory iterator = store.listIterator(listeners, bytes32(_token));
        for (uint i = 0; store.canGetNextWithIterator(listeners, iterator); ++i) {
            address _listener = store.getNextWithIterator(listeners, iterator);
            _notification(_listener, _token, _target, _amount, _availableBalance);
        }
    }

    function lookupERC20Service() internal view returns (ERC20Service) {
        return ERC20Service(lookupManager("ERC20Manager"));
    }

    /// @dev Gets pair of depositStorage and default token set up for a deposits
    /// @return {
    ///     "_depositStorage": "deposit storage contract",
    ///     "_token": "default shares contract",
    /// }
    function getDepositStorage() private view returns (ERC20DepositStorage _depositStorage) {
        _depositStorage = ERC20DepositStorage(store.get(erc20DepositStorage));
    }    

    /** Event emitting */

    function _emitDeposit(address _token, address _who, uint _amount) private {
        TimeHolderEmitter(getEventsHistory()).emitDeposit(_token, _who, _amount);
    }

    function _emitLock(address _token, address _who, uint _amount) private {
        TimeHolderEmitter(getEventsHistory()).emitLock(_token, _who, _amount);
    }

    function _emitWithdrawShares(address _token, address _who, uint _amount, address _receiver) private {
        TimeHolderEmitter(getEventsHistory()).emitWithdrawShares(_token, _who, _amount, _receiver);
    }

    function _emitRegisterUnlockShares(bytes32 _registrationId, address _token, uint _amount, address _receiver) private {
        TimeHolderEmitter(getEventsHistory()).emitRegisterUnlockShares(_registrationId, _token, _amount, _receiver);
    }

    function _emitUnregisterUnlockShares(bytes32 _registrationId) private {
        TimeHolderEmitter(getEventsHistory()).emitUnregisterUnlockShares(_registrationId);
    }

    function _emitUnlockShares(address _token, address _who, uint _amount, address _receiver) private {
        TimeHolderEmitter(getEventsHistory()).emitUnlockShares(_token, _who, _amount, _receiver);
    }

    function _emitListenerAdded(address _listener, address _token) private {
        TimeHolderEmitter(getEventsHistory()).emitListenerAdded(_listener, _token);
    }

    function _emitListenerRemoved(address _listener, address _token) private {
        TimeHolderEmitter(getEventsHistory()).emitListenerRemoved(_listener, _token);
    }

    function _emitFeatureFeeTaken(address _from, address _to, uint _amount) private {
        TimeHolderEmitter(getEventsHistory()).emitFeatureFeeTaken(_from, _to, _amount);
    }

    function _emitSharesWhiteListAdded(address _token, uint _limit) private {
        TimeHolderEmitter(getEventsHistory()).emitSharesWhiteListChanged(_token, _limit, true);
    }

    function _emitSharesWhiteListRemoved(address _token) private {
        TimeHolderEmitter(getEventsHistory()).emitSharesWhiteListChanged(_token, 0, false);
    }

    function _emitError(uint _errorCode) private returns (uint) {
        if (_errorCode != OK && _errorCode != MULTISIG_ADDED) {
            TimeHolderEmitter(getEventsHistory()).emitError(_errorCode);
        }
        return _errorCode;
    }
}
