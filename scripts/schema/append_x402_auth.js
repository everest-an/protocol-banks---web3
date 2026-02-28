const fs = require('fs');
const path = 'e:\\Protocol Bank\\Development\\历史版本\\protocol-banks---web3-main\\prisma\\schema.prisma';
const schema = fs.readFileSync(path, 'utf8');
const newModel = `

model X402Authorization {
  id              String   @id @default(uuid())
  from_address    String
  to_address      String
  status          String
  valid_before    DateTime
  signature       String
  created_at      DateTime @default(now())
  updated_at      DateTime @updatedAt

  @@index([from_address, to_address])
  @@index([status])
  @@map("x402_authorizations")
}
`;
fs.writeFileSync(path, schema + newModel);
console.log('Appended X402Authorization model.');
