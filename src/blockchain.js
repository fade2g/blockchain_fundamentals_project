/**
 *                          Blockchain Class
 *  The Blockchain class contain the basics functions to create your own private blockchain
 *  It uses libraries like `crypto-js` to create the hashes for each block and `bitcoinjs-message`
 *  to verify a message signature. The chain is stored in the array
 *  `this.chain = [];`. Of course each time you run the application the chain will be empty because and array
 *  isn't a persistent storage method.
 *
 */

const SHA256 = require('crypto-js/sha256');
const BlockClass = require('./block.js');
const bitcoinMessage = require('bitcoinjs-message');
const {Block} = require('./block');

class Blockchain {

    /**
     * Constructor of the class, you will need to setup your chain array and the height
     * of your chain (the length of your chain array).
     * Also everytime you create a Blockchain class you will need to initialized the chain creating
     * the Genesis Block.
     * The methods in this class will always return a Promise to allow client applications or
     * other backends to call asynchronous functions.
     */
    constructor() {
        this.chain = [];
        this.height = -1;
        this.initializeChain();
    }

    /**
     * This method will check for the height of the chain and if there isn't a Genesis Block it will create it.
     * You should use the `addBlock(block)` to create the Genesis Block
     * Passing as a data `{data: 'Genesis Block'}`
     */
    async initializeChain() {
        if (this.height === -1) {
            let block = new BlockClass.Block({data: 'Genesis Block'});
            await this._addBlock(block);
        }
    }

    /**
     * Utility method that return a Promise that will resolve with the height of the chain
     */
    getChainHeight() {
        return new Promise((resolve, reject) => {
            resolve(this.height);
        });
    }

    /**
     * _addBlock(block) will store a block in the chain
     * @param {Block} block
     * The method will return a Promise that will resolve with the block added
     * or reject if an error happen during the execution.
     * You will need to check for the height to assign the `previousBlockHash`,
     * assign the `timestamp` and the correct `height`...At the end you need to
     * create the `block hash` and push the block into the chain array. Don't for get
     * to update the `this.height`
     * Note: the symbol `_` in the method name indicates in the javascript convention
     * that this method is a private method.
     */
    _addBlock(block) {
        let self = this;
        return new Promise(async (resolve, reject) => {
            const validationErrors = await self._validateBlocks();
            if (validationErrors.length > 0) {
                reject('The chain is broken');
            }
            const previousBlock = await self.chain[self.height];
            block.height = self.height + 1;
            block.previousBlockHash = previousBlock && previousBlock.hash;
            block.time = new Date().getTime().toString().slice(0, -3);
            block.updateHash();
            self.chain.push(block);
            self.height++;
            resolve(block);
        });
    }

    /**
     * The requestMessageOwnershipVerification(address) method
     * will allow you  to request a message that you will use to
     * sign it with your Bitcoin Wallet (Electrum or Bitcoin Core)
     * This is the first step before submit your Block.
     * The method return a Promise that will resolve with the message to be signed
     * @param {*} address
     */
    requestMessageOwnershipVerification(address) {
        return new Promise((resolve) => {
            resolve(`${address}:${new Date().getTime().toString().slice(0, -3)}:starRegistry`);
        });
    }

    /**
     * Verifies, if the message is still valid (i.e. not yet expired)
     * @param message
     * @returns {boolean}
     * @private
     */
    _messageTimeExpired(message) {
        const signedTime = parseInt(message.split(':')[1]);
        const currentTime = parseInt(new Date().getTime().toString().slice(0, -3));
        return (signedTime + (5 * 60)) < currentTime;
    }

