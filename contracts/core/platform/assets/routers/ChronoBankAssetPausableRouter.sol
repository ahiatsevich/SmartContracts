/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.24;


import "./ChronoBankAssetRouter.sol";


contract ChronoBankAssetPausableInterface {

}


contract ChronoBankAssetPausableCore {
    /// @dev stops asset transfers
    StorageInterface.Bool internal pausedStorage;
}


contract ChronoBankAssetPausableRouter is ChronoBankAssetRouter, ChronoBankAssetPausableCore {

    constructor(Storage _platform, bytes32 _crate, address _assetBackend) ChronoBankAssetRouter(_platform, _crate, _assetBackend) public {
        pausedStorage.init("paused");
    }
}
