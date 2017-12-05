pragma solidity ^0.4.11;

contract ChronoBankAssetOwnershipManager {
    function symbols(uint _idx) public constant returns (bytes32);
    function symbolsCount() public constant returns (uint);

    function removeAssetPartOwner(bytes32 _symbol, address _partowner) returns (uint errorCode);
    function addAssetPartOwner(bytes32 _symbol, address _partowner) returns (uint errorCode);
    function hasAssetRights(address _owner, bytes32 _symbol) constant returns (bool);

    function addPartOwner(address _partowner) returns (uint);
    function removePartOwner(address _partowner) returns (uint);

    function changeOwnership(bytes32 _symbol, address _newOwner) returns(uint errorCode);
}


contract ChronoBankManagersRegistry {
    function holdersCount() constant returns (uint);
    function holders(uint _idx) constant returns (address _holderAddress);
}
