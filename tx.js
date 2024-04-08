const {
  Client,
  PrivateKey,
  AccountUpdateTransaction,
  TransactionId,
  AccountId,
  Timestamp,
  Transaction,
  PublicKey,
} = require("@hashgraph/sdk");
const { proto } = require("@hashgraph/proto");

require("dotenv").config();

async function main() {
  //                                                                           //
  // //                                                                     // //
  // // /////////////////////////////////////////////////////////////////// // //
  // //                                                                     // //
  //                                                                           //

  /* Setup */
  console.log("Setup Private Key and Account ID");
  if (process.env.MY_PRIVATE_KEY == null) {
    throw new Error(
      "Environment variables ACCOUNT_ID, and PRIVATE_KEY are required."
    );
  }
  const privateKey = PrivateKey.fromStringECDSA(process.env.MY_PRIVATE_KEY);
  const accountId = AccountId.fromString(process.env.MY_ACCOUNT_ID);
  console.log(` Private Key: ${privateKey.toStringRaw()}`);
  console.log(` Public Key: ${privateKey.publicKey.toStringRaw()}`);
  console.log(` Account ID: ${accountId.toString()}`);
  console.log("----------------------------------------------- \n");

  //                                                                           //
  // //                                                                     // //
  // // /////////////////////////////////////////////////////////////////// // //
  // //                                                                     // //
  //                                                                           //

  /* User Creates the Transaction */
  const transactionId = new TransactionId(
    accountId,
    Timestamp.fromDate(new Date())
  );

  let transaction = new AccountUpdateTransaction()
    .setTransactionId(transactionId)
    .setAccountId(accountId);
  console.log("Create Account Update Transaction");
  console.log(` Update Account ID: ${accountId.toString()}`);
  console.log("----------------------------------------------- \n");

  //                                                                           //
  // //                                                                     // //
  // // /////////////////////////////////////////////////////////////////// // //
  // //                                                                     // //
  //                                                                           //

  /* User Serializes the Transaction */
  let hexTransactionBytes = encode(transaction.toBytes());
  console.log("Serialize Transaction without freezing");
  console.log(` Transaction: ${hexTransactionBytes}`);
  console.log("----------------------------------------------- \n");

  //                                                                           //
  // //                                                                     // //
  // // /////////////////////////////////////////////////////////////////// // //
  // //                                                                     // //
  //                                                                           //

  /* User Sends the Transaction to Backend */
  console.log("Sending Transaction to Backend............ \n");

  //                                                                           //
  // //                                                                     // //
  // // /////////////////////////////////////////////////////////////////// // //
  // //                                                                     // //
  //                                                                           //

  /* Backend Receives the Transaction */
  console.log("Backend receives the transaction");
  console.log(` Transaction: ${hexTransactionBytes}`);
  console.log("----------------------------------------------- \n");

  //                                                                           //
  // //                                                                     // //
  // // /////////////////////////////////////////////////////////////////// // //
  // //                                                                     // //
  //                                                                           //

  /* Backend Deserializes the Transaction */
  transaction = Transaction.fromBytes(decode(hexTransactionBytes));
  console.log("Backend deserizalizes the transaction");
  console.log(` Update Account ID: ${transaction.accountId.toString()}`);
  console.log("----------------------------------------------- \n");

  //                                                                           //
  // //                                                                     // //
  // // /////////////////////////////////////////////////////////////////// // //
  // //                                                                     // //
  //                                                                           //

  /* Backend freezes the Transaction */
  const client = Client.forTestnet();
  transaction = transaction.freezeWith(client);
  hexTransactionBytes = encode(transaction.toBytes());
  console.log("Backend freezes the transaction");
  console.log(` Transaction frozen: ${transaction.isFrozen()}`);
  console.log("----------------------------------------------- \n");

  //                                                                           //
  // //                                                                     // //
  // // /////////////////////////////////////////////////////////////////// // //
  // //                                                                     // //
  //                                                                           //

  /* Logging the Node Accounts IDs */
  console.log("Node Account IDs");
  console.log(
    `  ${transaction.nodeAccountIds.map((accountId) => accountId.toString())}`
  );
  console.log("----------------------------------------------- \n");

  //                                                                           //
  // //                                                                     // //
  // // /////////////////////////////////////////////////////////////////// // //
  // //                                                                     // //
  //                                                                           //

  /* User Fetches the Required Transaction for Signing */
  console.log("User fetches the required transaction for signing");
  console.log(` Transaction: ${hexTransactionBytes}`);
  console.log("----------------------------------------------- \n");

  //                                                                           //
  // //                                                                     // //
  // // /////////////////////////////////////////////////////////////////// // //
  // //                                                                     // //
  //                                                                           //

  /* User Deserializes the Transaction */
  transaction = AccountUpdateTransaction.fromBytes(decode(hexTransactionBytes));
  console.log("User deserizalizes the transaction");
  console.log(` Update Account ID: ${transaction.accountId.toString()}`);
  console.log("----------------------------------------------- \n");

  //                                                                           //
  // //                                                                     // //
  // // /////////////////////////////////////////////////////////////////// // //
  // //                                                                     // //
  //                                                                           //

  /* Manually Sign Transaction for All Nodes */
  console.log("Manually sign transaction for all nodes");
  const signatures = getSignatures(privateKey, transaction);
  console.log("----------------------------------------------- \n");

  //                                                                           //
  // //                                                                     // //
  // // /////////////////////////////////////////////////////////////////// // //
  // //                                                                     // //
  //                                                                           //

  /* After backend receives the signatures */
  console.log("Backend receives the signatures");
  console.log(
    " Backend validates the signatures correspond to the provided public key"
  );
  const allValid = signatures.signatures.every((signature) =>
    validateSignature(transaction, signature, signatures.publicKey)
  );
  if (!allValid) throw new Error("Invalid signature");

  console.log(" Backend adds the signatures to the transaction");
  addSignatureForNodeToTransaction(transaction, signatures);

  console.log("\n Signatures: ");
  printSignatureMap(transaction.getSignatures());

  console.log("\n Public keys of signers:");
  console.log(`   ${[...transaction._signerPublicKeys].join(", ")}`);
  console.log("----------------------------------------------- \n");

  //                                                                           //
  // //                                                                     // //
  // // /////////////////////////////////////////////////////////////////// // //
  // //                                                                     // //
  //                                                                           //

  /* Backend Serializes the Transaction */
  console.log("Backend serializes the transaction");
  const signedTransactionBytesHex = encode(transaction.toBytes());
  console.log(` Signed Transaction: ${signedTransactionBytesHex}`);
  console.log("----------------------------------------------- \n");

  //                                                                           //
  // //                                                                     // //
  // // /////////////////////////////////////////////////////////////////// // //
  // //                                                                     // //
  //                                                                           //

  /* Time for Execution */
  console.log("Time for execution");
  console.log("Backend deserializes the signed transaction");
  transaction = AccountUpdateTransaction.fromBytes(
    decode(signedTransactionBytesHex)
  );
  console.log(` Update Account ID: ${transaction.accountId.toString()}`);
  console.log(" Public keys of signers:");
  console.log(`   ${[...transaction._signerPublicKeys].join(", ")}`);
  console.log("----------------------------------------------- \n");

  //                                                                           //
  // //                                                                     // //
  // // /////////////////////////////////////////////////////////////////// // //
  // //                                                                     // //
  //                                                                           //

  /* Execute */
  console.log("Backend executes the transaction");
  const response = await transaction.execute(client);
  const receipt = await response.getReceipt(client);

  console.log(` Status: ${receipt.status.toString()}`);
  client.close();

  //                                                                           //
  // //                                                                     // //
  // // /////////////////////////////////////////////////////////////////// // //
  // //                                                                     // //
  //                                                                           //
}

