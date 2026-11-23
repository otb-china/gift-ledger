export interface LedgerBook {
  id: string;
  name: string;
}

export interface LedgerItem {
  bookId: string;
  id: string;
  name: string;
  received: string;
  given: string;
  gift: string;
  note: string;
  manualSettled: boolean;
  updatedAt: string;
}

export interface DeletedLedgerItem extends LedgerItem {
  deletedAt: string;
}

export interface LedgerBackupData {
  books?: unknown;
  items?: unknown;
  deletedItems?: unknown;
}
