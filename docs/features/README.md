# Protocol Banks - 优先功能开发文档

## 文档目录

本目录包含 Protocol Banks MVP 阶段优先开发功能的设计文档。

### 功能优先级

| 优先级 | 功能 | 文档 | 状态 |
|--------|------|------|------|
| P0 | 百分比分账 | [01-split-payment/](./01-split-payment/) | ✅ 已完成 |
| P0 | 定时发薪 | [02-scheduled-payroll/](./02-scheduled-payroll/) | ✅ 已完成 |
| P1 | 权限系统 | [03-permission-system/](./03-permission-system/) | ✅ 已完成 |
| P1 | 账单导出 | [04-invoice-export/](./04-invoice-export/) | ✅ 已完成 |

### 文档清单

**01-split-payment (百分比分账)**
- [PRD.md](./01-split-payment/PRD.md) - 产品需求文档
- [TECHNICAL.md](./01-split-payment/TECHNICAL.md) - 技术设计文档
- [DATABASE.md](./01-split-payment/DATABASE.md) - 数据库设计
- [API.md](./01-split-payment/API.md) - API 接口设计

**02-scheduled-payroll (定时发薪)**
- [PRD.md](./02-scheduled-payroll/PRD.md) - 产品需求文档
- [TECHNICAL.md](./02-scheduled-payroll/TECHNICAL.md) - 技术设计文档

**03-permission-system (权限系统)**
- [PRD.md](./03-permission-system/PRD.md) - 产品需求文档

**04-invoice-export (账单导出)**
- [PRD.md](./04-invoice-export/PRD.md) - 产品需求文档

### 产品定位

> "给 Web3 团队用的 Rippling + Gusto（但只做加密）"
>
> 核心价值：让 Web3 团队 5 分钟完成稳定币批量发薪/分账

### 设计原则

1. **商用优先** - 支持多用户、多团队、大批量场景
2. **简单可靠** - MVP 阶段不过度设计，但架构要支持扩展
3. **合规友好** - 所有操作可审计、可追溯
4. **不做托管** - 用户自持资金，只做交易编排

### 技术债务汇总

详见 [TECH_DEBT.md](./TECH_DEBT.md)

### 开发规范

1. 每个功能独立文档，包含：PRD、技术设计、数据库设计、API 设计
2. 先写文档再写代码，文档需评审
3. 功能完成后更新文档状态
4. 记录技术债务，定期偿还

---

**最后更新**: 2025-01-30
