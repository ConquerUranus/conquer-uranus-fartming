const { accounts, contract } = require('@openzeppelin/test-environment');
const {
    BN,           // Big Number support
    constants,    // Common constants, like the zero address and largest integers
    expectEvent,  // Assertions for emitted events
    expectRevert, // Assertions for transactions that should fail
    time
} = require('@openzeppelin/test-helpers');

const { expect, assert } = require('chai');
const keccak256 = require('keccak256');
const ShitiumToken = contract.fromArtifact('ShitiumToken');

describe('ShitiumToken', function () {

    const [owner, alice, minter, ...rest] = accounts;
    const valueToMint = 1000;
    const valueToBurn = 500;

    beforeEach(async function () {
        this.shitiumToken = await ShitiumToken.new({ from: owner });
        this.shitiumToken.grantRole(keccak256("MINTER_ROLE"), minter, { from: owner });
        this.shitiumToken.mint(owner, valueToMint, { from: minter });
    });

    it('should not mint tokens if not owner', async function () {
        await expectRevert(
            this.shitiumToken.mint(
                alice,
                10000000,
                { from: alice }
            ),
            "Caller is not a minter"
        )
    });

    it('mint is correct for owner', async function () {
        const balance = await this.shitiumToken.balanceOf(owner);
        expect(balance).bignumber.equal(new BN(valueToMint));
    });

    it('mint is not correct for users', async function () {
        const balance = await this.shitiumToken.balanceOf(owner);
        expect(balance).bignumber.equal(new BN(valueToMint));
    });

    it('burn is correct', async function () {
        await this.shitiumToken.burn(valueToBurn, { from: owner })
        expect(await this.shitiumToken.balanceOf(owner)).bignumber.equal(new BN(valueToMint - valueToBurn));
    });
});