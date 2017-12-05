pragma solidity ^0.4.11;

import '../core/event/MultiEventsHistoryAdapter.sol';

contract WalletEmitter is MultiEventsHistoryAdapter {

    // EVENTS

    // Funds has arrived into the wallet (record how much).
    event Deposit(address self, address from, uint value);
    // Single transaction going out of the wallet (record who signed for it, how much, and to whom it's going).
    event SingleTransact(address self, address owner, uint value, address to, bytes32 symbol);
    // Multi-sig transaction going out of the wallet (record who signed for it last, the operation hash, how much, and to whom it's going).
    event MultiTransact(address self, address owner, bytes32 operation, uint value, address to, bytes32 symbol);
    // Confirmation still needed for a transaction.
    event ConfirmationNeeded(address self, bytes32 operation, address initiator, uint value, address to, bytes32 symbol);

    event Confirmation(address self, address owner, bytes32 operation);

    event Revoke(address self, address owner, bytes32 operation);
    // some others are in the case of an owner changing.
    event OwnerChanged(address self, address oldOwner, address newOwner);

    event OwnerAdded(address self, address newOwner);

    event OwnerRemoved(address self, address oldOwner);
    // the last one is emitted if the required signatures change
    event RequirementChanged(address self, uint newRequirement);

    event Error(address self, uint errorCode);

    function emitError(uint errorCode) {
        Error(_self(), errorCode);
    }

    function emitDeposit(address from, uint value) {
        Deposit(_self(), from, value);
    }

    function emitSingleTransact(address owner, uint value, address to, bytes32 symbol) {
        SingleTransact(_self(), owner, value, to, symbol);
    }

    function emitMultiTransact(address owner, bytes32 operation, uint value, address to, bytes32 symbol) {
        MultiTransact(_self(), owner, operation, value, to, symbol);
    }

    function emitConfirmationNeeded(bytes32 operation, address initiator, uint value, address to, bytes32 symbol) {
        ConfirmationNeeded(_self(), operation, initiator, value, to, symbol);
    }

    function emitConfirmation(address owner, bytes32 operation) {
        Confirmation(_self(), owner, operation);
    }

    function emitRevoke(address owner, bytes32 operation) {
        Revoke(_self(), owner, operation);
    }

    function emitOwnerChanged(address oldOwner, address newOwner) {
        OwnerChanged(_self(), oldOwner, newOwner);
    }

    function emitOwnerAdded(address newOwner) {
        OwnerAdded(_self(), newOwner);
    }

    function emitOwnerRemoved(address oldOwner) {
        OwnerAdded(_self(), oldOwner);
    }

    function emitRequirementChanged(uint newRequirement) {
        RequirementChanged(_self(), newRequirement);
    }

}
