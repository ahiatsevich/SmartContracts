/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.24;


import "./ChronoBankAssetRouter.sol";
import "./ChronoBankAssetRouterInterface.sol";
import "./ChronoBankAssetBlacklistableEmitter.sol";


contract ChronoBankAssetBlacklistableRouterInterface is ChronoBankAssetRouterInterface, ChronoBankAssetBlacklistableEmitter {

    function blacklist(address _account) public view returns (bool);

    function restrict(address[] _restricted) external returns (bool);
    function unrestrict(address[] _unrestricted) external returns (bool);
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
