pragma solidity ^0.4.11;


contract ChronoBankPlatformInterface {
    mapping(bytes32 => address) public proxies;

    function symbols(uint _idx) public constant returns (bytes32);
    function symbolsCount() public constant returns (uint);

    function name(bytes32 _symbol) returns(string);
    function setProxy(address _address, bytes32 _symbol) returns(uint errorCode);
    function isCreated(bytes32 _symbol) constant returns(bool);
    function isOwner(address _owner, bytes32 _symbol) returns(bool);
    function owner(bytes32 _symbol) constant returns(address);
    function totalSupply(bytes32 _symbol) returns(uint);
    function balanceOf(address _holder, bytes32 _symbol) returns(uint);
    function allowance(address _from, address _spender, bytes32 _symbol) returns(uint);
    function baseUnit(bytes32 _symbol) returns(uint8);
    function proxyTransferWithReference(address _to, uint _value, bytes32 _symbol, string _reference, address _sender) returns(uint errorCode);
    function proxyTransferFromWithReference(address _from, address _to, uint _value, bytes32 _symbol, string _reference, address _sender) returns(uint errorCode);
    function proxyApprove(address _spender, uint _value, bytes32 _symbol, address _sender) returns(uint errorCode);
    function issueAsset(bytes32 _symbol, uint _value, string _name, string _description, uint8 _baseUnit, bool _isReissuable) returns(uint errorCode);
    function issueAsset(bytes32 _symbol, uint _value, string _name, string _description, uint8 _baseUnit, bool _isReissuable, address _account) returns(uint errorCode);
    function reissueAsset(bytes32 _symbol, uint _value) returns(uint errorCode);
    function revokeAsset(bytes32 _symbol, uint _value) returns(uint errorCode);
    function isReissuable(bytes32 _symbol) returns(bool);
    function changeOwnership(bytes32 _symbol, address _newOwner) returns(uint errorCode);
}
