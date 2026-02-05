/**
 * HTTP 402 Micropayment Gateway Test Script
 *
 * Run with: npx tsx tests/test-http-402.ts
 */

import { PBStreamClient } from "../lib/sdk/pb-stream-client"

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

async function testHTTP402() {
  console.log("🧪 测试 HTTP 402 微支付网关\n")
  console.log("=" .repeat(60))

  // 1. 创建客户端
  console.log("\n📱 步骤 1: 创建 PB-Stream 客户端")
  const client = new PBStreamClient({
    baseUrl: BASE_URL,
    // Test placeholder — replace with real Session Key for integration testing
    // 可以通过 POST /api/session-keys 创建
    sessionKey: "test_session_key_demo",
    autoRetry: true,
    lowBalanceThreshold: 2, // 余额低于 $2 时警告
    onPaymentSuccess: (paymentId, amount) => {
      console.log(`   ✅ 支付成功: ${paymentId}, 金额: ${amount} USDC`)
    },
    onPaymentFailure: (error) => {
      console.error(`   ❌ 支付失败: ${error}`)
    },
    onLowBalance: (balance) => {
      console.warn(`   ⚠️  余额不足警告: 剩余 ${balance} USDC`)
    },
  })
  console.log("   ✅ 客户端已创建")

  try {
    // 2. 开通支付通道
    console.log("\n💳 步骤 2: 开通支付通道")
    console.log("   参数: 存入 $10, 阈值 $5, 有效期 24小时")

    const channel = await client.openChannel({
      providerId: "test_ai_demo",
      depositAmount: "10", // $10
      settlementThreshold: "5", // 累积 $5 后自动结算
      durationSeconds: 24 * 3600, // 24小时
    })

    console.log(`   ✅ 通道已开通`)
    console.log(`   通道 ID: ${channel.id}`)
    console.log(`   存入金额: ${channel.depositAmount} USDC`)
    console.log(`   状态: ${channel.status}`)
    console.log(`   过期时间: ${channel.expiresAt}`)

    // 3. 第一次调用 API
    console.log("\n🤖 步骤 3: 第一次调用 AI API")
    console.log("   提示: 'What is the meaning of life?'")

    const response1 = await client.fetchJson<any>("/api/test/ai-demo", {
      method: "POST",
      body: JSON.stringify({
        prompt: "What is the meaning of life?",
      }),
    })

    console.log(`   ✅ API 响应成功`)
    console.log(`   结果: ${response1.result?.substring(0, 80)}...`)
    console.log(`   Token 数: ${response1.usage?.tokens}`)
    console.log(`   费用: ${response1.usage?.cost} USDC`)
    console.log(`   💰 剩余余额: ${client.getRemainingBalance()} USDC`)

    // 4. 第二次调用（测试累积）
    console.log("\n🤖 步骤 4: 第二次调用 AI API")
    console.log("   提示: 'Explain quantum physics'")

    const response2 = await client.fetchJson<any>("/api/test/ai-demo", {
      method: "POST",
      body: JSON.stringify({
        prompt: "Explain quantum physics",
      }),
    })

    console.log(`   ✅ API 响应成功`)
    console.log(`   结果: ${response2.result?.substring(0, 80)}...`)
    console.log(`   💰 剩余余额: ${client.getRemainingBalance()} USDC`)

    // 5. 第三次调用
    console.log("\n🤖 步骤 5: 第三次调用 AI API")
    console.log("   提示: 'What is blockchain?'")

    const response3 = await client.fetchJson<any>("/api/test/ai-demo", {
      method: "POST",
      body: JSON.stringify({
        prompt: "What is blockchain?",
      }),
    })

    console.log(`   ✅ API 响应成功`)
    console.log(`   💰 剩余余额: ${client.getRemainingBalance()} USDC`)

    // 6. 查看通道信息
    console.log("\n📊 步骤 6: 查看通道统计")

    const channelInfo = await client.getChannel()
    console.log("   通道信息:")
    console.log(`   - 存入: ${channelInfo.depositAmount} USDC`)
    console.log(`   - 已用: ${channelInfo.spentAmount} USDC`)
    console.log(`   - 待结算: ${channelInfo.pendingAmount} USDC`)
    console.log(`   - 状态: ${channelInfo.status}`)

    // 7. 手动触发结算（可选）
    const pendingAmount = parseFloat(channelInfo.pendingAmount)
    if (pendingAmount > 0) {
      console.log("\n💳 步骤 7: 手动触发结算")
      console.log(`   待结算金额: ${pendingAmount} USDC`)

      const settlement = await client.settle()
      console.log(`   ✅ 结算成功`)
      console.log(`   结算 ID: ${settlement.settlementId}`)
      console.log(`   结算金额: ${settlement.settledAmount} USDC`)
      if (settlement.transactionHash) {
        console.log(`   交易哈希: ${settlement.transactionHash}`)
      }
    }

    // 8. 关闭通道
    console.log("\n🔒 步骤 8: 关闭支付通道")

    const closeResult = await client.closeChannel()
    console.log(`   ✅ 通道已关闭`)
    console.log(`   最终结算金额: ${closeResult.settledAmount} USDC`)

    // 测试完成
    console.log("\n" + "=".repeat(60))
    console.log("✅ 所有测试通过！")
    console.log("=".repeat(60))

  } catch (error: any) {
    console.error("\n❌ 测试失败:")
    console.error(`   错误: ${error.message}`)

    if (error.name === "PaymentRequiredError") {
      console.error("   支付信息:", error.paymentInfo)
      console.error("\n💡 提示:")
      console.error("   1. 确保数据库表已创建（运行迁移脚本）")
      console.error("   2. 确保支付通道已开通")
      console.error("   3. 检查余额是否充足")
    }

    console.error("\n完整错误:")
    console.error(error)
  }
}

// 测试模式（跳过支付）
async function testWithTestMode() {
  console.log("\n🧪 测试模式 (跳过支付)\n")
  console.log("=" .repeat(60))

  try {
    console.log("\n🤖 调用 AI API (测试模式)")

    const response = await fetch(`${BASE_URL}/api/test/ai-demo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Test-Mode": "true", // 跳过支付验证
      },
      body: JSON.stringify({
        prompt: "Hello from test mode!",
      }),
    })

    const data = await response.json()

    if (response.ok) {
      console.log("   ✅ API 响应成功（无需支付）")
      console.log(`   结果: ${data.result?.substring(0, 80)}...`)
    } else {
      console.error("   ❌ API 调用失败:", data)
    }

  } catch (error: any) {
    console.error("   ❌ 测试失败:", error.message)
  }

  console.log("\n" + "=".repeat(60))
}

// 主函数
async function main() {
  console.log("\n")
  console.log("🚀 ProtocolBanks HTTP 402 Micropayment Test")
  console.log("=" .repeat(60))
  console.log(`Base URL: ${BASE_URL}`)
  console.log("=" .repeat(60))

  // 选择测试模式
  const args = process.argv.slice(2)
  const testMode = args.includes("--test-mode")

  if (testMode) {
    await testWithTestMode()
  } else {
    await testHTTP402()
  }

  console.log("\n")
}

// 运行测试
main().catch((error) => {
  console.error("Fatal error:", error)
  process.exit(1)
})
