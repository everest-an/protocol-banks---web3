const fs = require('fs');
const schemaPath = 'prisma/schema.prisma';

const newModels = `
model ChannelSettlement {
  id               String   @id
  channel_id       String
  amount           String
  status           String   @default("processing")
  transaction_hash String?
  created_at       DateTime @default(now())
  completed_at     DateTime?
  
  @@map("channel_settlements")
}
`;

const schema = fs.readFileSync(schemaPath, 'utf8');
if (!schema.includes('model ChannelSettlement')) {
  fs.writeFileSync(schemaPath, schema + newModels);
  console.log('Appended ChannelSettlement model.');
} else {
  console.log('Model already exists.');
}
