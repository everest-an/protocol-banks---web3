const fs = require('fs');
const path = 'e:\\Protocol Bank\\Development\\历史版本\\protocol-banks---web3-main\\prisma\\schema.prisma';
const schema = fs.readFileSync(path, 'utf8');
const newModel = `

model SubscriptionPayment {
  id              String   @id @default(uuid())
  subscription_id String
  amount          String
  tx_hash         String?
  status          String   @default("completed")
  created_at      DateTime @default(now())

  @@index([subscription_id])
  @@map("subscription_payments")
}
`;
fs.writeFileSync(path, schema + newModel);
console.log('Appended SubscriptionPayment model.');
