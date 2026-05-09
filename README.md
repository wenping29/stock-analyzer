# 股票量化分析工具

面向A股市场的量化分析 Web 工具，提供技术指标计算与可视化、多因子筛选、策略回测、参数优化及实盘监控能力。

## 功能

- **技术指标可视化** — 11 项常用技术指标（MA/EMA/MACD/BOLL/RSI/KDJ/WR/VOL/OBV/VR/ATR），Plotly 交互式 K 线图
- **多因子筛选** — 可视化 AND/OR 规则构建器，全市场 5000+ 只 A 股扫描，3 种内置预设策略
- **策略回测** — 策略历史回测，支持固定/动态仓位、多止盈止损规则，绩效评估（年化收益/最大回撤/夏普率/胜率等）
- **参数优化** — 网格搜索 + 滚动优化（样本内→样本外验证），自动检测过拟合
- **实盘监控** — 定时任务扫描筛选条件，企业微信/钉钉推送，市场状态自动判断
- **数据爬取** — 独立的财务报表爬虫（资产负债表/利润表/现金流量表）

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript + Vite + Plotly.js + Tailwind CSS |
| 后端 | Express 4 + TypeScript + tsx |
| 数据源 | 东方财富公开 HTTP API |
| 持久化 | SQLite (sql.js) + JSON 文件缓存 |
| 定时任务 | node-cron |
| 数据爬取 | 独立 scraper 模块 |

## 快速开始

```bash
# 安装依赖
cd server && npm install
cd ../client && npm install

# 启动后端（端口 3001）
cd server && npm run dev

# 启动前端（端口 5173，自动代理 /api 到 3001）
cd client && npm run dev

# 浏览器访问
open http://localhost:5173
```

## 项目结构

```
stock-analyzer/
├── server/                         # Express 后端
│   ├── src/
│   │   ├── index.ts                # 入口，注册所有路由
│   │   ├── config/defaults.ts      # 指标参数 + 筛选预设
│   │   ├── services/
│   │   │   ├── fetcher.ts          # 东方财富 API 封装
│   │   │   ├── cache.ts            # 磁盘 + 内存二级缓存
│   │   │   ├── stockList.ts        # 股票列表过滤
│   │   │   ├── database.ts         # SQLite 持久化
│   │   │   └── seed.ts             # 批量数据导入
│   │   ├── indicators/             # 11 项技术指标计算
│   │   ├── screening/              # 多因子筛选引擎
│   │   ├── backtesting/            # 回测引擎 + 绩效评估 + 仓位/退出规则
│   │   ├── optimization/           # 网格搜索 + 滚动优化
│   │   ├── monitoring/             # 定时任务 + 市场状态 + Webhook 推送
│   │   ├── routes/                 # 6 组 API 路由
│   │   └── cli/fetch-kline.ts      # 手动抓取 K 线 CLI
│   └── data/                       # 缓存数据目录
│
├── client/                         # React 前端
│   └── src/
│       ├── pages/
│       │   ├── Indicators.tsx      # 技术指标可视化
│       │   ├── Screener.tsx        # 多因子筛选
│       │   ├── Backtest.tsx        # 策略回测
│       │   ├── Optimization.tsx    # 参数优化
│       │   └── Monitoring.tsx      # 实盘监控
│       ├── components/             # 图表、规则构建器、绩效卡片等
│       └── api/client.ts           # 后端 API 调用封装
│
├── shared/
│   └── types.ts                    # 共享类型定义
│
└── scraper/                        # 独立财务报表爬虫
    └── src/
        ├── index.ts                # CLI 入口
        ├── financial-scraper.ts    # 财务数据抓取
        ├── database.ts             # SQLite 存储
        └── rate-limiter.ts         # 限流控制
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/stock/list` | 股票列表 |
| GET | `/api/stock/search?q=` | 搜索股票 |
| GET | `/api/stock/:code/kline` | K 线数据 |
| GET | `/api/indicators` | 可用指标列表 |
| POST | `/api/indicators/compute` | 计算指标 |
| GET | `/api/screening/presets` | 预设策略列表 |
| POST | `/api/screening/run` | 执行筛选 |
| POST | `/api/screening/test` | 单股测试 |
| POST | `/api/backtesting/run` | 执行回测 |
| GET | `/api/backtesting/results` | 回测结果列表 |
| GET | `/api/backtesting/results/:id` | 回测结果详情 |
| POST | `/api/optimization/grid-search` | 网格搜索 |
| POST | `/api/optimization/walk-forward` | 滚动优化 |
| GET | `/api/monitoring/jobs` | 监控任务列表 |
| POST | `/api/monitoring/jobs` | 创建监控任务 |
| DELETE | `/api/monitoring/jobs/:id` | 删除监控任务 |
| POST | `/api/monitoring/jobs/:id/trigger` | 手动触发任务 |
| POST | `/api/monitoring/test-webhook` | 测试 Webhook |

## 数据说明

- 数据来源：东方财富公开 API（免费，无需 token）
- 日线缓存 24h，股票列表缓存 1h
- API 限流时自动使用内置备选股票列表
- K 线数据同时写入 SQLite 作为二级缓存

## 开发

```bash
# TypeScript 类型检查
cd server && npx tsc --noEmit
cd client && npx tsc --noEmit

# 财务报表爬取
cd scraper && npm run scrape:all
```
