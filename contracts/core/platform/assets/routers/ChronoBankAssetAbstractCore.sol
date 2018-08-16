/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.24;


import "../../../storage/StorageAdapter.sol";


contract ChronoBankAssetAbstractCore {

    using StorageInterface for *;

    bytes32 constant CHRONOBANK_PLATFORM_CRATE = "ChronoBankPlatform";

    StorageInterface.Config internal store;

    /// @dev Assigned asset proxy contract
    StorageInterface.Address internal proxyStorage;    
}


contract ChronoBankAssetAbstractRouter is StorageAdapter {

    bytes32 constant CHRONOBANK_PLATFORM_CRATE = "ChronoBankPlatform";

    /// @dev Assigned asset proxy contract
    StorageInterface.Address internal proxyStorage;

    constructor(Storage _platform, bytes32 _crate) StorageAdapter(_platform, _crate) public {
        require(
            _crate != CHRONOBANK_PLATFORM_CRATE, 
            "ASSET_INVALID_CRATE"
        );

        proxyStorage.init("proxy");
    }
}