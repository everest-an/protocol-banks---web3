const fs = require('fs');
const schemaPath = 'prisma/schema.prisma';

const newModels = `
model MultisigWallet {
  id            String   @id @default(uuid())
  name          String
  address       String   @unique
  chain_id      Int
  threshold     Int
  signers       String[]
  owner_address String
  created_at    DateTime @default(now())
  updated_at    DateTime @updatedAt
  
  transactions  MultisigTransaction[]

  @@map("multisig_wallets")
}

model MultisigTransaction {
  id                String   @id @default(uuid())
  multisig_id       String
  to_address        String
  value             String
  data              String?
  nonce             Int
  status            String   
  threshold         Int
  execution_tx_hash String?
  error_message     String?
  created_by        String
  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt
  
  multisig_wallet   MultisigWallet @relation(fields: [multisig_id], references: [id]) // Renamed relation field to avoid conflict with field name if any
  confirmations     MultisigConfirmation[]

  @@map("multisig_transactions")
}

model MultisigConfirmation {
  id             String   @id @default(uuid())
  transaction_id String
  signer_address String
  signature      String
  confirmed_at   DateTime @default(now())
  
  transaction    MultisigTransaction @relation(fields: [transaction_id], references: [id])
  
  @@unique([transaction_id, signer_address])
  @@map("multisig_confirmations")
}
`;

const schema = fs.readFileSync(schemaPath, 'utf8');
if (!schema.includes('model MultisigWallet')) {
  fs.writeFileSync(schemaPath, schema + newModels);
  console.log('Appended Multisig models.');
} else {
  console.log('Models already exist.');
}
