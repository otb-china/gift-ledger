export interface LedgerItem {
  id: string;
  name: string;
  recordedAt: string;
  received: string;
  given: string;
  gift: string;
  manualSettled: boolean;
  note: string;
  updatedAt: string;
}

export interface DeletedLedgerItem extends LedgerItem {
  deletedAt: string;
}

export interface LedgerBackupData {
  items?: unknown;
  deletedItems?: unknown;
}
