import { protocolBanksTrader } from "./agent"

const prompt =
  process.argv.slice(2).join(" ") ||
  "Read my policy, then place a $20 BTC long. If the server refuses it, stop and quote the refusal."

protocolBanksTrader
  .generate(prompt)
  .then((result) => console.log(result.text))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
