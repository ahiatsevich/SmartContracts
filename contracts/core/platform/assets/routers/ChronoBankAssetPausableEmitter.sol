/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.24;


contract ChronoBankAssetPausableEmitter {

    /// @dev Paused/Unpaused events
    event Paused(bytes32 indexed symbol);
    event Unpaused(bytes32 indexed symbol);

    function emitPaused(bytes32 _symbol) public {
        emit Paused(_symbol);
    }

    function emitUnpaused(bytes32 _symbol) public {
        emit Unpaused(_symbol);
    }
}