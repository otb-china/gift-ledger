<template>
  <div class="home-page" :style="themeStyle">
    <div class="sticky-panel" :class="{ raised: showScrollTop }">
      <header class="page-header">
        <div class="brand">
          <img class="brand-logo" :src="logoUrl" alt="" aria-hidden="true" />
          <div class="brand-text">
            <div class="book-title">
              <h1>礼帐</h1>
              <select v-if="books.length > 1" v-model="activeBook" class="book-select" aria-label="切换账本">
                <option v-for="book in books" :key="book.id" :value="book.id">{{ book.name }}</option>
              </select>
            </div>
            <span v-if="visibleItems.length" class="brand-summary">
              送出 <b>¥{{ totals.given }}</b> · 收到 <b class="in">¥{{ totals.received }}</b>
            </span>
            <span v-else>还没有记录</span>
          </div>
        </div>
        <div class="header-actions">
          <button v-if="showScrollTop" class="header-icon" type="button" aria-label="返回顶部" @click="scrollToTop">
            <el-icon><Top /></el-icon>
          </button>
          <button class="header-icon" type="button" aria-label="设置" @click="settingsPopup = true">
            <el-icon><Setting /></el-icon>
          </button>
        </div>
      </header>

      <section class="search-section" aria-label="搜索和录入">
        <label class="search-box">
          <el-icon><Search /></el-icon>
          <input v-model.trim="keyword" type="search" placeholder="搜索姓名或礼物" aria-label="搜索姓名或礼物" />
          <button v-if="keyword" class="search-clear" type="button" aria-label="清空搜索" @click="keyword = ''">
            <el-icon><CircleCloseFilled /></el-icon>
          </button>
        </label>
        <button class="create-button" type="button" @click="openEditor()">
          <el-icon><Plus /></el-icon>
          录入
        </button>
      </section>

      <nav v-if="visibleItems.length" class="filter-bar" aria-label="按平账状态筛选">
        <button
          v-for="filter in filterOptions"
          :key="filter.key"
          class="filter-chip"
          :class="{ active: statusFilter === filter.key }"
          type="button"
          :aria-pressed="statusFilter === filter.key"
          @click="statusFilter = filter.key"
        >
          {{ filter.label }}
          <span>{{ filterCounts[filter.key] }}</span>
        </button>
      </nav>
    </div>

    <main class="allergen-view">
      <section v-if="sortedItems.length" class="record-list" aria-label="礼帐记录">
        <article v-for="[name, entries] in groupedItems" :key="name" class="ledger-card">
          <header class="person-head">
            <h2>{{ name }}</h2>
            <button type="button" class="add-exchange" :aria-label="`给${name}再记一笔`" @click="openEditor(undefined, name)">
              <el-icon><Plus /></el-icon>记一笔
            </button>
          </header>
          <SwipeDeleteRow v-for="item in entries" :key="item.id" class="exchange-swipe" @remove="removeItem(item.id)">
            <div class="exchange" :class="{ settled: isSettled(item) }" role="button" tabindex="0"
              :aria-label="`编辑${name}的往来记录 ${item.note}`" @click="openEditor(item)"
              @keydown.enter.prevent="openEditor(item)" @keydown.space.prevent="openEditor(item)"
              @keydown.delete.prevent="removeItem(item.id)">
              <div v-if="item.note || item.gift" class="exchange-main">
                <strong v-if="item.note" class="exchange-note">{{ item.note }}</strong>
                <span v-if="item.gift" class="card-gift">
                  <el-icon><Present /></el-icon>
                  <span>{{ item.gift }}</span>
                </span>
              </div>
              <dl class="amounts">
                <div class="amount given" :class="{ empty: !item.given }">
                  <dt>送出</dt>
                  <dd><template v-if="item.given"><small>¥</small>{{ displayAmount(item.given) }}</template><template v-else>—</template></dd>
                </div>
                <div class="amount received" :class="{ empty: !item.received }">
                  <dt>收到</dt>
                  <dd><template v-if="item.received"><small>¥</small>{{ displayAmount(item.received) }}</template><template v-else>—</template></dd>
                </div>
                <span class="balance-hint">{{ balanceHint(item) }}</span>
              </dl>
            </div>
          </SwipeDeleteRow>
        </article>
      </section>

      <div v-else class="empty-state">
        <span class="empty-icon">
          <el-icon><component :is="visibleItems.length ? Search : Notebook" /></el-icon>
        </span>
        <strong>{{ visibleItems.length ? "没有匹配的记录" : "还没有记录" }}</strong>
        <span v-if="!visibleItems.length" class="empty-desc">点击“录入”记下第一笔人情往来</span>
        <button v-else class="text-button" type="button" @click="resetFilters">清除筛选</button>
      </div>
    </main>

    <van-popup v-model:show="editorPopup" class="edit-popup" round destroy-on-close>
      <form class="simple-editor" @submit.prevent="saveItem">
        <header class="editor-head">
          <div>
            <strong>
              {{ editingItemId ? "编辑记录" : "新增记录" }}
              <em class="editor-status" :class="{ settled: isSettled(itemForm) }">{{ statusLabel(itemForm) }}</em>
            </strong>
            <span>无礼物且我送出和收到的礼金相等时自动平账</span>
          </div>
          <button class="editor-close" type="button" aria-label="关闭" @click="editorPopup = false">
            <el-icon><Close /></el-icon>
          </button>
        </header>

        <label class="field-row">
          <span>姓名</span>
          <input v-model.trim="itemForm.name" class="simple-input" placeholder="填写对方姓名" />
        </label>

        <label v-if="showExchangeNote" class="field-row">
          <span>往来备注（选填）</span>
          <input v-model.trim="itemForm.note" class="simple-input" placeholder="例如：结婚、孩子满月" />
        </label>

        <div class="field-pair">
          <label class="field-row">
            <span>我送出的礼金（元）</span>
            <input v-model.trim="itemForm.given" class="simple-input" inputmode="decimal" placeholder="0.00" />
          </label>
          <label class="field-row">
            <span>我收到的礼金（元）</span>
            <input v-model.trim="itemForm.received" class="simple-input" inputmode="decimal" placeholder="0.00" />
          </label>
        </div>
        <div class="toggle-group">
          <label class="toggle-row">
            <strong>礼物</strong>
            <input v-model="hasGift" class="switch" type="checkbox" @change="!hasGift && (itemForm.gift = '')" />
          </label>
          <label class="toggle-row">
            <strong>手动平账</strong>
            <input v-model="itemForm.manualSettled" class="switch" type="checkbox" />
          </label>
        </div>
        <label v-if="hasGift" class="field-row gift-field">
          <input v-model.trim="itemForm.gift" class="simple-input" placeholder="填写礼物名称" aria-label="礼物" />
        </label>

        <div class="simple-actions">
          <button class="confirm-btn" type="submit">保存</button>
        </div>
      </form>
    </van-popup>

    <SettingsPopup
      v-model:show="settingsPopup"
      :theme-options="themeOptions"
      :current-theme="currentTheme"
      :current-theme-name="currentThemeOption.name"
      :recycle-count="visibleDeleted.length"
      @manage-books="openBookManager"
      @set-theme="setTheme"
      @export="exportAllData"
      @open-import="openImportExport"
      @open-recycle="openRecycleBin"
      @reset="resetAllData"
    />

    <van-popup v-model:show="recyclePopup" position="bottom" round destroy-on-close>
      <div class="popup-body recycle-popup">
        <div class="popup-head">
          <div>
            <h3>回收站</h3>
            <p>移除的记录保留 7 天，可在这里恢复。</p>
          </div>
        </div>

        <div v-if="visibleDeleted.length" class="recycle-list">
          <div v-for="item in visibleDeleted" :key="item.id" class="recycle-item">
            <div>
              <strong>{{ item.name }}</strong>
              <span>{{ getRecycleDaysLeft(item) }} 天后清除</span>
            </div>
            <div class="recycle-actions">
              <button type="button" @click="restoreDeletedItem(item.id)">恢复</button>
              <button class="danger" type="button" @click="purgeDeletedItem(item.id)">删除</button>
            </div>
          </div>
        </div>

        <div v-else class="empty-state compact">
          <strong>回收站为空</strong>
          <span class="empty-desc">移除的记录会在这里保留一周。</span>
        </div>
      </div>
    </van-popup>

    <van-popup v-model:show="bookManager" position="bottom" round>
      <div class="popup-body">
        <div class="popup-head">
          <div>
            <h3>账本管理</h3>
            <p>改名后点击“改名”保存，删除账本会同时清除其记录。</p>
          </div>
        </div>
        <form v-for="book in books" :key="book.id" class="book-row" @submit.prevent="renameBook(book)">
          <input v-model.trim="bookNames[book.id]" class="simple-input" aria-label="账本名称" maxlength="24" required />
          <button class="ghost-button" type="submit">改名</button>
          <button v-if="books.length > 1" class="ghost-button" type="button" @click="deleteBook(book)">删除</button>
        </form>
        <form class="book-row book-row-new" @submit.prevent="addBook">
          <input v-model.trim="newBookName" class="simple-input" placeholder="新账本名称" aria-label="新账本名称" maxlength="24" required />
          <button class="create-button small" type="submit">新增</button>
        </form>
      </div>
    </van-popup>

    <ImportDataPopup
      v-model:show="importExportInfo.show"
      :record-count="items.length"
      :file-name="importInfo.fileName"
      :has-file="Boolean(importInfo.dataStr)"
      @file-loaded="onImportFileLoaded"
      @file-error="showToast"
      @import="importData"
    />
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, onUnmounted, reactive, ref, watch } from "vue";
import dayjs from "dayjs";
import { showConfirmDialog, showToast } from "vant";
import { CircleCloseFilled, Close, Notebook, Plus, Present, Search, Setting, Top } from "@element-plus/icons-vue";
import ImportDataPopup from "@/components/ImportDataPopup.vue";
import SwipeDeleteRow from "@/components/SwipeDeleteRow.vue";
import SettingsPopup from "@/components/SettingsPopup.vue";
import { DEFAULT_THEME, isThemeKey, themeOptions } from "@/config/themes";
import { storageKeys } from "@/utils/toolStorage";
import { LStorage, reportSaveError } from "@/utils/localStorage.ts";
import type { ThemeKey } from "@/config/themes";
import type { DeletedLedgerItem, LedgerBackupData, LedgerBook, LedgerItem } from "@/types/tool";
import logoUrl from "@/assets/ledger-icon.svg";

