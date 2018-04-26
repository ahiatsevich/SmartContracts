/**
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 */

pragma solidity ^0.4.21;


import "../core/event/MultiEventsHistoryAdapter.sol";


/// @title TimeHolder emitter.
///
/// Contains all the original event emitting function definitions and events.
/// In case of new events needed later, additional emitters can be developed.
/// All the functions is meant to be called using delegatecall.
contract TimeHolderEmitter is MultiEventsHistoryAdapter {

    /// @dev User deposited into current period
    event Deposit(address token, address who, uint amount);

    /// @dev User lock into current period
    event Lock(address token, address who, uint amount);

    /// @dev Shares withdrawn by a shareholder
    event WithdrawShares(address token, address who, uint amount, address receiver);

    /// @dev Unlock request was registered for specific holder
    event RegisterUnlockShares(bytes32 registrationId, address token, uint amount, address holder);
    
    /// @dev Unlock request was unregistered
    event UnregisterUnlockShares(bytes32 registrationId);

    /// @dev Shares unlocked by a shareholder
    event UnlockShares(address token, address who, uint amount, address receiver);

    /// @dev Shares withdrawn by a shareholder
    event ListenerAdded(address listener, address token);

    /// @dev Shares listener is removed
    event ListenerRemoved(address listener, address token);

    /// @dev Shares is added to whitelist and start be available to use
    event SharesWhiteListAdded(address token);

    /// @dev Shares is removed from whitelist and stop being available to use
    event SharesWhiteListChanged(address token, uint limit, bool indexed isAdded);

    /// @dev Fee for Feature is taken
    event FeatureFeeTaken(address self, address indexed from, address indexed to, uint amount);

    /// @dev Something went wrong
    event Error(address indexed self, uint errorCode);

    /* Emitting events */

    function emitDeposit(address token, address who, uint amount) public {
        emit Deposit(token, who, amount);
    }

    function emitLock(address token, address who, uint amount) public {
        emit Lock(token, who, amount);
    }

    function emitWithdrawShares(address token, address who, uint amount, address receiver) public {
        emit WithdrawShares(token, who, amount, receiver);
    }

    function emitRegisterUnlockShares(bytes32 _registrationId, address _token, uint _amount, address _holder) public {
        emit RegisterUnlockShares(_registrationId, _token, _amount, _holder);
    }

    function emitUnregisterUnlockShares(bytes32 _registrationId) public {
        emit UnregisterUnlockShares(_registrationId);
    }

    function emitUnlockShares(address token, address who, uint amount, address receiver) public {
        emit UnlockShares(token, who, amount, receiver);
    }

    function emitListenerAdded(address listener, address token) public {
        emit ListenerAdded(listener, token);
    }

    function emitListenerRemoved(address listener, address token) public {
        emit ListenerRemoved(listener, token);
    }

    function emitSharesWhiteListChanged(address token, uint limit, bool isAdded) public {
        emit SharesWhiteListChanged(token, limit, isAdded);
    }

    function emitFeatureFeeTaken(address _from, address _to, uint _amount) public {
        emit FeatureFeeTaken(_self(), _from, _to, _amount);
    }

    function emitError(uint error) public {
        emit Error(_self(), error);
    }
}
