pragma solidity ^0.4.11;

contract ChronoBankAssetOwnershipManager {
    function symbols(uint _idx) public view returns (bytes32);
    function symbolsCount() public view returns (uint);

    function removeAssetPartOwner(bytes32 _symbol, address _partowner) public returns (uint errorCode);
    function addAssetPartOwner(bytes32 _symbol, address _partowner) public returns (uint errorCode);
    function hasAssetRights(address _owner, bytes32 _symbol) public view returns (bool);

    function addPartOwner(address _partowner) public returns (uint);
    function removePartOwner(address _partowner) public returns (uint);

    function changeOwnership(bytes32 _symbol, address _newOwner) public returns(uint errorCode);
}


contract ChronoBankManagersRegistry {
    function holdersCount() public view returns (uint);
    function holders(uint _idx) public view returns (address _holderAddress);
}
