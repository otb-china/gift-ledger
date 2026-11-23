# 礼帐数据存储

IndexedDB 库名为 `gift-ledger`。库版本为 2，使用对象仓库 `data` 和主键 `gift-ledger:snapshot`。快照结构为 `{ revision: number, values: Record<string, string> }`，业务字段是 JSON 字符串。

| 新键 | 旧键 | 内容 |
| --- | --- | --- |
| `gift-ledger:entries` | — | 礼帐记录 |
| `gift-ledger:deleted-entries` | — | 礼帐回收站 |
| `gift-ledger:items` | `allergenItems` | 过敏源记录 |
| `gift-ledger:recycle-bin` | `allergenRecycleBin` | 回收站 |
| `gift-ledger:theme` | `allergenTheme` | 主题 |

礼帐记录包含 id、name、recordedAt、updatedAt、note、received（收礼）、given（随礼）、gift（礼物描述）和 manualSettled（手动平账）。金额以元为单位保存为字符串，空串表示未填写。两笔金额都已填写且相等、礼物为空时自动平账。手动平账独立保存。回收站额外保存 deletedAt。旧饮食记录保留在原键中。

## 迁移与备份

优先读取新快照。新快照不存在时，先从旧 IndexedDB 的 `snapshot` 迁移。没有旧快照时，才从同来源的 `localStorage` 读取表中的键。事务成功后只更新新键，旧键保留用于过渡。新版工具保存的数据以 IndexedDB 为准。迁移要求在原浏览器或 QuickOpen 的原 WebView 中打开同一站点。跨设备时使用工具页内的 JSON 导出与导入。

新版 QuickOpen 的整包备份（v4）包含本工具的 IndexedDB 数据，恢复到空库时可一并还原。目标已有不同记录时保留目标数据。旧版 QuickOpen 的 v3 备份只保存当时的 `localStorage`。

移除兼容前，需确认仍在用的旧版数据都有可用的迁移路径。保留 JSON 备份的导入兼容。
