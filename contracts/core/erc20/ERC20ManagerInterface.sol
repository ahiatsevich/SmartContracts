pragma solidity ^0.4.11;

contract ERC20ManagerInterface {

    function getTokenAddressBySymbol(bytes32 _symbol) public view returns (address tokenAddress);

    function getAddressById(uint _id) public view returns (address);

    function tokensCount() public view returns (uint);

    function addToken(
        address _token,
        bytes32 _name,
        bytes32 _symbol,
        bytes32 _url,
        uint8 _decimals,
        bytes32 _ipfsHash,
        bytes32 _swarmHash)
    public returns(  uint);
}
