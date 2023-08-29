import {
  Client,
  PrivateKey,
  AccountId,
  ContractCreateFlow,
  ContractUpdateTransaction,
  ContractExecuteTransaction,
  ContractFunctionParameters,
  ContractInfoQuery,
  AccountAllowanceApproveTransaction,
  TokenType,
  TokenSupplyType,
  TokenCreateTransaction,
  TokenMintTransaction,
  Hbar,
  AccountBalanceQuery,
  TransferTransaction,
  AccountCreateTransaction,
} from "@hashgraph/sdk";
import axios from "axios";
import * as dotenv from "dotenv";
import WHBAR from "./abi/WHBAR.json" assert { type: "json" };

dotenv.config();
console.clear();

const bytecode = WHBAR.bytecode;

//Grab your Hedera testnet account ID and private key from your .env file
const myAccountId = AccountId.fromString(process.env.MY_ACCOUNT_ID);
// const myPrivateKey = PrivateKey.fromString(process.env.MY_PRIVATE_KEY);
const myPrivateKey = PrivateKey.fromStringECDSA(process.env.MY_PRIVATE_KEY);

// Functions
const getClient = () => {
  // const stakeAccount = "0.0.7027";
  const stakeAccount = AccountId.fromString("0.0.4538944");

  // If we weren't able to grab it, we should throw a new error
  if (!myAccountId || !myPrivateKey) {
    throw new Error(
      "Environment variables MY_ACCOUNT_ID and MY_PRIVATE_KEY must be present"
    );
  }

  // Create our connection to the Hedera network
  // The Hedera JS SDK makes this really easy!
  // const client = Client.forTestnet();
  const client = Client.forMainnet();
  client.setOperator(myAccountId, myPrivateKey);

  return client;
};

const deployContract = async (client) => {
  console.log("⚙️ Deploying contract...");
  const contractDeployTx = await new ContractCreateFlow()
    .setBytecode(bytecode)
    .setGas(3000000)
    // .setAdminKey(myPrivateKey)
    // .setStakedAccountId("0.0.4538944") // SET THIS ONE...
    // .setStakedNodeId(3) // OR THIS ONE - DON'T SET BOTH
    // .setDeclineStakingReward(noRewardFlag) // MISSING IN SDK V2.17 FOR ContractCreateFlow()
    // .setInitialBalance(initialBalance)
    // .setConstructorParameters(constructorParameters)
    // .setContractMemo(memo)
    .setAutoRenewAccountId(myAccountId)
    .setAutoRenewPeriod(7000000)
    // .setMaxAutomaticTokenAssociations(amount)
    .execute(client);

  const contractDeployRx = await contractDeployTx.getReceipt(client);
  const contractId = contractDeployRx.contractId;
  console.log("✅ Contract deployed!");
  console.log("☝️ Contract Id: ", contractId.toString());
};

const updateContract = async (client) => {
  const contractUpdateTx = new ContractUpdateTransaction()
    .setContractId("0.0.3928203")
    // .setStakedAccountId(stakeAccount) // SET THIS ONE...
    .setStakedNodeId(3) // OR THIS ONE - DON'T SET BOTH
    .setDeclineStakingReward(false)
    // .setAdminKey(adminKey)
    // .setContractMemo(memo)
    // .setAutoRenewAccountId(autoRenewAccountId)
    // .setAutoRenewPeriod(autoRenewPeriod)
    // .setContractExpirationTime(expirationTime)
    // .setMaxAutomaticTokenAssociations(amount)
    .freezeWith(client);
  const contractUpdateSign = await contractUpdateTx.sign(myPrivateKey);
  const contractUpdateSubmit = await contractUpdateSign.execute(client);
  const contractUpdateRx = await contractUpdateSubmit.getReceipt(client);

  console.log("contractUpdateRx.status", contractUpdateRx.status);
};