const SCROLL_TOP_THRESHOLD = 240;
const DATE_FORMAT = "YYYY-MM-DD";
const RECYCLE_KEEP_DAYS = 7;
const RECYCLE_KEEP_MS = RECYCLE_KEEP_DAYS * 24 * 60 * 60 * 1000;

type FilterKey = "all" | "open" | "settled";
const filterOptions: { key: FilterKey; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "open", label: "未平账" },
  { key: "settled", label: "已平账" },
];

const showScrollTop = ref(false);
const currentTheme = ref<ThemeKey>(DEFAULT_THEME);
const items = ref<LedgerItem[]>([]);
const deletedItems = ref<DeletedLedgerItem[]>([]);
const personalBook = { id: "personal", name: "个人" };
const books = ref<LedgerBook[]>([personalBook]);
const activeBook = ref(personalBook.id);
const visibleItems = computed(() => items.value.filter(item => item.bookId === activeBook.value));
const visibleDeleted = computed(() => deletedItems.value.filter(item => item.bookId === activeBook.value));
const bookManager = ref(false);
const bookNames = ref<Record<string, string>>({});
const newBookName = ref("");
const keyword = ref("");
const statusFilter = ref<FilterKey>("all");
const settingsPopup = ref(false);
const recyclePopup = ref(false);
const editorPopup = ref(false);
const editingItemId = ref("");
const hasGift = ref(false);
const itemForm = reactive({ name: "", received: "", given: "", gift: "", note: "", manualSettled: false });
const importExportInfo = ref({ show: false });
const importInfo = ref({ dataStr: "", fileName: "" });

