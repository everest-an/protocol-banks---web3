const fs = require('fs');
const schemaPath = 'prisma/schema.prisma';

const newModels = `
model AgentBudget {
  id               String   @id @default(uuid())
  agent_id         String
  owner_address    String
  amount           String
  token            String
  chain_id         Int?
  period           String
  used_amount      String   @default("0")
  remaining_amount String
  period_start     DateTime
  period_end       DateTime?
  created_at       DateTime @default(now())
  updated_at       DateTime @updatedAt
  
  agent            Agent    @relation(fields: [agent_id], references: [id])
  
  @@map("agent_budgets")
}
`;

const schema = fs.readFileSync(schemaPath, 'utf8');
if (!schema.includes('model AgentBudget')) {
  fs.writeFileSync(schemaPath, schema + newModels);
  console.log('Appended AgentBudget model.');
} else {
  console.log('Model already exists.');
}