const resetAllowances = async (client, accountId) => {
  const result = await axios.get(
    `https://testnet.mirrornode.hedera.com/api/v1/accounts/${accountId}/allowances/tokens?limit=100&order=desc`
  );

  const allowances = result.data.allowances;
  for (const item of allowances) {
    // Create the transaction
    const transaction = new AccountAllowanceApproveTransaction()
      .approveTokenAllowance(item.token_id, accountId, item.spender, 0)
      .freezeWith(client);

    //Sign the transaction with the owner account key
    const signTx = await transaction.sign(myPrivateKey);

    //Sign the transaction with the client operator private key and submit to a Hedera network
    const txResponse = await signTx.execute(client);

    //Request the receipt of the transaction
    const receipt = await txResponse.getReceipt(client);

    //Get the transaction consensus status
    const transactionStatus = receipt.status;

    console.log(
      "The transaction consensus status is " + transactionStatus.toString()
    );
  }
};

const getContractInfo = async (client, contractId) => {
  const accountInfo = await new ContractInfoQuery()
    .setContractId(contractId)
    .execute(client);
  console.log(`- Staking info:`);
  console.log(`-- stakedAccountId: ${accountInfo.stakingInfo.stakedAccountId}`);
  console.log(`-- stakedNodeId: ${accountInfo.stakingInfo.stakedNodeId}`);
  console.log(`-- pendingRewards: ${accountInfo.stakingInfo.pendingReward}`);
  console.log(
    `-- declineStakingReward: ${accountInfo.stakingInfo.declineStakingReward}`
  );
};

const depositHBAR = async (client, contractId) => {
  console.log("⚙️ Depositing HBAR...");
  const wrappTrans = new ContractExecuteTransaction()
    //Set the ID of the contract
    .setContractId(contractId)
    //Set the gas for the contract call
    .setGas(3000000)
    //Amount of HBAR we want to provide
    .setPayableAmount(1000)
    //Set the contract function to call
    .setFunction("deposit", new ContractFunctionParameters())
    .freezeWith(client);
  const contractWrapSign = await wrappTrans.sign(myPrivateKey);
  const contractWrapSubmit = await contractWrapSign.execute(client);
  const contractWrapRx = await contractWrapSubmit.getReceipt(client);
  console.log("✅ HBAR deposited!");
  console.log("☝️ Transaction status: ", contractWrapRx.status);
};

const createNFT = async (client) => {
  //Create the NFT
  const nftCreate = await new TokenCreateTransaction()
    .setTokenName("test NFT")
    .setTokenSymbol("TNFT")
    .setTokenType(TokenType.NonFungibleUnique)
    .setDecimals(0)
    .setInitialSupply(0)
    .setTreasuryAccountId(myAccountId)
    .setSupplyType(TokenSupplyType.Finite)
    .setMaxSupply(250)
    .setSupplyKey(myPrivateKey)
    .freezeWith(client);

  //Sign the transaction with the treasury key
  const nftCreateTxSign = await nftCreate.sign(myPrivateKey);

  //Submit the transaction to a Hedera network
  const nftCreateSubmit = await nftCreateTxSign.execute(client);

  //Get the transaction receipt
  const nftCreateRx = await nftCreateSubmit.getReceipt(client);

  //Get the token ID
  const tokenId = nftCreateRx.tokenId;

  //Log the token ID
  console.log(`- Created NFT with Token ID: ${tokenId} \n`);
};

const mintNFT = async (client, tokenId) => {
  // Max transaction fee as a constant
  const maxTransactionFee = new Hbar(20);

  //IPFS content identifiers for which we will create a NFT
  const CID = [
    Buffer.from(
      "ipfs://bafyreiao6ajgsfji6qsgbqwdtjdu5gmul7tv2v3pd6kjgcw5o65b2ogst4/metadata.json"
    ),
    Buffer.from(
      "ipfs://bafyreic463uarchq4mlufp7pvfkfut7zeqsqmn3b2x3jjxwcjqx6b5pk7q/metadata.json"
    ),
    Buffer.from(
      "ipfs://bafyreihhja55q6h2rijscl3gra7a3ntiroyglz45z5wlyxdzs6kjh2dinu/metadata.json"
    ),
    Buffer.from(
      "ipfs://bafyreidb23oehkttjbff3gdi4vz7mjijcxjyxadwg32pngod4huozcwphu/metadata.json"
    ),
    Buffer.from(
      "ipfs://bafyreie7ftl6erd5etz5gscfwfiwjmht3b52cevdrf7hjwxx5ddns7zneu/metadata.json"
    ),
  ];

  // MINT NEW BATCH OF NFTs
  const mintTx = new TokenMintTransaction()
    .setTokenId(tokenId)
    .setMetadata(CID) //Batch minting - UP TO 10 NFTs in single tx
    .setMaxTransactionFee(maxTransactionFee)
    .freezeWith(client);

  //Sign the transaction with the supply key
  const mintTxSign = await mintTx.sign(myPrivateKey);

  //Submit the transaction to a Hedera network
  const mintTxSubmit = await mintTxSign.execute(client);

  //Get the transaction receipt
  const mintRx = await mintTxSubmit.getReceipt(client);

  //Log the serial number
  console.log(
    `- Created NFT ${tokenId} with serial: ${mintRx.serials[0].low} \n`
  );
};

