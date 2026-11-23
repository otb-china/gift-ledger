# 礼帐数据存储

IndexedDB 库名为 `gift-ledger`。库版本为 2，使用对象仓库 `data` 和主键 `gift-ledger:snapshot`。快照结构为 `{ revision: number, values: Record<string, string> }`，业务字段是 JSON 字符串。

首次打开时创建空快照，之后读取已有的礼帐快照。

| 存储键 | 内容 |
| --- | --- |
| `gift-ledger:books` | 账本列表，每项包含 id 和 name |
| `gift-ledger:active-book` | 当前选中的账本 ID |
| `gift-ledger:entries` | 礼帐记录 |
| `gift-ledger:deleted-entries` | 礼帐回收站 |
| `gift-ledger:theme` | 主题 |

默认账本为个人（ID 为 `personal`）。已有记录和回收站记录缺少 bookId 时归入个人账本。

礼帐记录包含 id、bookId（所属账本）、name、updatedAt（系统更新时间）、received（收礼）、given（随礼）、gift（礼物描述）和 manualSettled（手动平账）。金额以元为单位保存为字符串，空串表示未填写。两笔金额都已填写且相等、礼物为空时自动平账。手动平账独立保存。回收站额外保存 deletedAt。

## 备份与恢复

在礼帐设置中导出 JSON 文件可备份全部账本、记录和回收站，跨设备时可在目标设备导入并合并记录。

QuickOpen 的整包备份（v4）包含本工具的 IndexedDB 数据，恢复到空库时可一并还原。目标已有不同记录时保留目标数据。
