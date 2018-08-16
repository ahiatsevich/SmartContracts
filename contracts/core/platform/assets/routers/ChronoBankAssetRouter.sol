/**
* Copyright 2017–2018, LaborX PTY
* Licensed under the AGPL Version 3 license.
*/

pragma solidity ^0.4.24;


import "../../../common/BaseByzantiumRouter.sol";
import "./ChronoBankAssetAbstractCore.sol";


contract ChronoBankAssetRouterCore {
    address public assetBackend;
}


contract ChronoBankAssetRouter is 
    BaseByzantiumRouter, 
    ChronoBankAssetRouterCore,
    ChronoBankAssetAbstractRouter
{
    constructor(Storage _platform, bytes32 _crate, address _assetBackend) ChronoBankAssetAbstractRouter(_platform, _crate) public {
        require(_assetBackend != 0x0, "ASSET_ROUTER_INVALID_BACKEND_ADDRESS");

        assetBackend = _assetBackend;
    }

    function backend() internal view returns (address) {
        return assetBackend;
    }
}