const itemStorage = LStorage.new(storageKeys.entries);
const recycleStorage = LStorage.new(storageKeys.deletedEntries);
const themeStorage = LStorage.new(storageKeys.theme);

const currentThemeOption = computed(() => {
  return themeOptions.find((theme) => theme.key === currentTheme.value) || themeOptions[0];
});
const themeStyle = computed(() => currentThemeOption.value.variables);
const keywordMatches = computed(() => {
  const query = keyword.value.trim().toLowerCase();
  if (!query) return visibleItems.value;
  return visibleItems.value.filter((item) =>
    item.name.toLowerCase().includes(query) || item.gift.toLowerCase().includes(query),
  );
});
const filterCounts = computed(() => {
  const settled = keywordMatches.value.filter(isSettled).length;
  return { all: keywordMatches.value.length, open: keywordMatches.value.length - settled, settled };
});
const totals = computed(() => {
  const sumCents = (key: "given" | "received") => visibleItems.value
    .reduce((total, item) => total + (validAmount(item[key]) ? Math.round(Number(item[key]) * 100) : 0), 0);
  const format = (cents: number) => (cents / 100).toLocaleString("zh-CN", { maximumFractionDigits: 2 });
  return { given: format(sumCents("given")), received: format(sumCents("received")) };
});
const sortedItems = computed(() => keywordMatches.value
  .filter(item => statusFilter.value === "all" || isSettled(item) === (statusFilter.value === "settled"))
  .sort((a, b) => Number(isSettled(a)) - Number(isSettled(b)) || b.updatedAt.localeCompare(a.updatedAt)));

const groupedItems = computed(() => {
  const groups = new Map<string, LedgerItem[]>();
  for (const item of sortedItems.value) {
    const entries = groups.get(item.name);
    if (entries) entries.push(item);
    else groups.set(item.name, [item]);
  }
  return groups;
});

const showExchangeNote = computed(() => Boolean(itemForm.note) || visibleItems.value.some(
  item => item.name === itemForm.name && item.id !== editingItemId.value,
));

watch(items, saveItems, { deep: true });
watch(deletedItems, saveDeletedItems, { deep: true });

const bookStorage = LStorage.new(storageKeys.books);
const activeStorage = LStorage.new(storageKeys.activeBook);
watch(books, value => { void bookStorage.setter(value).catch(reportSaveError); });
watch(activeBook, value => {
  resetFilters();
  void activeStorage.setter(value).catch(reportSaveError);
});

function readBooks(value: unknown): LedgerBook[] {
  if (value === undefined || value === null) return [{ ...personalBook }];
  if (!Array.isArray(value) || !value.length || value.some(book =>
    typeof book?.id !== "string" || !book.id || typeof book.name !== "string" || !book.name.trim()
  ) || new Set(value.map(book => book.id)).size !== value.length) throw new Error("无效的账本");
  return value.map(({ id, name }) => ({ id, name }));
}

function openBookManager() {
  settingsPopup.value = false;
  bookNames.value = Object.fromEntries(books.value.map(book => [book.id, book.name]));
  newBookName.value = "";
  bookManager.value = true;
}

function validBookName(name: string, id?: string) {
  if (name && !books.value.some(book => book.id !== id && book.name === name)) return true;
  showToast("请填写不同的账本名称");
  return false;
}

function addBook() {
  const name = newBookName.value;
  if (!validBookName(name)) return;
  const id = createId("book");
  books.value = [...books.value, { id, name }];
  bookNames.value[id] = name;
  newBookName.value = "";
  activeBook.value = id;
}

function renameBook(book: LedgerBook) {
  const name = bookNames.value[book.id] ?? "";
  if (!validBookName(name, book.id)) return;
  books.value = books.value.map(entry => entry.id === book.id ? { ...book, name } : entry);
  showToast("账本名称已保存");
}