    /**
     * The submitStar(address, message, signature, star) method
     * will allow users to register a new Block with the star object
     * into the chain. This method will resolve with the Block added or
     * reject with an error.
     * Algorithm steps:
     * 1. Get the time from the message sent as a parameter example: `parseInt(message.split(':')[1])`
     * 2. Get the current time: `let currentTime = parseInt(new Date().getTime().toString().slice(0, -3));`
     * 3. Check if the time elapsed is less than 5 minutes
     * 4. Verify the message with wallet address and signature: `bitcoinMessage.verify(message, address, signature)`
     * 5. Create the block and add it to the chain
     * 6. Resolve with the block added.
     * @param {string} address
     * @param {string} message
     * @param {string} signature
     * @param {Object} star
     * @returns {Promise<Block>}
     */
    submitStar(address, message, signature, star) {
        function checkTime() {

        }
        let self = this;
        return new Promise(async (resolve, reject) => {
            if (this._messageTimeExpired(message)) {
                reject('expired message');
            }
            // verify the signed message
            if (!bitcoinMessage.verify(message, address, signature)) {
                reject('invalid message ');
            }
            // construct and add new block
            const newBlock = new Block({
                owner: address,
                star
            });
            // try to add the block. If it fails, it means the blockchain is broken
            self._addBlock(newBlock)
                .then(addedBlock => resolve(addedBlock))
                .catch(() => reject('The chain is broken, adding stars not possible'));
        });
    }

    /**
     * This method will return a Promise that will resolve with the Block
     *  with the hash passed as a parameter.
     * Search on the chain array for the block that has the hash.
     * @param {string} hash
     * @returns {Promise<Block>}
     */
    async getBlockByHash(hash) {
        let self = this;
        return new Promise(async (resolve, reject) => {
            const blocks = self.chain.filter(block => block.hash === hash);
            if (blocks.length === 1) {
                resolve(await blocks[0].getBData());
            }
            resolve(null);
        });
    }

    /**
     * This method will return a Promise that will resolve with the Block object
     * with the height equal to the parameter `height`
     * @param {*} height
     * @returns {Promise<Block>}
     */
    getBlockByHeight(height) {
        let self = this;
        return new Promise((resolve, reject) => {
            let blocks = self.chain.filter(p => p.height === height);
            if (blocks.length === 1) {
                if (blocks[0].height === 0) {
                    resolve(blocks[0]);
                } else {
                    resolve(blocks[0].getBData());
                }
            }
            resolve(null);
        });
    }

    /**
     * This method will return a Promise that will resolve with an array of Stars objects existing in the chain
     * and are belongs to the owner with the wallet address passed as parameter.
     * Remember the star should be returned decoded.
     * @param {string} address
     * @returns {Promise<Block>}
     */
    getStarsByWalletAddress(address) {
        const self = this;
        let stars = [];
        return new Promise((resolve, reject) => {
            const relevantBlockDataPromises = self.chain
                .filter((b, index) => index > 0)
                .map(b => b.getBData());
            Promise.all(relevantBlockDataPromises)
                .then(blockData => {
                    resolve(blockData
                        .filter(bd => bd.owner === address)
                    );
                });
        });
    }

    /**
     * This method will return a Promise that will resolve with the list of errors when validating the chain.
     * Steps to validate:
     * 1. You should validate each block using `validateBlock`
     * 2. Each Block should check the with the previousBlockHash
     *
     * * @returns {Promise<string[]>} List of error messages
     */
    async validateChain() {
        let self = this;
        let errorLog = [];
        errorLog = await self._validateBlocks();
        return Promise.resolve({errors: errorLog});
    }

    /**
     * Validates all blocks in the blockhchain by calling the validation function of the block
     * @returns {Promise<string[]>}
     * @private
     */
    async _validateBlocks() {
        const blockPromises = this.chain.map(block => {
            return new Promise(async (resolve, reject) => {
                const blockValid = block.validate();
                if (!blockValid) {
                    resolve(`Block ${block.hash} is not valid`);
                }
                // check if the previous block can be found based on the hash value of the block
                if (block.height > 0) {
                    const previousBlock = await this.getBlockByHash(block.previousBlockHash);
                    if (previousBlock === null) {
                        resolve(`Block ${block.hash} misses previous block ${block.previousBlockHash}`);
                    }
                }
                resolve(null);
            })
        });
        return Promise.all(blockPromises).then(errors => errors.filter(e => e != null));
    }
}

module.exports.Blockchain = Blockchain;   
