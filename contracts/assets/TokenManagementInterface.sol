pragma solidity ^0.4.11;

contract ReissuableAssetProxyInterface {
    function reissueAsset(bytes32 _symbol, uint _value) returns(uint errorCode);
}

contract RevokableAssetProxyInterface {
    function revokeAsset(bytes32 _symbol, uint _value) returns(uint errorCode);
}

contract TokenManagementInterface {
    function platform() constant returns (address);

    function createAssetWithoutFee(bytes32 _symbol, string _name, string _description, uint _value, uint8 _decimals, bool _isMint, bytes32 _tokenImageIpfsHash) returns (uint);
    function createAssetWithFee(bytes32 _symbol, string _name, string _description, uint _value, uint8 _decimals, bool _isMint, address _feeAddress, uint32 _feePercent, bytes32 _tokenImageIpfsHash) returns (uint);

    function getAssetOwnershipManager() constant returns (address);
    function getReissueAssetProxy() constant returns (ReissuableAssetProxyInterface);
    function getRevokeAssetProxy() constant returns (RevokableAssetProxyInterface);
}