function deleteBook(book: LedgerBook) {
  if (books.value.length < 2) return;
  showConfirmDialog({ title: "删除账本", message: `永久删除“${book.name}”及其全部记录和回收站内容？`, confirmButtonText: "删除", className: "app-dialog app-dialog--danger" }).then(() => {
    books.value = books.value.filter(entry => entry.id !== book.id);
    if (activeBook.value === book.id) activeBook.value = books.value[0]!.id;
    items.value = items.value.filter(item => item.bookId !== book.id);
    deletedItems.value = deletedItems.value.filter(item => item.bookId !== book.id);
  }).catch(() => {});
}

function init() {
  books.value = readBooks(bookStorage.getter());
  const selected = activeStorage.getter();
  activeBook.value = books.value.find(book => book.id === selected)?.id ?? books.value[0]!.id;
  const storedTheme = themeStorage.getter();
  currentTheme.value = isThemeKey(storedTheme) ? storedTheme : DEFAULT_THEME;
  items.value = normalizeItems(itemStorage.getter());
  deletedItems.value = purgeExpiredDeletedItems(normalizeDeletedItems(recycleStorage.getter()));
}

function createItem(fields: typeof itemForm): LedgerItem {
  return {
    id: createId("item"),
    ...fields,
    bookId: activeBook.value,
    updatedAt: new Date().toISOString(),
  };
}