const sendNFT = async (client, tokenId, serialNumber, receiverId) => {
  // Check the balance before the transfer for the treasury account
  var balanceCheckTx = await new AccountBalanceQuery()
    .setAccountId(myAccountId)
    .execute(client);
  console.log(
    `- Treasury balance: ${balanceCheckTx.tokens._map.get(
      tokenId.toString()
    )} NFTs of ID ${tokenId}`
  );

  // Check the balance before the transfer for Alice's account
  var balanceCheckTx = await new AccountBalanceQuery()
    .setAccountId(receiverId)
    .execute(client);
  console.log(
    `- Alice's balance: ${balanceCheckTx.tokens._map.get(
      tokenId.toString()
    )} NFTs of ID ${tokenId}`
  );

  // Transfer the NFT from treasury to Alice
  // Sign with the treasury key to authorize the transfer
  const tokenTransferTx = await new TransferTransaction()
    .addNftTransfer(tokenId, serialNumber, myAccountId, receiverId)
    .freezeWith(client)
    .sign(myPrivateKey);

  const tokenTransferSubmit = await tokenTransferTx.execute(client);
  const tokenTransferRx = await tokenTransferSubmit.getReceipt(client);

  console.log(
    `\n- NFT transfer from Treasury to Alice: ${tokenTransferRx.status} \n`
  );

  // Check the balance of the treasury account after the transfer
  var balanceCheckTx = await new AccountBalanceQuery()
    .setAccountId(myAccountId)
    .execute(client);
  console.log(
    `- Treasury balance: ${balanceCheckTx.tokens._map.get(
      tokenId.toString()
    )} NFTs of ID ${tokenId}`
  );

  // Check the balance of Alice's account after the transfer
  var balanceCheckTx = await new AccountBalanceQuery()
    .setAccountId(receiverId)
    .execute(client);
  console.log(
    `- Alice's balance: ${balanceCheckTx.tokens._map.get(
      tokenId.toString()
    )} NFTs of ID ${tokenId}`
  );
};

const createAccount = async (client) => {
  const newAccountPrivateKey = PrivateKey.generateECDSA();
  const newAccountPublicKey = newAccountPrivateKey.publicKey;

  //Create a new account with 1,000 tinybar starting balance
  const newAccount = await new AccountCreateTransaction()
    .setKey(newAccountPublicKey)
    .setInitialBalance(Hbar.fromTinybars(1000))
    .execute(client);

  // Get the new account ID
  const getReceipt = await newAccount.getReceipt(client);
  const newAccountId = getReceipt.accountId;

  //Log the account ID
  console.log("The new account ID is: " + newAccountId);
  console.log("The new account PK is: " + newAccountPrivateKey);
};

// Init
const client = getClient();

// await deployContract(client);

// await createNFT(client);

// await mintNFT(client, "0.0.15439552");

// await sendNFT(client, "0.0.15439552", 2, "0.0.7027");

// await depositHBAR(client, "0.0.4539024");

// await getContractInfo(client, "0.0.4539024");

await createAccount(client);

/* 
Staking info for `0.0.4539024`
- Staking info:
-- stakedAccountId: 0.0.4538944
-- stakedNodeId: null
-- declineStakingReward: false
*/
