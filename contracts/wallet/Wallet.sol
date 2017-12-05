//sol Wallet
// Multi-sig, daily-limited account proxy/wallet.
// @authors:
// Gav Wood <g@ethdev.com>
// inheritable "property" contract that enables methods to be protected by requiring the acquiescence of either a
// single, or, crucially, each of a number of, designated owners.
// usage:
// use modifiers onlyowner (just own owned) or onlymanyowners(hash), whereby the same hash must be provided by
// some number (specified in constructor) of the set of owners (specified in the constructor, modifiable) before the
// interior is executed.

pragma solidity ^0.4.11;

import {ERC20ManagerInterface as ERC20Manager} from "../core/erc20/ERC20ManagerInterface.sol";
import {ContractsManagerInterface as ContractsManager} from "../core/contracts/ContractsManagerInterface.sol";
import "../core/erc20/ERC20Interface.sol";
import "./WalletEmitter.sol";

contract WalletsManagerInterface {
    function removeWallet() returns (uint);
    function getOracleAddress() constant returns (address);
    function getOraclePrice() constant returns (uint);
}

contract multiowned is WalletEmitter {

	// TYPES

    uint constant WALLET_INVALID_INVOCATION = 14010;
    uint constant OK = 1;
    uint constant WALLET_UNKNOWN_OWNER = 14012;
    uint constant WALLET_OWNER_ALREADY_EXISTS = 14013;
    uint constant WALLET_CONFIRMATION_NEEDED = 14014;
    uint constant WALLET_UNKNOWN_OPERATION = 14015;
    uint constant WALLET_OWNERS_LIMIT_EXIDED = 14016;
    uint constant WALLET_UNKNOWN_TOKEN_TRANSFER = 14017;
    uint constant WALLET_TRANSFER_ALREADY_REGISTERED = 14018;
    uint constant WALLET_INSUFFICIENT_BALANCE = 14019;
    uint constant WALLET_RELEASE_TIME_ERROR = 14020;

    address eventsEmmiter;

    address contractsManager;

    // struct for the status of a pending operation.
    struct PendingState {
        uint yetNeeded;
        uint ownersDone;
        uint index;
    }

    modifier non2FA() {
        if(use2FA) {
            uint errorCode = WALLET_INVALID_INVOCATION;
            assembly {
                mstore(0, errorCode)
                return(0, 32)
            }
        }
        assert(!use2FA);

        _;
    }
	// METHODS

    function getEventsHistory() constant returns (address) {
        return eventsEmmiter;
    }

    // constructor is given number of sigs required to do protected "onlymanyowners" transactions
    // as well as the selection of addresses capable of confirming them.
    function multiowned(address[] _owners, uint _required) {
        if(_owners.length == 0) {
            revert();
        }
        for (uint i = 0; i < _owners.length; i++)
        {
            m_owners[1 + i] = uint(_owners[i]);
            m_ownerIndex[uint(_owners[i])] = 1 + i;
            m_numOwners++;
        }
        if(_required <= m_numOwners) {
            m_required = _required;
        }
        else {
            m_required = m_numOwners;
        }
    }

    // Revokes a prior confirmation of the given operation
    function revoke(bytes32 _operation) external returns (uint) {
        uint ownerIndex = m_ownerIndex[uint(msg.sender)];
        // make sure they're an owner
        if (ownerIndex == 0) return _emitError(WALLET_UNKNOWN_OWNER);
        uint ownerIndexBit = 2**ownerIndex;
        var pending = m_pending[_operation];
        if (pending.ownersDone & ownerIndexBit > 0) {
            pending.yetNeeded++;
            pending.ownersDone -= ownerIndexBit;
            _emitRevoke(msg.sender, _operation);
            return OK;
        }
        return _emitError(WALLET_UNKNOWN_OPERATION);
    }

    // Replaces an owner `_from` with another `_to`.
    function changeOwner(address _from, address _to) external non2FA returns (uint) {
        uint e = confirmAndCheck(sha3(msg.data));
        if(OK != e) {
            return _emitError(e);
        }
        if (isOwner(_to)) return _emitError(WALLET_OWNER_ALREADY_EXISTS);
        uint ownerIndex = m_ownerIndex[uint(_from)];
        if (ownerIndex == 0) return _emitError(WALLET_UNKNOWN_OWNER);
        clearPending();
        m_owners[ownerIndex] = uint(_to);
        m_ownerIndex[uint(_from)] = 0;
        m_ownerIndex[uint(_to)] = ownerIndex;
        _emitOwnerChanged(_from, _to);
        return OK;
    }

    function addOwner(address _owner) external non2FA returns (uint) {
        uint e = confirmAndCheck(sha3(msg.data));
        if(OK != e) {
            return _emitError(e);
        }
        if (isOwner(_owner)) return _emitError(WALLET_OWNER_ALREADY_EXISTS);

        clearPending();
        if (m_numOwners >= c_maxOwners)
            reorganizeOwners();
        if (m_numOwners >= c_maxOwners)
            return WALLET_OWNERS_LIMIT_EXIDED;
        m_numOwners++;
        m_owners[m_numOwners] = uint(_owner);
        m_ownerIndex[uint(_owner)] = m_numOwners;
        _emitOwnerAdded(_owner);
        return OK;
    }

    function removeOwner(address _owner) external non2FA returns (uint) {
        uint e = confirmAndCheck(sha3(msg.data));
        if(OK != e) {
            return _emitError(e);
        }
        uint ownerIndex = m_ownerIndex[uint(_owner)];
        if (ownerIndex == 0) return _emitError(WALLET_UNKNOWN_OWNER);
        if (m_required > m_numOwners - 1) return _emitError(WALLET_INVALID_INVOCATION);

        m_owners[ownerIndex] = 0;
        m_ownerIndex[uint(_owner)] = 0;
        clearPending();
        reorganizeOwners(); //make sure m_numOwner is equal to the number of owners and always points to the optimal free slot
        _emitOwnerRemoved(_owner);
        return OK;
    }

    function changeRequirement(uint _newRequired) external non2FA returns (uint) {
        uint e = confirmAndCheck(sha3(msg.data));
        if(OK != e) {
            return _emitError(e);
        }
        if (_newRequired > m_numOwners) return;
        m_required = _newRequired;
        clearPending();
        _emitRequirementChanged(_newRequired);
        return OK;
    }

    // Gets an owner by 0-indexed position (using numOwners as the count)
    function getOwner(uint ownerIndex) external constant returns (address) {
        return address(m_owners[ownerIndex + 1]);
    }

    function isOwner(address _addr) constant returns (bool) {
        return m_ownerIndex[uint(_addr)] > 0;
    }

    function hasConfirmed(bytes32 _operation, address _owner) constant returns (bool) {
        var pending = m_pending[_operation];
        uint ownerIndex = m_ownerIndex[uint(_owner)];

        // make sure they're an owner
        if (ownerIndex == 0) return false;

        // determine the bit to set for this owner.
        uint ownerIndexBit = 2**ownerIndex;
        return !(pending.ownersDone & ownerIndexBit == 0);
    }

    // INTERNAL METHODS

    function confirmAndCheck(bytes32 _operation) internal returns (uint) {
        // determine what index the present sender is:
        uint ownerIndex = m_ownerIndex[uint(msg.sender)];
        // make sure they're an owner
        if (ownerIndex == 0) return _emitError(WALLET_UNKNOWN_OWNER);

        var pending = m_pending[_operation];
        // if we're not yet working on this operation, switch over and reset the confirmation status.
        if (pending.yetNeeded == 0) {
            // reset count of confirmations needed.
            pending.yetNeeded = m_required;
            // reset which owners have confirmed (none) - set our bitmap to 0.
            pending.ownersDone = 0;
            pending.index = m_pendingIndex.length++;
            m_pendingIndex[pending.index] = _operation;
        }
        // determine the bit to set for this owner.
        uint ownerIndexBit = 2**ownerIndex;
        // make sure we (the message sender) haven't confirmed this operation previously.
        if (pending.ownersDone & ownerIndexBit == 0) {
            _emitConfirmation(msg.sender, _operation);
            // ok - check if count is enough to go ahead.
            if (pending.yetNeeded <= 1) {
                // enough confirmations: reset and run interior.
                delete m_pendingIndex[m_pending[_operation].index];
                delete m_pending[_operation];
                return OK;
            }
            else
            {
                // not enough: record that this owner in particular confirmed.
                pending.yetNeeded--;
                pending.ownersDone |= ownerIndexBit;
                return WALLET_CONFIRMATION_NEEDED;
            }
        }
    }

    function reorganizeOwners() private {
        uint free = 1;
        while (free < m_numOwners)
        {
            while (free < m_numOwners && m_owners[free] != 0) free++;
            while (m_numOwners > 1 && m_owners[m_numOwners] == 0) m_numOwners--;
            if (free < m_numOwners && m_owners[m_numOwners] != 0 && m_owners[free] == 0)
            {
                m_owners[free] = m_owners[m_numOwners];
                m_ownerIndex[m_owners[free]] = free;
                m_owners[m_numOwners] = 0;
            }
        }
    }

    function toggle2FA() returns (uint) {
        // determine what index the present sender is and make sure they're an owner
        if (m_ownerIndex[uint(msg.sender)] == 0) {
            return _emitError(WALLET_UNKNOWN_OWNER);
        }

        address walletsManager = ContractsManager(contractsManager).getContractAddressByType(bytes32("WalletsManager"));
        address oracleAddress = WalletsManagerInterface(walletsManager).getOracleAddress();

        if(oracleAddress == address(0)) {
            return _emitError(WALLET_INVALID_INVOCATION);
        }

        if(!use2FA && m_required == 1) {
            use2FA = true;
            m_required = 2;
            clearPending();
            m_numOwners++;
            m_owners[m_numOwners] = uint(oracleAddress);
            m_ownerIndex[uint(oracleAddress)] = m_numOwners;
            return OK;
        } else {
            if(use2FA && m_required == 2 && m_ownerIndex[uint(oracleAddress)] == 1) {
                use2FA = false;
                m_required = 1;
                uint ownerIndex = m_ownerIndex[uint(oracleAddress)];
                m_owners[ownerIndex] = 0;
                m_ownerIndex[uint(oracleAddress)] = 0;
                clearPending();
                reorganizeOwners(); //make sure m_numOwner is equal to the number of owners and always points to the optimal free slot
                return OK;
            }
        }
    }

    function clearPending() internal {
        uint length = m_pendingIndex.length;
        for (uint i = 0; i < length; ++i)
            if (m_pendingIndex[i] != 0)
                delete m_pending[m_pendingIndex[i]];
        delete m_pendingIndex;
    }

    function _emitError(uint errorCode) returns (uint) {
        Wallet(getEventsHistory()).emitError(errorCode);
        return errorCode;
    }

    function _emitDeposit(address from, uint value) {
        Wallet(getEventsHistory()).emitDeposit(from, value);
    }

    function _emitSingleTransact(address owner, uint value, address to, bytes32 symbol) {
        Wallet(getEventsHistory()).emitSingleTransact(owner, value, to, symbol);
    }

    function _emitMultiTransact(address owner, bytes32 operation, uint value, address to, bytes32 symbol) {
        Wallet(getEventsHistory()).emitMultiTransact(owner, operation, value, to, symbol);
    }

    function _emitConfirmationNeeded(bytes32 operation, address initiator, uint value, address to, bytes32 symbol) {
        Wallet(getEventsHistory()).emitConfirmationNeeded(operation, initiator, value, to, symbol);
    }

    function _emitConfirmation(address owner, bytes32 operation) {
        Wallet(getEventsHistory()).emitConfirmation(owner, operation);
    }

    function _emitRevoke(address owner, bytes32 operation) {
        Wallet(getEventsHistory()).emitRevoke(owner, operation);
    }

    function _emitOwnerChanged(address oldOwner, address newOwner) {
        Wallet(getEventsHistory()).emitOwnerChanged(oldOwner, newOwner);
    }

    function _emitOwnerAdded(address newOwner) {
        Wallet(getEventsHistory()).emitOwnerAdded(newOwner);
    }

    function _emitOwnerRemoved(address oldOwner) {
        Wallet(getEventsHistory()).emitOwnerAdded(oldOwner);
    }

    function _emitRequirementChanged(uint newRequirement) {
        Wallet(getEventsHistory()).emitRequirementChanged(newRequirement);
    }

   	// FIELDS

    // wallets use 2FA oracle
    bool public use2FA;

    // the number of owners that must confirm the same operation before it is run.
    uint public m_required;
    // pointer used to find a free slot in m_owners
    uint public m_numOwners;

    uint public version;

    // list of owners
    uint[256] m_owners;
    uint constant c_maxOwners = 250;
    uint constant c_maxPending = 20;
    // index on the list of owners to allow reverse lookup
    mapping(uint => uint) m_ownerIndex;
    // the ongoing operations.
    mapping(bytes32 => PendingState) m_pending;
    bytes32[] m_pendingIndex;
}

