import {
  Client,
  PrivateKey,
  PublicKey,
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
  Mnemonic,
  FileCreateTransaction,
  FileUpdateTransaction,
  FileContentsQuery,
  FileInfoQuery,
  FreezeTransaction,
  NetworkVersionInfoQuery,
} from "@hashgraph/sdk";
import { proto } from "@hashgraph/proto";
import axios from "axios";
import * as dotenv from "dotenv";
import WHBAR from "./abi/WHBAR.json" assert { type: "json" };
import fs from "fs";

dotenv.config();
console.clear();

const bytecode = WHBAR.bytecode;

//Grab your Hedera testnet account ID and private key from your .env file
const myAccountId = AccountId.fromString(process.env.MY_ACCOUNT_ID);
const myPrivateKey = PrivateKey.fromStringECDSA(process.env.MY_PRIVATE_KEY);
// const myPrivateKey = PrivateKey.fromStringED25519(process.env.MY_PRIVATE_KEY);

// Functions
const getClient = () => {
  if (!myAccountId || !myPrivateKey) {
    throw new Error(
      "Environment variables MY_ACCOUNT_ID and MY_PRIVATE_KEY must be present"
    );
  }

  // Create our connection to the Hedera network
  // const client = Client.forTestnet();
  // const client = Client.forPreviewnet();
  const client = Client.forMainnet();

  // Local node settings
  // const node = { "127.0.0.1:50211": new AccountId(3) };
  // const client = Client.forNetwork(node).setMirrorNetwork("127.0.0.1:5600");

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

const transferHBAR = async (client, amount, receiverId) => {
  const transaction = new TransferTransaction()
    .addHbarTransfer(myAccountId, new Hbar(-amount))
    .addHbarTransfer(receiverId, new Hbar(amount))
    .freezeWith(client);

  const contractUpdateSign = await transaction.sign(myPrivateKey);
  const contractUpdateSubmit = await contractUpdateSign.execute(client);
  const contractUpdateRx = await contractUpdateSubmit.getReceipt(client);

  console.log("contractUpdateRx.status", contractUpdateRx.status);
};

const unwrapHBAR = async (client, amount) => {
  const transaction = new ContractExecuteTransaction()
    //Set the ID of the contract
    .setContractId("0.0.2934819")
    //Set the contract function to call
    .setGas(3000000)
    .setFunction(
      "withdraw",
      new ContractFunctionParameters().addUint256(amount)
    )
    .freezeWith(client);

  const contractUpdateSign = await transaction.sign(myPrivateKey);
  const contractUpdateSubmit = await contractUpdateSign.execute(client);
  const contractUpdateRx = await contractUpdateSubmit.getReceipt(client);

  console.log("contractUpdateRx.status", contractUpdateRx.status);
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

const createAccountWithKeys = async (client, pkString) => {
  const newAccountPrivateKey = PrivateKey.fromStringED25519(pkString);
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

const createMnemonic = async () => {
  const mnemonic = await Mnemonic.generate();
  console.log("mnemonic: ", mnemonic);
};

const recoverMnemonic = async (mnemonic) => {
  const recoveredMnemonic = await Mnemonic.fromString(mnemonic.toString());
  const privateKey = await recoveredMnemonic.toStandardEd25519PrivateKey("", 0);

  console.log("privateKey", privateKey.toString());
  console.log("publicKey", privateKey.publicKey.toString());
  console.log("publicKey", privateKey.publicKey.toAccountId(0, 0));
};

const createFileTransaction = async (client, content) => {
  //Create the transaction
  const transaction = await new FileCreateTransaction()
    .setKeys([myPrivateKey.publicKey])
    .setContents(content)
    .setMaxTransactionFee(new Hbar(2))
    .freezeWith(client);

  //Sign with the file private key
  const signTx = await transaction.sign(myPrivateKey);

  //Sign with the client operator private key and submit to a Hedera network
  const submitTx = await signTx.execute(client);

  //Request the receipt
  const receipt = await submitTx.getReceipt(client);

  //Get the file ID
  const newFileId = receipt.fileId;

  console.log("The new file ID is: " + newFileId);
};

const updateFileTransaction = async (client, fileId, content) => {
  //Update the transaction
  const transaction = await new FileUpdateTransaction()
    .setFileId(fileId)
    .setContents(content)
    .setMaxTransactionFee(new Hbar(2))
    .freezeWith(client);

  //Sign with the file private key
  const signTx = await transaction.sign(myPrivateKey);

  //Sign with the client operator private key and submit to a Hedera network
  const submitTx = await signTx.execute(client);

  //Request the receipt
  const receipt = await submitTx.getReceipt(client);

  //Get the transaction consensus status
  const transactionStatus = receipt.status;

  console.log(
    "The transaction consensus status " + transactionStatus.toString()
  );
};

const updateRateExchangeFileTransaction = async (client, fileId) => {
  const newRate = proto.ExchangeRateSet.create({
    currentRate: {
      hbarEquiv: 10,
      expirationTime: "1963-11-25T17:31:44.000Z",
      centEquiv: 120,
    },
    nextRate: {
      hbarEquiv: 10,
      expirationTime: "1963-11-25T17:31:44.000Z",
      centEquiv: 111110,
    },
  });

  const encoded = proto.ExchangeRateSet.encode(newRate).finish();

  //Update the transaction
  const transaction = await new FileUpdateTransaction()
    .setFileId(fileId)
    .setContents(encoded.toString())
    .setMaxTransactionFee(new Hbar(2))
    .freezeWith(client);

  //Sign with the file private key
  const signTx = await transaction.sign(myPrivateKey);

  //Sign with the client operator private key and submit to a Hedera network
  const submitTx = await signTx.execute(client);

  //Request the receipt
  const receipt = await submitTx.getReceipt(client);

  //Get the transaction consensus status
  const transactionStatus = receipt.status;

  console.log(
    "The transaction consensus status " + transactionStatus.toString()
  );
};

const getFileContentTransaction = async (client, fileId) => {
  const transaction = new FileContentsQuery().setFileId(fileId);

  //Sign with client operator private key and submit the query to a Hedera network
  const contents = await transaction.execute(client);

  // console.log(contents.toString());
  console.log(proto.NodeAddressBook.decode(contents)); // 0.0.101 / 0.0.102
  // console.log(proto.CurrentAndNextFeeSchedule.decode(contents)); // 0.0.111
  // console.log(proto.ExchangeRateSet.decode(contents)); // 0.0.112
  // console.log(proto.ServicesConfigurationList.decode(contents)); // 0.0.121
  // console.log(proto.ServicesConfigurationList.decode(contents)); // 0.0.121/122
  // console.log(proto.ThrottleDefinitions.decode(contents)); // 0.0.123
};

const getFileInfoQuery = async (client, fileId) => {
  const transaction = new FileInfoQuery().setFileId(fileId);

  //Sign the query with the client operator private key and submit to a Hedera network
  const getInfo = await transaction.execute(client);
  console.log("getInfo", getInfo);
  const keylist = getInfo.keys.toArray().map((k) => normalizePublicKey(k));

  console.log(keylist);
  // const decodedKeys = flattenKeyList(getInfo.keys);

  console.log("File keys: " + keylist);
};

const freezeAndUpgradeTransaction = async (client) => {
  const prepareUpgradeTx = await new FreezeTransaction()
    .setFreezeType(proto.FreezeType.PrepareUpgrade)
    .freezeWith(client)
    .execute(client);

  const prepareUpgradeReceipt = await prepareUpgradeTx.getReceipt(client);

  console.log(
    r`Upgrade prepared with transaction id: ${prepareUpgradeTx.transactionId.toString()}`,
    prepareUpgradeReceipt.status.toString()
  );

  const freezeUpgradeTx = await new FreezeTransaction()
    .setFreezeType(proto.FreezeType.FreezeUpgrade)
    .freezeWith(client)
    .execute(client);
  const freezeUpgradeReceipt = await freezeUpgradeTx.getReceipt(client);

  console.log(
    `Freeze upgrade finished with transaction id: ${freezeUpgradeTx.transactionId.toString()}`,
    freezeUpgradeReceipt.status.toString()
  );

  //8. Check New Version
  console.log(await new NetworkVersionInfoQuery().execute(client));
};

function normalizePublicKey(key) {
  const protoBuffKey = key._toProtobufKey();

  if (protoBuffKey.ed25519) {
    return PublicKey.fromBytesED25519(protoBuffKey.ed25519).toStringRaw();
  } else if (protoBuffKey.ECDSASecp256k1) {
    return PublicKey.fromBytesECDSA(protoBuffKey.ECDSASecp256k1).toStringRaw();
  }
  return "";
}

const flattenKeyList = (keyList) => {
  const protobufKey = keyList._toProtobufKey();

  let keys = [];
  const keysString = [];

  formatKey(protobufKey);

  function getPublicKeyFromIKey(ikey) {
    if (ikey.ed25519) {
      return PublicKey.fromBytesED25519(ikey.ed25519);
    }
    if (ikey.ECDSASecp256k1) {
      return PublicKey.fromBytesECDSA(ikey.ECDSASecp256k1);
    }
  }

  function formatKey(key) {
    if (key.thresholdKey) {
      key.thresholdKey.keys?.keys.forEach((key) => {
        formatKey(key);
      });
    } else if (key.keyList) {
      keys = key.keyList.keys.map((k) => getPublicKeyFromIKey(k));
    } else {
      const pk = getPublicKeyFromIKey(key);
      if (pk && !keysString.includes(pk.toStringRaw())) {
        keys.push(pk);
        keysString.push(pk.toStringRaw());
      }
    }
  }

  return keys;
};

const words = [
  "omit",
  "review",
  "special",
  "brass",
  "miss",
  "honey",
  "person",
  "train",
  "venue",
  "scissors",
  "garage",
  "forget",
  "crack",
  "jeans",
  "nothing",
  "great",
  "photo",
  "dance",
  "nominee",
  "dash",
  "avoid",
  "simple",
  "family",
  "trick",
];

const extractUniqueAddressesFromContract = async (contractId) => {
  const startDateTimestamp = 1693440000;
  const endDateTimestamp = Date.now() / 1000;
  const step = 24 * 60 * 60;
  let addresses = [];

  for (let i = startDateTimestamp; i < endDateTimestamp; i += step) {
    const result = await axios(
      `https://mainnet-public.mirrornode.hedera.com/api/v1/contracts/${contractId}/results?limit=200&order=asc&timestamp=gt:${i}`
    );
    const found = result.data.results.map((item) => item.from);
    addresses = [...addresses, ...found];
  }

  const uniqueAddresses = addresses.filter(
    (item, index) => addresses.indexOf(item) === index
  );

  const chunkSize = 100;
  for (let i = 0; i < uniqueAddresses.length; i += chunkSize) {
    const chunk = uniqueAddresses.slice(i, i + chunkSize);
    console.log(`chunk ${i} - ${i + chunkSize}`, chunk);
  }

  console.log("All addresses: ", addresses.length);
  console.log("Unique addresses: ", uniqueAddresses.length);

  // Write data in 'Output.txt' .
  // fs.writeFile("addresses.txt", JSON.stringify(uniqueAddresses),, (err) => {
  //   // In case of a error throw err.
  //   if (err) throw err;
  // });
};

// Init
const client = getClient();

/* Contracts */
// await deployContract(client);
// await getContractInfo(client, "0.0.4539024");

/* NFTs */
// await createNFT(client);
// await mintNFT(client, "0.0.15439552");
// await sendNFT(client, "0.0.15439552", 2, "0.0.7027");

/* Accounts */
// await createMnemonic();
// await createKeyPair();
// await recoverMnemonic(words);
// await createAccount(client);
// await createAccountWithKeys(
//   client,
//   "302e020100300506032b6570042204207657e9c21813b249baebde8c66a9d49801a7b29a5f564bf6aa993b2746fc1346"
// );
// await transferHBAR(client, 10, "0.0.194955");

/* Files */
// await createFileTransaction(client, "Test 123");
// await updateFileTransaction(client, "0.0.6728676", "123Test");
// await updateRateExchangeFileTransaction(client, "0.0.112");
// await getFileInfoQuery(client, "0.0.111");
await getFileContentTransaction(client, "0.0.101");

/* Network Upgrade */
// await freezeAndUpgradeTransaction(client);

// await extractUniqueAddressesFromContract("0.0.3696885");
// await unwrapHBAR(client, "57870000009");
