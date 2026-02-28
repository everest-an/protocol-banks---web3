const fs = require('fs');
const path = 'e:\\Protocol Bank\\Development\\历史版本\\protocol-banks---web3-main\\prisma\\schema.prisma';
const schema = fs.readFileSync(path, 'utf8');
const newModel = `

model SubscriptionAuthorization {
  id              String   @id @default(uuid())
  subscription_id String
  status          String   @default("active")
  signature       String
  created_at      DateTime @default(now())

  @@index([subscription_id])
  @@map("subscription_authorizations")
}
`;
fs.writeFileSync(path, schema + newModel);
console.log('Appended SubscriptionAuthorization model.');
