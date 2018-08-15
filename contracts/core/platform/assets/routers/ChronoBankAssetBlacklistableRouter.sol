/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.24;


import "./ChronoBankAssetRouter.sol";


contract ChronoBankAssetBlacklistableInterface {

}


contract ChronoBankAssetBlacklistableCore {
    /// @dev banned addresses
    StorageInterface.AddressBoolMapping internal blacklistStorage;
}


contract ChronoBankAssetBlacklistableRouter is ChronoBankAssetRouter, ChronoBankAssetBlacklistableCore {

    constructor(Storage _platform, bytes32 _crate, address _assetBackend) ChronoBankAssetRouter(_platform, _crate, _assetBackend) public {
        blacklistStorage.init("blacklist");
    }
}
