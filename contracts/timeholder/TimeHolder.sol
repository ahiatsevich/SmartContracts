pragma solidity ^0.4.11;

import "./TimeHolderEmmiter.sol";
import "../core/common/BaseManager.sol";
import "../core/common/ListenerInterface.sol";
import "../core/common/Deposits.sol";
import {ERC20Interface as Asset} from "../core/erc20/ERC20Interface.sol";
import "./DepositWalletInterface.sol";

contract TimeHolder is Deposits, TimeHolderEmmiter {

    uint constant ERROR_TIMEHOLDER_ALREADY_ADDED = 12000;
    uint constant ERROR_TIMEHOLDER_INVALID_INVOCATION = 12001;
    uint constant ERROR_TIMEHOLDER_INVALID_STATE = 12002;
    uint constant ERROR_TIMEHOLDER_TRANSFER_FAILED = 12003;
    uint constant ERROR_TIMEHOLDER_WITHDRAWN_FAILED = 12004;
    uint constant ERROR_TIMEHOLDER_DEPOSIT_FAILED = 12005;
    uint constant ERROR_TIMEHOLDER_INSUFFICIENT_BALANCE = 12006;
    uint constant ERROR_TIMEHOLDER_LIMIT_EXCEEDED = 12007;

    StorageInterface.OrderedAddressesSet listeners;
    StorageInterface.Address walletStorage;
    StorageInterface.Address feeWalletStorage;
    StorageInterface.UInt limitAmount;

    modifier onlyFeatureFeeManager() {
        if (msg.sender == lookupManager("FeatureFeeManager")) {
            _;
        }
    }

    function TimeHolder(Storage _store, bytes32 _crate) Deposits(_store, _crate) {
        listeners.init('listeners');
        limitAmount.init('limitAmount');
        feeWalletStorage.init("timeHolderFeeWalletStorage");
        walletStorage.init("timeHolderWalletStorage");
    }

    /**
     * Init TimeHolder contract.
     *
     *
     * @param _contractsManager address.
     * @param _sharesContract ERC20 token address to act as shares.
     *
     * @return success.
     */
    function init(address _contractsManager, address _sharesContract, address _wallet, address _feeWallet) onlyContractOwner returns (uint) {
        require(_wallet != 0x0);
        require(_sharesContract != 0x0);
        require(_feeWallet != 0x0);

        BaseManager.init(_contractsManager, "TimeHolder");

        store.set(sharesContractStorage, _sharesContract);
        store.set(limitAmount, 2**255);
        store.set(walletStorage, _wallet);
        store.set(feeWalletStorage, _feeWallet);

        return OK;
    }

    function destroy() onlyContractOwner {
        selfdestruct(msg.sender);
    }

    function addListener(address _listener) onlyAuthorized returns (uint) {
        //if(store.includes(listeners,_listener) || !_listener.call.gas(3000).value(0)(bytes4(sha3("deposit(address,uint256,uint256)")),this,0,0) || !_listener.call.gas(3000).value(0)(bytes4(sha3("withdrawn(address,uint256,uint256)")),this,0,0)) {
        //    return _emitError(ERROR_TIMEHOLDER_INVALID_INVOCATION);
        //}
        ListenerInterface(_listener).deposit(this,0,0);
        ListenerInterface(_listener).withdrawn(this,0,0);
        if(store.includes(listeners,_listener)) {
            return _emitError( ERROR_TIMEHOLDER_ALREADY_ADDED);
        }

        store.add(listeners,_listener);

        _emitListenerAdded(_listener);

        return OK;
    }

    /**
    *  Sets fee wallet address.
    */
    function setFeeWallet(address _feeWallet) onlyContractOwner {
        require(_feeWallet != 0x0);
        store.set(feeWalletStorage, _feeWallet);
    }

    function removeListener(address _listener) onlyAuthorized {
        if (store.includes(listeners, _listener)) {
            store.remove(listeners, _listener);
            _emitListenerRemoved(_listener);
        }
    }

    /**
    * Gets an associated wallet for the time holder
    */
    function wallet() constant returns (address) {
        return store.get(walletStorage);
    }

    /**
    * Gets an associated fee wallet for the time holder
    */
    function feeWallet() constant returns (address) {
        return store.get(feeWalletStorage);
    }

    /**
    * Total amount of shares
    *
    * @return total amount of shares
    */
    function totalShares() constant returns (uint) {
        return store.get(totalSharesStorage);
    }

    /**
    * Contract address of shares
    *
    * @return address of shares contract
    */
    function sharesContract() constant returns (address) {
        return store.get(sharesContractStorage);
    }

    /**
    * Number of shareholders
    *
    * @return number of shareholders
    */
    function shareholdersCount() constant returns (uint) {
        return store.count(shareholders);
    }

    /**
    * Returns deposit/withdraw limit
    *
    * @return limit
    */
    function getLimit() constant returns (uint) {
        return store.get(limitAmount);
    }

    /**
    * Setter deposit/withdraw limit
    *
    * @param _limitAmount is limit
    */
    function setLimit(uint _limitAmount) onlyContractOwner {
        store.set(limitAmount, _limitAmount);
    }

    /**
     * Deposit shares and prove possession.
     * Amount should be less than or equal to current allowance value.
     *
     * Proof should be repeated for each active period. To prove possesion without
     * depositing more shares, specify 0 amount.
     *
     * @param _amount amount of shares to deposit, or 0 to just prove.
     *
     * @return success.
     */
    function deposit(uint _amount) returns (uint) {
        return depositFor(msg.sender, _amount);
    }

    /**
     * Deposit own shares and prove possession for arbitrary shareholder.
     * Amount should be less than or equal to caller current allowance value.
     *
     * Proof should be repeated for each active period. To prove possesion without
     * depositing more shares, specify 0 amount.
     *
     * This function meant to be used by some backend application to prove shares possesion
     * of arbitrary shareholders.
     *
     * @param _address to deposit and prove for.
     * @param _amount amount of shares to deposit, or 0 to just prove.
     *
     * @return success.
     */
    function depositFor(address _address, uint _amount) returns (uint) {
        if (_amount > getLimit()) {
            return _emitError(ERROR_TIMEHOLDER_LIMIT_EXCEEDED);
        }

        address asset = store.get(sharesContractStorage);
        if (!(_amount == 0 || DepositWalletInterface(wallet()).deposit(asset, msg.sender, _amount))) {
            return _emitError(ERROR_TIMEHOLDER_TRANSFER_FAILED);
        }

        if(!store.includes(shareholders,_address)) {
            store.add(shareholders,_address);
        }

        uint prevId = store.get(depositsIdCounter);
        uint id = prevId + 1;
        store.set(depositsIdCounter, id);
        store.add(deposits,bytes32(_address),id);
        store.set(amounts,_address,id,_amount);
        store.set(timestamps,_address,id,now);

        uint balance = depositBalance(_address);
        uint errorCode;
        StorageInterface.Iterator memory iterator = store.listIterator(listeners);
        for(uint i = 0; store.canGetNextWithIterator(listeners,iterator); i++) {
            address listener = store.getNextWithIterator(listeners,iterator);
            errorCode = ListenerInterface(listener).deposit(_address, _amount, balance);
            if (OK != errorCode) {
                _emitError(errorCode);
            }
        }

        _emitDeposit(_address, _amount);

        uint prevAmount = store.get(totalSharesStorage);
        _amount += prevAmount;
        store.set(totalSharesStorage,_amount);

        return OK;
    }

    /**
    * Withdraw shares from the contract, updating the possesion proof in active period.
    *
    * @param _amount amount of shares to withdraw.
    *
    * @return success.
    */
    function withdrawShares(uint _amount) returns (uint resultCode) {
        resultCode = _withdrawShares(msg.sender, msg.sender, _amount);
        if (resultCode != OK) {
            return _emitError(resultCode);
        }

        _emitWithdrawShares(msg.sender, _amount);
    }

    /**
    * @dev Provides a way to support getting additional fee for using features of the system.
    *
    * @param _account holder of deposits, will pay for using a features
    * @param _amount size of a fee
    *
    * @return resultCode result code of the operation
    */
    function takeFeatureFee(address _account, uint _amount) onlyFeatureFeeManager
    public returns (uint resultCode)
    {
        require(_account != 0x0);

        assert(feeWallet() != 0x0);

        resultCode = _withdrawShares(_account, feeWallet(), _amount);
        if (resultCode != OK) {
            return _emitError(resultCode);
        }

        _emitFeatureFeeTaken(_account, feeWallet(), _amount);
    }

    /**
    * @dev Withdraws deposited amount of tokens from account to a receiver address.
    * Emits its own errorCodes if some will be encountered.
    *
    * @param _account an address that have deposited tokens
    * @param _receiver an address that will receive tokens from _account
    * @param _amount amount of tokens to withdraw to the _receiver
    *
    * @return result code of the operation
    */
    function _withdrawShares(address _account, address _receiver, uint _amount) internal returns (uint) {
        if (_amount > getLimit()) {
            return _emitError(ERROR_TIMEHOLDER_LIMIT_EXCEEDED);
        }

        if (_amount > depositBalance(_account)) {
            return _emitError(ERROR_TIMEHOLDER_INSUFFICIENT_BALANCE);
        }

        if (!DepositWalletInterface(wallet()).withdraw(sharesContract(), _receiver, _amount)) {
            return _emitError(ERROR_TIMEHOLDER_TRANSFER_FAILED);
        }

        uint _original_amount = _amount;
        uint i;

        StorageInterface.Iterator memory iterator;

        if (depositBalance(_account) != 0) {
            iterator = store.listIterator(deposits, bytes32(_account));
            uint deposits_count = iterator.count();
            if (deposits_count != 0) {
                for (i = 0; store.canGetNextWithIterator(deposits,iterator); i++) {
                    uint _id = store.getNextWithIterator(deposits,iterator);
                    uint _cur_amount = store.get(amounts, _account, _id);
                    if (_amount < _cur_amount) {
                        store.set(amounts, _account, _id, _cur_amount - _amount);
                        break;
                    }
                    if (_amount == _cur_amount) {
                        store.remove(deposits, bytes32(_account), _id);
                        deposits_count--;
                        break;
                    }
                    if (_amount > _cur_amount) {
                        _amount -= _cur_amount;
                        store.remove(deposits, bytes32(_account), _id);
                        deposits_count--;
                    }
                }
            }
            if (deposits_count == 0) {
                store.remove(shareholders, _account);
            }
        }

        uint errorCode;
        uint balance = depositBalance(_account);

        iterator = store.listIterator(listeners);
        for (i = 0; store.canGetNextWithIterator(listeners,iterator); i++) {
            address listener = store.getNextWithIterator(listeners, iterator);
            errorCode = ListenerInterface(listener).withdrawn(_account, _original_amount, balance);
            if (errorCode != OK) {
                _emitError(errorCode);
            }
        }

        store.set(totalSharesStorage,store.get(totalSharesStorage) - _original_amount);

        return OK;
    }

    function totalSupply() constant returns (uint) {
        address asset = store.get(sharesContractStorage);
        return ERC20Interface(asset).totalSupply();
    }

    function _emitDeposit(address who, uint amount) private {
        TimeHolder(getEventsHistory()).emitDeposit(who, amount);
    }

    function _emitWithdrawShares(address who, uint amount) private {
        TimeHolder(getEventsHistory()).emitWithdrawShares(who, amount);
    }

    function _emitListenerAdded(address listener) private {
        TimeHolder(getEventsHistory()).emitListenerAdded(listener);
    }

    function _emitListenerRemoved(address listener) private {
        TimeHolder(getEventsHistory()).emitListenerRemoved(listener);
    }

    function _emitFeatureFeeTaken(address _from, address _to, uint _amount) private {
        TimeHolder(getEventsHistory()).emitFeatureFeeTaken(_from, _to, _amount);
    }

    function _emitError(uint e) private returns (uint) {
        TimeHolder(getEventsHistory()).emitError(e);
        return e;
    }

    function() {
        revert();
    }
}
