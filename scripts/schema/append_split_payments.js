const fs = require('fs');
const path = 'e:\\Protocol Bank\\Development\\历史版本\\protocol-banks---web3-main\\prisma\\schema.prisma';
const schema = fs.readFileSync(path, 'utf8');
const newModel = `

model PaymentSplitTemplate {
  id              String   @id @default(uuid())
  owner_address   String
  team_id         String?
  name            String
  description     String?
  recipients      Json
  is_active       Boolean  @default(true)
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt

  @@index([owner_address])
  @@index([team_id])
  @@map("payment_split_templates")
}

model PaymentSplitExecution {
  id              String   @id @default(uuid())
  owner_address   String
  template_id     String?
  team_id         String?
  total_amount    String
  token           String
  chain_id        Int
  recipients      Json
  status          String   @default("pending")
  tx_hash         String?
  error_message   String?
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt

  @@index([owner_address])
  @@index([template_id])
  @@map("payment_split_executions")
}
`;
fs.writeFileSync(path, schema + newModel);
console.log('Appended PaymentSplit models.');