function createId(prefix = "id") {
  if (window.crypto?.randomUUID) return `${prefix}-${window.crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeItems(value: unknown): LedgerItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Partial<LedgerItem> => Boolean(item && typeof item === "object"))
    .map((item) => ({
      id: typeof item.id === "string" && item.id ? item.id : createId("item"),
      name: typeof item.name === "string" && item.name.trim() ? item.name.trim() : "未命名记录",
      bookId: item.bookId || personalBook.id,
      received: readAmount(item.received),
      given: readAmount(item.given),
      note: typeof item.note === "string" ? item.note.trim() : "",
      gift: typeof item.gift === "string" ? item.gift.trim() : "",
      manualSettled: item.manualSettled === true,
      updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : new Date().toISOString(),
    }));
}

function normalizeDeletedItems(value: unknown): DeletedLedgerItem[] {
  if (!Array.isArray(value)) return [];
  return normalizeItems(value).map((item, index) => {
    const raw = value[index] as Partial<DeletedLedgerItem>;
    return {
      ...item,
      deletedAt: typeof raw.deletedAt === "string" ? raw.deletedAt : new Date().toISOString(),
    };
  });
}

type SettlementFields = Pick<LedgerItem, "received" | "given" | "gift" | "manualSettled">;

function validAmount(value: string) {
  return /^\d{1,12}(?:\.\d{1,2})?$/.test(value);
}

function readAmount(value: unknown) {
  if (value === "") return "";
  if (typeof value !== "string" || !validAmount(value)) throw new Error("无效的礼金金额");
  return value;
}

function isSettled(item: SettlementFields) {
  return item.manualSettled || (!item.gift.trim() && validAmount(item.received) &&
    validAmount(item.given) && Number(item.received) === Number(item.given));
}

function balanceHint(item: LedgerItem) {
  if (isSettled(item)) return item.manualSettled ? "手动平账" : "已平账";
  const toCents = (value: string) => validAmount(value) ? Math.round(Number(value) * 100) : 0;
  const diff = toCents(item.given) - toCents(item.received);
  if (!diff) return item.gift ? "待确认" : "未平账";
  const amount = (Math.abs(diff) / 100).toLocaleString("zh-CN", { maximumFractionDigits: 2 });
  return diff > 0 ? `对方欠 ¥${amount}` : `我欠 ¥${amount}`;
}

function displayAmount(value: string) {
  return Number(value).toLocaleString("zh-CN", { maximumFractionDigits: 2 });
}

function statusLabel(item: SettlementFields) {
  if (item.manualSettled) return "手动平账";
  return isSettled(item) ? "自动平账" : "未平账";
}

function resetFilters() {
  keyword.value = "";
  statusFilter.value = "all";
}

function saveItems() {
  if (items.value.length) {
    void itemStorage.setter(items.value).catch(reportSaveError);
  } else {
    void itemStorage.remove().catch(reportSaveError);
  }
}

function saveDeletedItems() {
  if (deletedItems.value.length) {
    void recycleStorage.setter(deletedItems.value).catch(reportSaveError);
  } else {
    void recycleStorage.remove().catch(reportSaveError);
  }
}

function setTheme(theme: ThemeKey) {
  currentTheme.value = theme;
  void themeStorage.setter(theme).catch(reportSaveError);
}

function openEditor(item?: LedgerItem, name = "") {
  editingItemId.value = item?.id || "";
  itemForm.name = item?.name ?? name;
  itemForm.received = item?.received ?? "";
  itemForm.given = item?.given ?? "";
  itemForm.note = item?.note ?? "";
  itemForm.gift = item?.gift ?? "";
  hasGift.value = Boolean(itemForm.gift);
  itemForm.manualSettled = item?.manualSettled ?? false;
  editorPopup.value = true;
}

function saveItem() {
  const name = itemForm.name.trim();
  if (!name) {
    showToast("请填写姓名");
    return;
  }

  if ([itemForm.received, itemForm.given].some(value => value && !validAmount(value))) {
    showToast("金额须为非负数，最多 12 位整数、2 位小数");
    return;
  }

  const fields = {
    ...itemForm,
    name,
  };

  if (editingItemId.value) {
    items.value = items.value.map((item) => item.id === editingItemId.value ? {
      ...item,
      ...fields,
      updatedAt: new Date().toISOString(),
    } : item);
  } else {
    items.value = [createItem(fields), ...items.value];
  }

  editorPopup.value = false;
  showToast("已保存");
}

async function removeItem(id: string) {
  const target = items.value.find((item) => item.id === id);
  if (!target) return;
  try {
    await showConfirmDialog({
      title: "删除记录",
      message: `确定将“${target.name}”的记录移入回收站吗？`,
      confirmButtonText: "删除",
      cancelButtonText: "取消",
      className: "app-dialog app-dialog--danger",
    });
  } catch {
    return;
  }
  const deletedItem = {
    ...target,
    deletedAt: new Date().toISOString(),
  };
  items.value = items.value.filter((item) => item.id !== id);
  deletedItems.value = [deletedItem, ...deletedItems.value.filter((item) => item.id !== id)];
  if (editingItemId.value === id) editorPopup.value = false;
  showToast("已移入回收站");
}

function openRecycleBin() {
  deletedItems.value = purgeExpiredDeletedItems(deletedItems.value);
  settingsPopup.value = false;
  recyclePopup.value = true;
}

function purgeExpiredDeletedItems(list: DeletedLedgerItem[]) {
  const now = Date.now();
  return list.filter((item) => now - new Date(item.deletedAt).getTime() < RECYCLE_KEEP_MS);
}

function getRecycleDaysLeft(item: DeletedLedgerItem) {
  const deletedTime = new Date(item.deletedAt).getTime();
  const leftMs = Math.max(0, RECYCLE_KEEP_MS - (Date.now() - deletedTime));
  return Math.max(1, Math.ceil(leftMs / (24 * 60 * 60 * 1000)));
}

function restoreDeletedItem(id: string) {
  const deletedItem = deletedItems.value.find((item) => item.id === id);
  if (!deletedItem) return;
  const { deletedAt: _deletedAt, ...restoredItem } = deletedItem;
  items.value = [{
    ...restoredItem,
    id: items.value.some((item) => item.id === restoredItem.id) ? createId("item") : restoredItem.id,
    updatedAt: new Date().toISOString(),
  }, ...items.value];
  deletedItems.value = deletedItems.value.filter((item) => item.id !== id);
  recyclePopup.value = false;
  showToast("记录已恢复");
}

function purgeDeletedItem(id: string) {
  deletedItems.value = deletedItems.value.filter((item) => item.id !== id);
  showToast("已彻底删除");
}

function openImportExport() {
  settingsPopup.value = false;
  importInfo.value.dataStr = "";
  importInfo.value.fileName = "";
  importExportInfo.value.show = true;
}

function exportAllData() {
  const backupText = JSON.stringify({ books: books.value, items: items.value, deletedItems: deletedItems.value }, null, 2);
  const blob = new Blob([backupText], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");
  downloadLink.href = url;
  downloadLink.download = `gift-ledger-backup-${dayjs(new Date()).format(DATE_FORMAT)}.json`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  URL.revokeObjectURL(url);
  settingsPopup.value = false;
  showToast("备份文件已导出");
}

function onImportFileLoaded(payload: { dataStr: string; fileName: string }) {
  importInfo.value.dataStr = payload.dataStr;
  importInfo.value.fileName = payload.fileName;
  showToast("备份文件已读取");
}

function mergeImportedItems(importedItems: LedgerItem[]) {
  const byId = new Map(items.value.map(item => [item.id, item]));
  for (const item of importedItems) {
    const previous = byId.get(item.id);
    if (!previous || item.updatedAt > previous.updatedAt) byId.set(item.id, item);
  }
  return [...byId.values()];
}

function mergeImportedDeletedItems(importedItems: DeletedLedgerItem[]) {
  const itemsById = new Map(deletedItems.value.map((item) => [item.id, item]));
  for (const item of purgeExpiredDeletedItems(importedItems)) {
    const previous = itemsById.get(item.id);
    if (!previous || dayjs(item.deletedAt).isAfter(previous.deletedAt)) {
      itemsById.set(item.id, item);
    }
  }
  return [...itemsById.values()];
}

async function importData() {
  try {
    const parsedData = JSON.parse(importInfo.value.dataStr) as LedgerBackupData;
    if (!parsedData || typeof parsedData !== "object" || Array.isArray(parsedData)) {
      throw new Error("Invalid backup data");
    }
    const importedItems = normalizeItems(parsedData.items);
    if (!Array.isArray(parsedData.items) || importedItems.length !== parsedData.items.length) {
      throw new Error("Invalid items");
    }
    const importedBooks = readBooks(parsedData.books);
    const bookIds = new Set(importedBooks.map(book => book.id));
    const importedDeleted = normalizeDeletedItems(parsedData.deletedItems);
    if ([...importedItems, ...importedDeleted].some(item => !bookIds.has(item.bookId))) throw new Error("未知的账本");
    const mergedBooks = [...books.value, ...importedBooks.filter(book => !books.value.some(local => local.id === book.id))];
    const mergedItems = mergeImportedItems(importedItems);
    const mergedDeletedItems = mergeImportedDeletedItems(importedDeleted);
    await Promise.all([
      bookStorage.setter(mergedBooks),
      itemStorage.setter(mergedItems),
      recycleStorage.setter(mergedDeletedItems),
    ]);
    books.value = mergedBooks;
    items.value = mergedItems;
    deletedItems.value = mergedDeletedItems;
    importExportInfo.value.show = false;
    importInfo.value.dataStr = "";
    importInfo.value.fileName = "";
    showToast("备份已合并");
  } catch (error) {
    showToast(error instanceof DOMException && error.name === "QuotaExceededError"
      ? "存储空间不足，导入的数据未保存，请保留备份文件"
      : "导入失败，请检查备份文件");
  }
}

function resetAllData() {
  showConfirmDialog({
    title: "重置数据",
    message: "确认清除所有账本的记录和回收站内容吗？此操作不可恢复。",
    confirmButtonText: "清除",
    className: "app-dialog app-dialog--danger",
  }).then(async () => {
    try {
      await Promise.all([itemStorage.remove(), recycleStorage.remove()]);
    } catch (error) {
      reportSaveError(error);
      return;
    }
    items.value = [];
    deletedItems.value = [];
    settingsPopup.value = false;
    showToast("数据已重置");
  }).catch(() => {});
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateScrollTopVisibility() {
  showScrollTop.value = window.scrollY > SCROLL_TOP_THRESHOLD;
}

init();

onMounted(() => {
  updateScrollTopVisibility();
  window.addEventListener("scroll", updateScrollTopVisibility, { passive: true });
});

onUnmounted(() => {
  window.removeEventListener("scroll", updateScrollTopVisibility);
});
</script>

<style lang="scss" scoped>
.home-page {
  min-height: 100vh;
  min-height: 100dvh;
  padding: 0 12px;
  background-color: var(--page-bg);
  color: var(--text-main);
  font-feature-settings: "tnum";
  -webkit-tap-highlight-color: transparent;
}

.home-page,
.home-page * {
  box-sizing: border-box;
}

.home-page button {
  font-family: inherit;
  cursor: pointer;
}

.home-page button:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.allergen-view {
  width: min(100%, 780px);
  margin: 0 auto;
}

/* 顶部 */
.sticky-panel {
  --toolbar-inset: max(16px, calc((100% - 780px) / 2 + 4px));
  position: sticky;
  top: 0;
  z-index: 20;
  margin: 0 -12px;
  padding-top: env(safe-area-inset-top);
  background-color: var(--surface);
  border-bottom: 1px solid var(--divider);
  box-shadow: 0 1px 2px rgba(20, 40, 62, 0.03);
  transition: box-shadow 0.2s ease;
}

.sticky-panel.raised {
  box-shadow: var(--header-shadow);
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 14px var(--toolbar-inset) 12px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.brand-logo {
  flex: 0 0 auto;
  width: 42px;
  height: 42px;
  border-radius: 12px;
  box-shadow: 0 6px 16px rgba(38, 56, 88, 0.12);
}

.brand-text {
  min-width: 0;
}

.book-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.book-title h1 {
  flex-shrink: 0;
}

.brand-text h1 {
  margin: 0;
  color: var(--text-strong);
  font-size: 22px;
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: 0.02em;
}

.book-select {
  min-width: 0;
  max-width: 9em;
  height: 26px;
  padding: 0 24px 0 10px;
  border: 1px solid var(--accent-border);
  border-radius: 999px;
  outline: 0;
  background:
    linear-gradient(45deg, transparent 50%, var(--accent) 50%) right 12px center / 5px 5px no-repeat,
    linear-gradient(135deg, var(--accent) 50%, transparent 50%) right 8px center / 5px 5px no-repeat,
    var(--header-icon-bg);
  color: var(--accent);
  font-family: inherit;
  font-size: 12px;
  font-weight: 700;
  text-overflow: ellipsis;
  -webkit-appearance: none;
  appearance: none;
}

.book-select:focus-visible {
  box-shadow: 0 0 0 3px var(--accent-ring);
}

.brand-text > span {
  display: block;
  margin-top: 3px;
  color: var(--text-muted);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.brand-summary b {
  color: var(--text-strong);
  font-weight: 700;
}

.brand-summary b.in {
  color: var(--accent);
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: 1px solid var(--divider);
  border-radius: 12px;
  background: var(--surface-soft);
  color: var(--accent);
  font-size: 18px;
  transition: background-color 0.15s ease, transform 0.15s ease;
}

.header-icon:active {
  transform: scale(0.94);
  background: var(--header-icon-bg);
}

/* 搜索与录入 */
.search-section {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  padding: 0 var(--toolbar-inset) 10px;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  min-height: 44px;
  padding: 0 6px 0 14px;
  border: 1px solid var(--divider);
  border-radius: 14px;
  color: var(--text-muted);
  background: var(--surface-soft);
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
}

.search-box:focus-within {
  border-color: var(--accent);
  background: var(--surface);
  color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-ring);
}

.search-box input {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  color: var(--text-main);
  background: transparent;
  font-family: inherit;
  font-size: 16px;
  -webkit-appearance: none;
  appearance: none;
}

.search-box input::-webkit-search-cancel-button {
  display: none;
}

.search-box input::placeholder {
  color: var(--text-muted);
  opacity: 0.75;
}

.search-clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text-muted);
  font-size: 16px;
  opacity: 0.7;
}

.create-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-height: 44px;
  padding: 0 18px;
  border: 0;
  border-radius: 14px;
  color: #ffffff;
  background: var(--submit-btn-bg);
  box-shadow: 0 2px 6px rgba(20, 40, 62, 0.12);
  font-size: 15px;
  font-weight: 700;
  white-space: nowrap;
  transition: transform 0.15s ease, filter 0.15s ease;
}

.create-button.small {
  min-height: 40px;
  padding: 0 14px;
  border-radius: 12px;
  font-size: 14px;
  box-shadow: none;
}

.create-button:active {
  transform: scale(0.96);
  filter: brightness(0.95);
}

/* 筛选 */
.filter-bar {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 2px;
  margin: 0 var(--toolbar-inset) 12px;
  padding: 3px;
  border-radius: 12px;
  background: var(--surface-muted);
  overflow-x: auto;
  scrollbar-width: none;
}

.filter-bar::-webkit-scrollbar {
  display: none;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  padding: 0 14px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
  transition: background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
}

.filter-chip span {
  min-width: 20px;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--surface);
  font-size: 11px;
  font-weight: 700;
  text-align: center;
}

.filter-chip.active {
  background: var(--surface);
  color: var(--accent);
  box-shadow: 0 1px 4px rgba(20, 40, 62, 0.1);
}

.filter-chip.active span {
  background: var(--accent);
  color: #ffffff;
}

/* 记录卡片 */
.record-list {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
  padding: 12px 4px calc(16px + env(safe-area-inset-bottom));
}

.ledger-card {
  display: grid;
  min-width: 0;
  padding: 10px 14px 4px;
  border: 1px solid var(--divider);
  border-radius: 14px;
  background: var(--surface);
  box-shadow: 0 1px 2px rgba(20, 40, 62, 0.04), 0 4px 12px rgba(20, 40, 62, 0.04);
}

.person-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--divider);
}

.ledger-card h2 {
  min-width: 0;
  margin: 0;
  color: var(--text-strong);
  font-size: 16px;
  font-weight: 700;
  line-height: 26px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.add-exchange {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex: 0 0 auto;
  height: 26px;
  margin-left: auto;
  padding: 0 2px 0 8px;
  border: 0;
  background: transparent;
  color: var(--accent);
  font-size: 12px;
  font-weight: 600;
}

.add-exchange .el-icon {
  font-size: 12px;
}

.add-exchange:active {
  opacity: 0.5;
}

.exchange-swipe {
  border-radius: 8px;
}

.exchange-swipe + .exchange-swipe .exchange {
  border-top: 1px dashed var(--divider);
}

.exchange {
  display: grid;
  gap: 2px;
  padding: 8px 0;
  background: var(--surface);
  cursor: pointer;
}

.exchange:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}

.exchange-main {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.exchange-note {
  color: var(--text-subtle);
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-gift {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  min-width: 0;
  color: var(--text-muted);
  font-size: 12px;
}

.card-gift .el-icon {
  flex: 0 0 auto;
  color: var(--warning-text);
}

.card-gift span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.amounts {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  margin: 0;
}

.amount {
  display: flex;
  align-items: baseline;
  gap: 6px;
  min-width: 0;
}

.amount dt {
  flex: 0 0 auto;
  color: var(--text-muted);
  font-size: 12px;
}

.amount dd {
  min-width: 0;
  margin: 0;
  color: var(--text-strong);
  font-size: 16px;
  font-weight: 700;
  line-height: 24px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.amount dd small {
  margin-right: 1px;
  font-size: 11px;
  font-weight: 600;
  opacity: 0.55;
}

.amount.received dd {
  color: var(--accent);
}

.amount.empty dd {
  color: var(--text-muted);
  font-weight: 400;
  opacity: 0.45;
}

.balance-hint {
  justify-self: end;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--warning-bg);
  color: var(--warning-text);
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
  white-space: nowrap;
}

.exchange.settled .amount dd {
  color: var(--text-muted);
  font-weight: 600;
}

.exchange.settled .balance-hint {
  background: var(--surface-muted);
  color: var(--text-muted);
}

/* 空状态 */
.empty-state {
  display: grid;
  place-items: center;
  align-content: center;
  gap: 6px;
  min-height: 50vh;
  padding: 24px 12px;
  text-align: center;
}

.empty-state.compact {
  min-height: 0;
  margin-top: 14px;
}

.empty-icon {
  display: grid;
  place-items: center;
  width: 56px;
  height: 56px;
  margin-bottom: 8px;
  border-radius: 50%;
  background: var(--header-icon-bg);
  color: var(--accent);
}

.empty-icon .el-icon {
  font-size: 26px;
}

.empty-state strong {
  color: var(--text-strong);
  font-size: 16px;
  font-weight: 700;
}

.empty-desc {
  color: var(--text-muted);
  font-size: 13px;
}

.text-button {
  padding: 4px 8px;
  border: 0;
  background: transparent;
  color: var(--accent);
  font-size: 14px;
  font-weight: 600;
}

.ghost-button {
  margin-top: 18px;
}

.empty-state .create-button {
  min-height: 42px;
  padding: 0 22px;
  border-radius: 999px;
  font-size: 14px;
  box-shadow: 0 6px 16px rgba(38, 56, 88, 0.14);
}

.ghost-button {
  margin-top: 10px;
}

.ghost-button {
  height: 38px;
  padding: 0 16px;
  border: 1px solid var(--accent-border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--accent);
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}

/* 弹窗 */
.home-page :deep(.van-popup) {
  background: var(--surface);
  color: var(--text-main);
}

.home-page :deep(.edit-popup) {
  width: min(92vw, 400px);
  max-height: 90vh;
  border-radius: 22px;
  background: var(--surface);
  box-shadow: 0 24px 60px rgba(38, 56, 88, 0.22);
  overflow-y: auto;
}

.simple-editor {
  padding: 20px 18px 18px;
}

.editor-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 6px;
}

.editor-head strong,
.editor-head span {
  display: block;
}

.editor-head strong {
  color: var(--text-strong);
  font-size: 19px;
}

.editor-head span {
  margin-top: 4px;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.4;
}

.editor-close {
  display: grid;
  place-items: center;
  flex: 0 0 auto;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 0;
  border-radius: 10px;
  background: var(--surface-muted);
  color: var(--text-muted);
  font-size: 15px;
}

.field-row {
  display: grid;
  gap: 6px;
  min-width: 0;
  margin-top: 14px;
}

.field-row > span {
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 700;
}

.field-pair {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.simple-input {
  display: block;
  width: 100%;
  height: 44px;
  padding: 0 12px;
  border: 1px solid var(--divider);
  border-radius: 12px;
  outline: 0;
  color: var(--text-main);
  background: var(--field-bg);
  font-family: inherit;
  font-size: 16px;
  font-weight: 500;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease;
  -webkit-appearance: none;
  appearance: none;
}

.simple-input::placeholder {
  color: var(--text-muted);
  opacity: 0.6;
}

.simple-input:focus {
  border-color: var(--accent);
  background: var(--surface);
  box-shadow: 0 0 0 3px var(--accent-ring);
}

.editor-status {
  display: inline-block;
  margin-left: 6px;
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--warning-bg);
  color: var(--warning-text);
  font-size: 11px;
  font-style: normal;
  font-weight: 700;
  line-height: 1.6;
  vertical-align: 3px;
}

.editor-status.settled {
  background: var(--header-icon-bg);
  color: var(--accent);
}

.toggle-group {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  margin-top: 14px;
}

.toggle-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
  height: 44px;
  padding: 0 8px 0 12px;
  border: 1px solid var(--divider);
  border-radius: 12px;
  background: var(--field-bg);
  cursor: pointer;
}

.toggle-row strong {
  color: var(--text-strong);
  font-size: 14px;
  white-space: nowrap;
}

.gift-field {
  margin-top: 10px;
}

.switch {
  position: relative;
  flex: 0 0 auto;
  width: 46px;
  height: 28px;
  margin: 0;
  border-radius: 999px;
  background: var(--divider);
  cursor: pointer;
  transition: background-color 0.2s ease;
  -webkit-appearance: none;
  appearance: none;
}

.switch::after {
  content: "";
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #ffffff;
  box-shadow: 0 1px 4px rgba(20, 40, 62, 0.2);
  transition: transform 0.2s ease;
}

.switch:checked {
  background: var(--accent);
}

.switch:checked::after {
  transform: translateX(18px);
}

.switch:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

.simple-actions {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
  margin-top: 20px;
}

.simple-actions button {
  height: 46px;
  border: 0;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 700;
}

.confirm-btn {
  color: #ffffff;
  background: var(--submit-btn-bg);
  box-shadow: var(--submit-btn-shadow);
}

/* 回收站 */
.recycle-popup {
  max-height: 78vh;
  overflow-y: auto;
}

.popup-head p {
  margin: 4px 0 0;
  color: var(--text-muted);
  font-size: 12px;
  line-height: 1.4;
}

.recycle-list {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}

.recycle-item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  padding: 12px 14px;
  border: 1px solid var(--divider);
  border-radius: 14px;
  background: var(--surface-soft);
}

.recycle-item strong,
.recycle-item span {
  display: block;
}

.recycle-item strong {
  color: var(--text-strong);
}

.recycle-item span {
  margin-top: 4px;
  color: var(--text-muted);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recycle-actions {
  display: flex;
  gap: 8px;
}

.recycle-actions button {
  height: 34px;
  padding: 0 14px;
  border: 0;
  border-radius: 999px;
  background: var(--header-icon-bg);
  color: var(--accent);
  font-size: 13px;
  font-weight: 700;
}

.recycle-actions button.danger {
  background: var(--danger-bg);
  color: var(--danger-text);
}

/* 账本管理 */
.book-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}

.book-row input {
  flex: 1;
  min-width: 0;
}

.book-row button {
  flex-shrink: 0;
}

.book-row .ghost-button {
  height: 40px;
  border-radius: 12px;
}

.book-row .ghost-button + .ghost-button {
  border-color: transparent;
  background: var(--danger-bg);
  color: var(--danger-text);
}

.book-row-new {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px dashed var(--divider);
}

@media (max-width: 520px) {
  .home-page {
    padding: 0 10px;
  }

  .sticky-panel {
    --toolbar-inset: 12px;
    margin: 0 -10px;
  }

  .brand-logo {
    width: 38px;
    height: 38px;
  }

  .brand-text h1 {
    font-size: 20px;
  }

  .record-list {
    padding-inline: 0;
  }

  .amount dd {
    font-size: 15px;
  }

  .recycle-item {
    grid-template-columns: 1fr;
  }

  .recycle-actions {
    justify-content: flex-end;
  }
}

@media (prefers-reduced-motion: reduce) {
  .home-page * {
    transition: none !important;
  }
}
</style>
