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
  const client = Client.forTestnet();
  // const client = Client.forMainnet();
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

// Init
const client = getClient();

await deployContract(client);

// await depositHBAR(client, "0.0.4539024");

// await getContractInfo(client, "0.0.4539024");

/* 
Staking info for `0.0.4539024`
- Staking info:
-- stakedAccountId: 0.0.4538944
-- stakedNodeId: null
-- declineStakingReward: false
*/
