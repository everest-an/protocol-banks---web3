const fs = require('fs');
const schemaPath = 'prisma/schema.prisma';

const newModels = `
model PaymentChannel {
  id                     String    @id
  provider_id            String
  consumer_id            String
  consumer_address       String
  session_key_public_key String?
  deposit_amount         String    @default("0")
  spent_amount           String    @default("0")
  pending_amount         String    @default("0")
  settlement_threshold   String    @default("10")
  auto_settle_interval   Int       @default(3600)
  status                 String    @default("open")
  last_settlement_at     DateTime?
  expires_at             DateTime
  created_at             DateTime  @default(now())
  closed_at              DateTime?
  last_activity_at       DateTime?
  
  payments               ChannelPayment[]

  @@map("payment_channels")
}

model ChannelPayment {
  id               String   @id
  channel_id       String
  amount           String
  resource         String
  metadata         Json?
  status           String   @default("pending")
  settled_in_batch String?
  created_at       DateTime @default(now())
  
  channel          PaymentChannel @relation(fields: [channel_id], references: [id])

  @@map("channel_payments")
}
`;

const schema = fs.readFileSync(schemaPath, 'utf8');
if (!schema.includes('model PaymentChannel')) {
  fs.writeFileSync(schemaPath, schema + newModels);
  console.log('Appended PaymentChannel and ChannelPayment models.');
} else {
  console.log('Models already exist.');
}