void main();

function getSignatures(privateKey, transaction) {
  const signatures = [];

  for (const { bodyBytes } of transaction._signedTransactions.list) {
    const { nodeAccountID } = proto.TransactionBody.decode(bodyBytes);
    const nodeAccountId = AccountId._fromProtobuf(nodeAccountID);

    const signature = privateKey.sign(bodyBytes);
    const signatureObject = {
      nodeAccountId: nodeAccountId.toString(),
      signatureHex: encode(signature),
    };
    signatures.push(signatureObject);
  }

  const result = { publicKey: privateKey.publicKey.toStringRaw(), signatures };
  printSignatures(result);
  return result;
}

function validateSignature(transaction, signature, publicKey) {
  const nodeAccountId = AccountId.fromString(signature.nodeAccountId);
  publicKey = PublicKey.fromString(publicKey);
  const signatureHex = decode(signature.signatureHex);

  const transactionBody = transaction._makeTransactionBody(nodeAccountId);
  const bodyBytes = proto.TransactionBody.encode(transactionBody).finish();

  try {
    return publicKey.verify(bodyBytes, signatureHex);
  } catch {
    return false;
  }
}

function addSignatureForNodeToTransaction(transaction, signatureObject) {
  if (signatureObject.signatures.length === 0) {
    return;
  }

  const publicKey = PublicKey.fromString(signatureObject.publicKey);
  const publicKeyHex = publicKey.toStringRaw();

  if (!transaction.isFrozen()) transaction.freeze();
  if (transaction._signerPublicKeys.has(publicKeyHex)) return;

  transaction._transactionIds.setLocked();
  transaction._nodeAccountIds.setLocked();
  transaction._signedTransactions.setLocked();

  for (const subTransaction of transaction._signedTransactions.list) {
    const { nodeAccountID } = proto.TransactionBody.decode(
      subTransaction.bodyBytes
    );
    const nodeAccountId = AccountId._fromProtobuf(nodeAccountID);

    const signature = signatureObject.signatures.find(
      (s) => s.nodeAccountId === nodeAccountId.toString()
    );

    if (!signature) {
      throw new Error(
        `Signature for Node with Account ID ${nodeAccountId.toString()} Not Found`
      );
    }

    if (subTransaction.sigMap == null) {
      subTransaction.sigMap = {};
    }

    if (subTransaction.sigMap.sigPair == null) {
      subTransaction.sigMap.sigPair = [];
    }

    subTransaction.sigMap.sigPair.push(
      publicKey._toProtobufSignature(decode(signature.signatureHex))
    );
  }

  transaction._signerPublicKeys.add(publicKeyHex);
  transaction._publicKeys.push(publicKey);
  transaction._transactionSigners.push(null);
}

function encode(buffer) {
  return "0x" + Buffer.from(buffer).toString("hex");
}

function decode(hexString) {
  return Uint8Array.from(
    Buffer.from(
      hexString.startsWith("0x") ? hexString.slice(2) : hexString,
      "hex"
    )
  );
}

function printSignatures(signatureObject) {
  console.log("-------------------");
  console.log(`| Public Key: ${signatureObject.publicKey}`);
  console.log("|");
  console.log("|------------------");

  signatureObject.signatures.forEach((signature) => {
    printSignature(signature);
  });

  function printSignature(signature) {
    console.log(`| Node Account ID: ${signature.nodeAccountId}`);
    console.log(`| Signature: ${signature.signatureHex}`);
    console.log("|------------------");
  }
}

function printSignatureMap(signatureMap) {
  signatureMap._map.forEach((value, key) => {
    console.log("-------------------");
    console.log(`| Node Account: ${key}`);
    console.log(`| Signature:`);
    value.__map.forEach((value, key) => {
      console.log(`|  Public key: ${key.toStringRaw()}`);
      console.log(`|  Bytes: ${encode(value)}`);
    });
    console.log("-------------------");
  });
}
