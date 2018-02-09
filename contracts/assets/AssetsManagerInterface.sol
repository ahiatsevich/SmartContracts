pragma solidity ^0.4.11;

contract AssetsManagerInterface {
    function isAssetSymbolExists(bytes32 _symbol) public view returns (bool);

    function isAssetOwner(bytes32 _symbol, address _user) public view returns (bool);
    function getAssetBySymbol(bytes32 _symbol) public view returns (address);

    function getAssetsForOwnerCount(address _platform, address _owner) public view returns (uint);
    function getAssetForOwnerAtIndex(address _platform, address _owner, uint idx) public view returns (bytes32);

    function getTokenExtension(address _platform) public view returns (address);
    function requestTokenExtension(address _platform) public returns (uint);
}


contract TokenExtensionRegistry {
    function containsTokenExtension(address _tokenExtension) public view returns (bool);
}
