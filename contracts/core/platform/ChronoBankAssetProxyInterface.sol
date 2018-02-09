pragma solidity ^0.4.11;

contract ChronoBankAssetProxyInterface {
    address public chronoBankPlatform;
    function smbl() public view returns (bytes32);
    function __totalSupply() public view returns (uint);
    function __balanceOf(address _owner) public view returns (uint);
    function __allowance(address _from, address _spender) public view returns (uint);
    function __baseUnit() public view returns (uint8);
    function __transferWithReference(address _to, uint _value, string _reference, address _sender) public returns (bool);
    function __transferFromWithReference(address _from, address _to, uint _value, string _reference, address _sender) public returns (bool);
    function __approve(address _spender, uint _value, address _sender) public returns (bool);
    function getLatestVersion() public returns (address);
    function init(address _chronoBankPlatform, string _symbol, string _name) public;
    function proposeUpgrade(address _newVersion) public returns (bool);
}
