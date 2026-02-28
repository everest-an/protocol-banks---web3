# 启动数据库指南

## 当前状态
❌ PostgreSQL 数据库未运行在 `localhost:51214`

## 快速启动步骤

### 方法 1: 使用 Docker（推荐）

```bash
# 查看现有的 PostgreSQL 容器
docker ps -a | findstr postgres

# 找到容器名称后启动
docker start <容器名称或ID>

# 验证运行
docker ps | findstr postgres
```

### 方法 2: 使用 Windows 服务

```bash
# 查看服务状态
sc query postgresql-x64-15

# 启动服务
net start postgresql-x64-15

# 或使用 PowerShell
Start-Service postgresql-x64-15
```

### 方法 3: 使用 pg_ctl

```bash
# 启动 PostgreSQL
pg_ctl start -D "C:\Program Files\PostgreSQL\15\data"

# 或指定您的数据目录
pg_ctl start -D "您的PostgreSQL数据目录路径"
```

## 验证数据库运行

```bash
# 方法 1: 检查端口
netstat -an | findstr :51214

# 方法 2: 尝试连接
psql -h localhost -p 51214 -U postgres -c "SELECT version();"

# 方法 3: 使用 Prisma
cd "e:\Protocol Bank\Development\历史版本\protocol-banks---web3-main"
pnpm prisma db execute --stdin <<< "SELECT 1;"
```

## 数据库运行后

一旦数据库成功运行，执行以下命令推送 schema：

```bash
cd "e:\Protocol Bank\Development\历史版本\protocol-banks---web3-main"

# 推送 Prisma schema
pnpm prisma db push

# 预期输出：
# ✓ VendorAddress 表已创建
# ✓ payments 表已更新
# ✓ batch_payments 表已更新
# ✓ 迁移成功！
```

## 数据库配置信息

根据您的 `.env` 文件：

- **主机:** localhost
- **端口:** 51214
- **数据库:** template1
- **用户:** postgres
- **密码:** postgres

## 常见问题

### 问题: 端口被占用

```bash
# 查看占用 51214 端口的进程
netstat -ano | findstr :51214

# 停止占用进程（使用 PID）
taskkill /PID <进程ID> /F
```

### 问题: 服务无法启动

1. 检查日志文件
2. 确认 PostgreSQL 已正确安装
3. 检查磁盘空间
4. 确认端口未被占用

### 问题: 密码错误

如果密码不是 `postgres`，请更新 `.env` 文件中的 `DATABASE_URL`

## 启动成功后的下一步

1. **验证连接**
   ```bash
   pnpm prisma studio
   ```

2. **推送 schema**
   ```bash
   pnpm prisma db push
   ```

3. **开始测试**
   - 参考 [快速开始指南.md](docs/快速开始指南.md)
   - 运行 API 测试

---

**需要帮助？** 查看 [故障排查指南.md](docs/故障排查指南.md)
