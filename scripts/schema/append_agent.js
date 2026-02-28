const fs = require('fs');
const schemaPath = 'prisma/schema.prisma';

const newModels = `
model Agent {
  id                    String   @id @default(uuid())
  owner_address         String
  name                  String
  description           String?
  type                  String   @default("custom")
  avatar_url            String?
  api_key_hash          String   @unique
  api_key_prefix        String
  webhook_url           String?
  webhook_secret_hash   String?
  status                String   @default("active")
  auto_execute_enabled  Boolean  @default(false)
  auto_execute_rules    Json?
  rate_limit_per_minute Int      @default(60)
  created_at            DateTime @default(now())
  updated_at            DateTime @updatedAt
  last_active_at        DateTime?
  
  @@map("agents")
}
`;

const schema = fs.readFileSync(schemaPath, 'utf8');
if (!schema.includes('model Agent')) {
  fs.writeFileSync(schemaPath, schema + newModels);
  console.log('Appended Agent model.');
} else {
  console.log('Model already exists.');
}