// usage:
// bytes32 h = Wallet(w).from(oneOwner).execute(to, value, data);
// Wallet(w).from(anotherOwner).confirm(h);
contract Wallet is multiowned {

    // TYPES

    // Transaction structure to remember details of transaction lest it need be saved for a later call.
    struct Transaction {
        address to;
        uint value;
        bytes32 symbol;
    }

    // METHODS

    // constructor - just pass on the owner array to the multiowned and
    // the limit to daylimit
    function Wallet(address[] _owners, uint _required, address _contractsManager, address _eventsHistory, bool _use2FA, uint _releaseTime) multiowned(_owners, _required)  {
        contractsManager = _contractsManager;
        eventsEmmiter = _eventsHistory;
        use2FA = _use2FA;
        releaseTime = _releaseTime;
    }

    function getTokenAddresses() constant returns (address[] result) {
        address erc20Manager = ContractsManager(contractsManager).getContractAddressByType(bytes32("ERC20Manager"));
        uint counter = ERC20Manager(erc20Manager).tokensCount();
        result = new address[](counter);
        for(uint i=0;i<counter;i++) {
            result[i] = ERC20Manager(erc20Manager).getAddressById(i);
        }
        return result;
    }

    function getPendings() constant returns (address[] result1, uint[] result2, bytes32[] result3, bytes32[] operations) {
        result1 = new address[](m_pendingIndex.length);
        result2 = new uint[](m_pendingIndex.length);
        result3 = new bytes32[](m_pendingIndex.length);
        operations = new bytes32[](m_pendingIndex.length);
        for(uint i=0;i<m_pendingIndex.length;i++) {
            result1[i] = m_txs[m_pendingIndex[i]].to;
            result2[i] = m_txs[m_pendingIndex[i]].value;
            result3[i] = m_txs[m_pendingIndex[i]].symbol;
            operations[i] = m_pendingIndex[i];
        }
        return (result1,result2,result3,operations);
    }

    // kills the contract sending everything to `_to`.
    function kill(address _to) external returns (uint) {
        if(releaseTime > now) {
            return _emitError(WALLET_RELEASE_TIME_ERROR);
        }
        uint e = confirmAndCheck(sha3(msg.data));
        if(OK != e) {
            return _emitError(e);
        }
        address[] memory tokens = getTokenAddresses();
        for(uint i=0;i<tokens.length;i++) {
            address token = tokens[i];
            uint balance = ERC20Interface(token).balanceOf(this);
            if(balance != 0)
            ERC20Interface(token).transfer(_to,balance);
        }
        selfdestruct(_to);
        address walletsManager = ContractsManager(contractsManager).getContractAddressByType(bytes32("WalletsManager"));
        return WalletsManagerInterface(walletsManager).removeWallet();

    }

    // gets called when no other function matches
    function() payable {
        // just being sent some cash?
        if (msg.value > 0)
            _emitDeposit(msg.sender, msg.value);
    }

    // Outside-visible transact entry point. Executes transaction immediately if below daily spend limit.
    // If not, goes into multisig process. We provide a hash on return to allow the sender to provide
    // shortcuts for the other confirmations (allowing them to avoid replicating the _to, _value
    // and _data arguments). They still get the option of using them if they want, anyways.
    function transfer(address _to, uint _value, bytes32 _symbol) payable returns (uint) {
        if(!isOwner(msg.sender)) {
            return _emitError(WALLET_UNKNOWN_OWNER);
        }
        if(releaseTime > now) {
            return _emitError(WALLET_RELEASE_TIME_ERROR);
        }
        if(use2FA) {
            address walletsManager = ContractsManager(contractsManager).getContractAddressByType(bytes32("WalletsManager"));
            uint oraclePrice = WalletsManagerInterface(walletsManager).getOraclePrice();
            address oracleAddress = WalletsManagerInterface(walletsManager).getOracleAddress();
            if(oraclePrice == 0 || oracleAddress == address(0)) {
                return _emitError(WALLET_INVALID_INVOCATION);
            }
            if(msg.value < oraclePrice) {
                return _emitError(WALLET_INVALID_INVOCATION);
            }
            if(!oracleAddress.send(msg.value)) {
                return _emitError(WALLET_INVALID_INVOCATION);
            }
        }
        if(_symbol == bytes32('ETH') || _symbol == bytes32(0)) {
            if(this.balance < _value) {
                return _emitError(WALLET_INSUFFICIENT_BALANCE);
            }
        } else {
            address erc20Manager = ContractsManager(contractsManager).getContractAddressByType(bytes32("ERC20Manager"));
            if(ERC20Manager(erc20Manager).getTokenAddressBySymbol(_symbol) == 0)
            return _emitError(WALLET_UNKNOWN_TOKEN_TRANSFER);
            else {
                address token = ERC20Manager(erc20Manager).getTokenAddressBySymbol(_symbol);
                if(ERC20Interface(token).balanceOf(this) < _value)
                return _emitError(WALLET_INSUFFICIENT_BALANCE);
            }
        }
        // determine our operation hash.
        bytes32 _r = sha3(msg.data, now);
        if (m_txs[_r].to == 0) {
            m_txs[_r].to = _to;
            m_txs[_r].value = _value;
            m_txs[_r].symbol = _symbol;
            _emitConfirmationNeeded(_r, msg.sender, _value, _to, _symbol);
            uint status = confirm(_r);
            return status;
        }
        return _emitError(WALLET_TRANSFER_ALREADY_REGISTERED);
    }

    // confirm a transaction through just the hash. we use the previous transactions map, m_txs, in order
    // to determine the body of the transaction from the hash provided.
    function confirm(bytes32 _h) returns (uint) {
        uint e = confirmAndCheck(_h);
        if(OK != e) {
            return e;
        }
        if (m_txs[_h].to != 0) {
            if(m_txs[_h].symbol == bytes32('ETH')) {
                require(m_txs[_h].to.send(m_txs[_h].value));
            }
            else {
                address erc20Manager = ContractsManager(contractsManager).getContractAddressByType(bytes32("ERC20Manager"));
                address token = ERC20Manager(erc20Manager).getTokenAddressBySymbol(m_txs[_h].symbol);
                ERC20Interface(token).transfer(m_txs[_h].to,m_txs[_h].value);
            }
            _emitMultiTransact(msg.sender, _h, m_txs[_h].value, m_txs[_h].to, m_txs[_h].symbol);
            delete m_txs[_h];
            return OK;
        }
        return _emitError(WALLET_INVALID_INVOCATION);
    }

    // INTERNAL METHODS

    function clearPending() internal {
        uint length = m_pendingIndex.length;
        for (uint i = 0; i < length; ++i)
            delete m_txs[m_pendingIndex[i]];
        super.clearPending();
    }

	// FIELDS

    // pending transactions we have at present.
    mapping (bytes32 => Transaction) m_txs;
    uint public releaseTime;
}
