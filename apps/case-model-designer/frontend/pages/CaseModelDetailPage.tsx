import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  LuArrowDown,
  LuArrowUp,
  LuChevronDown,
  LuChevronLeft,
  LuChevronRight,
  LuSettings,
  LuTrash2,
} from 'react-icons/lu';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AttributeDialog,
  type AttributeDialogPayload,
} from '@shell/components/admin/AttributeDialog.js';
import { api, apiHeaders, apiJsonHeaders } from '@shell/api/client.js';
import { useI18n } from '@shell/i18n/I18nContext.js';
import type { Locale } from '@shell/i18n/locale.js';
import {
  createModelAttribute,
  deleteAttributeDefinition,
  listModelAttributes,
  updateAttributeDefinition,
  type AttributeDefinition,
  type DefinitionScope,
} from '@shell/lib/attribute-api.js';
import { dataTypeMessageKey } from '@shell/lib/data-type-label.js';
import { encryptionModeMessageKey } from '@shell/lib/encryption-mode-label.js';
import { labelFromTranslations } from '@shell/lib/model-label.js';
import type { MessageKey } from '@shell/i18n/messages.js';
import type { components } from '@shell/api/schema.js';
import { InstanceDefaultValueCell } from '../components/InstanceDefaultValueCell.js';
import { SystemFieldValueCell } from '../components/SystemFieldValueCell.js';
import { useEffectiveSettings } from '../hooks/useEffectiveSettings.js';
import {
  findCaseStatusDefinition,
  isCaseInstanceStatusAttribute,
} from '@shell/lib/case-instance-status.js';
import {
  buildModelTabSystemFieldRows,
  systemFieldSearchText,
  type SystemFieldRow,
} from '../lib/case-model-system-fields.js';

type CaseModel = components['schemas']['CaseModel'];
type TabId = 'model' | 'instance';
type SortColumn = 'name' | 'type' | 'required' | 'default' | 'encryption';
type SortDirection = 'asc' | 'desc';

type CustomFieldRow = {
  kind: 'custom';
  id: string;
  attribute: AttributeDefinition;
};

type PlatformStatusRow = {
  kind: 'platform_status';
  id: string;
  attribute: AttributeDefinition;
};

type ListRow = SystemFieldRow | CustomFieldRow | PlatformStatusRow;

function isCustomRow(row: ListRow): row is CustomFieldRow {
  return row.kind === 'custom';
}

function isPlatformStatusRow(row: ListRow): row is PlatformStatusRow {
  return row.kind === 'platform_status';
}

export function CaseModelDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { locale, msg } = useI18n();
  const { settings, loading: settingsLoading } = useEffectiveSettings();
  const advanced = settings.editorLayout === 'advanced';
  const defaultEncryption =
    settings.defaultAttributeEncryptionMode === 'zero_knowledge'
      ? 'zero_knowledge'
      : 'server_readable';
  const itemsPerPage = Math.max(5, Number(settings.itemsPerPage) || 25);

  const [activeTab, setActiveTab] = useState<TabId>('model');
  const [model, setModel] = useState<CaseModel | null>(null);
  const [modelScopeItems, setModelScopeItems] = useState<AttributeDefinition[]>([]);
  const [instanceScopeItems, setInstanceScopeItems] = useState<AttributeDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldSaving, setFieldSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [actionsOpen, setActionsOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingModel, setDeletingModel] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AttributeDefinition | null>(null);
  const [sortColumn, setSortColumn] = useState<SortColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const actionsRef = useRef<HTMLDivElement>(null);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const definitionScope: DefinitionScope = activeTab === 'model' ? 'model' : 'instance';
  const customItems = activeTab === 'model' ? modelScopeItems : instanceScopeItems;

  const refresh = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    const headers = apiHeaders(locale);
    const [modelRes, modelAttrs, instanceAttrs] = await Promise.all([
      api.GET('/v1/case-models/{id}', { headers, params: { path: { id } } }),
      listModelAttributes(id, locale, 'model'),
      listModelAttributes(id, locale, 'instance'),
    ]);
    setLoading(false);
    if (modelRes.error || modelAttrs.error || instanceAttrs.error) {
      setError(msg('errorGeneric'));
      return;
    }
    setModel(modelRes.data ?? null);
    setModelScopeItems((modelAttrs.data?.items ?? []) as AttributeDefinition[]);
    setInstanceScopeItems((instanceAttrs.data?.items ?? []) as AttributeDefinition[]);
  }, [id, locale, msg]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setPage(0);
    setSelectedIds(new Set());
    setSearch('');
  }, [activeTab]);

  const patchModel = useCallback(
    async (body: components['schemas']['UpdateCaseModelRequest']): Promise<boolean> => {
      if (!id) return false;
      setFieldSaving(true);
      setError(null);
      const res = await api.PATCH('/v1/case-models/{id}', {
        headers: apiJsonHeaders(locale),
        params: { path: { id } },
        body,
      });
      setFieldSaving(false);
      if (res.error || !res.response.ok || !res.data) {
        setError(msg('errorGeneric'));
        return false;
      }
      setModel(res.data);
      return true;
    },
    [id, locale, msg],
  );

  const allRows = useMemo((): ListRow[] => {
    if (!model) return [];
    if (activeTab === 'model') {
      const systemRows = buildModelTabSystemFieldRows(model, locale, msg, advanced);
      const customRows: CustomFieldRow[] = modelScopeItems.map((attribute) => ({
        kind: 'custom',
        id: attribute.id,
        attribute,
      }));
      return [...systemRows, ...customRows];
    }
    const statusAttribute = findCaseStatusDefinition(instanceScopeItems);
    const customAttributes = instanceScopeItems.filter(
      (attribute) => !isCaseInstanceStatusAttribute(attribute),
    );
    const rows: ListRow[] = [];
    if (statusAttribute) {
      rows.push({
        kind: 'platform_status',
        id: statusAttribute.id,
        attribute: statusAttribute,
      });
    }
    rows.push(
      ...customAttributes.map((attribute) => ({
        kind: 'custom' as const,
        id: attribute.id,
        attribute,
      })),
    );
    return rows;
  }, [model, activeTab, modelScopeItems, instanceScopeItems, locale, msg, advanced]);

  function rowLabel(row: ListRow): string {
    if (row.kind === 'system') return msg(row.labelKey);
    if (row.kind === 'platform_status') return msg('cmdInstanceStatus');
    const a = row.attribute;
    return a.display_name ?? labelFromTranslations(a.translations, a.key, locale);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allRows;
    return allRows.filter((row) => {
      if (row.kind === 'system') {
        return systemFieldSearchText(row, msg).includes(q);
      }
      if (row.kind === 'platform_status') {
        return [rowLabel(row), row.attribute.key, msg('cmdFieldTypeEnum')].join(' ').toLowerCase().includes(q);
      }
      const a = row.attribute;
      return [
        rowLabel(row),
        a.key,
        msg(dataTypeMessageKey(a.data_type)),
        a.is_required ? msg('yes') : msg('no'),
      ]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [allRows, search, locale, msg]);

  const sorted = useMemo(() => {
    if (!sortColumn) return filtered;
    const list = [...filtered];
    const dir = sortDirection === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      if (sortColumn === 'name') {
        return dir * rowLabel(a).localeCompare(rowLabel(b), locale);
      }
      if (a.kind === 'system' || b.kind === 'system' || a.kind === 'platform_status' || b.kind === 'platform_status') {
        return 0;
      }
      const aa = a.attribute;
      const ab = b.attribute;
      if (sortColumn === 'type') {
        return (
          dir *
          msg(dataTypeMessageKey(aa.data_type)).localeCompare(
            msg(dataTypeMessageKey(ab.data_type)),
            locale,
          )
        );
      }
      if (sortColumn === 'required') {
        return dir * (Number(aa.is_required) - Number(ab.is_required));
      }
      if (sortColumn === 'encryption') {
        return (
          dir *
          msg(encryptionModeMessageKey(aa.encryption_mode)).localeCompare(
            msg(encryptionModeMessageKey(ab.encryption_mode)),
            locale,
          )
        );
      }
      const defA = aa.default_value === null ? '' : JSON.stringify(aa.default_value);
      const defB = ab.default_value === null ? '' : JSON.stringify(ab.default_value);
      return dir * defA.localeCompare(defB, locale);
    });
    return list;
  }, [filtered, sortColumn, sortDirection, locale, msg]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / itemsPerPage));
  const pageItems = sorted.slice(page * itemsPerPage, page * itemsPerPage + itemsPerPage);
  const selectablePageIds = useMemo(
    () => pageItems.filter(isCustomRow).map((row) => row.id),
    [pageItems],
  );
  const allPageSelected =
    selectablePageIds.length > 0 && selectablePageIds.every((rowId) => selectedIds.has(rowId));
  const somePageSelected = selectablePageIds.some((rowId) => selectedIds.has(rowId));
  const rangeFrom = sorted.length === 0 ? 0 : page * itemsPerPage + 1;
  const rangeTo = Math.min(sorted.length, page * itemsPerPage + pageItems.length);
  const pageRangeLabel = msg('cmdPageRange')
    .replace('{from}', String(rangeFrom))
    .replace('{to}', String(rangeTo))
    .replace('{total}', String(sorted.length));

  useEffect(() => {
    if (selectedIds.size === 0) setActionsOpen(false);
  }, [selectedIds.size]);

  useEffect(() => {
    if (!actionsOpen) return;
    function onDocClick(e: MouseEvent) {
      if (actionsRef.current && !actionsRef.current.contains(e.target as Node)) {
        setActionsOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [actionsOpen]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = somePageSelected && !allPageSelected;
    }
  }, [somePageSelected, allPageSelected]);

  function toggleSelectAll() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allPageSelected) {
        for (const rowId of selectablePageIds) next.delete(rowId);
      } else {
        for (const rowId of selectablePageIds) next.add(rowId);
      }
      return next;
    });
  }

  function toggleSelect(rowId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) next.delete(rowId);
      else next.add(rowId);
      return next;
    });
  }

  function handleSortColumn(column: SortColumn) {
    setPage(0);
    if (sortColumn !== column) {
      setSortColumn(column);
      setSortDirection('asc');
      return;
    }
    setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
  }

  function sortIcon(column: SortColumn) {
    const active = sortColumn === column;
    return (
      <span className="admin-table-sort-icon" aria-hidden>
        {active &&
          (sortDirection === 'asc' ? <LuArrowUp size={14} /> : <LuArrowDown size={14} />)}
      </span>
    );
  }

  function apiErrorMessage(err: unknown): string {
    const e = err as { message?: string };
    return e?.message ?? msg('errorGeneric');
  }

  async function handleCreate(payload: AttributeDialogPayload): Promise<string | null> {
    if (!id) return msg('errorGeneric');
    const res = await createModelAttribute(id, locale, payload);
    if (res.error) return apiErrorMessage(res.error);
    await refresh();
    return null;
  }

  async function handleEdit(payload: AttributeDialogPayload): Promise<string | null> {
    if (!editTarget) return msg('errorGeneric');
    const res = await updateAttributeDefinition(editTarget.id, locale, payload);
    if (res.error) return apiErrorMessage(res.error);
    await refresh();
    return null;
  }

  async function handleDeleteModel() {
    if (!id || deletingModel) return;
    if (!window.confirm(msg('cmdDeleteModelConfirm'))) return;

    setDeletingModel(true);
    setError(null);
    const res = await api.DELETE('/v1/case-models/{id}', {
      headers: apiHeaders(locale),
      params: { path: { id } },
    });
    setDeletingModel(false);

    if (res.error || !res.response.ok) {
      const err = res.error as { message?: string } | undefined;
      setError(err?.message ?? msg('errorGeneric'));
      return;
    }

    navigate('/apps/case-model-designer');
  }

  async function handleBulkDelete() {
    setActionsOpen(false);
    if (selectedIds.size === 0 || deleting) return;
    if (!window.confirm(msg('attributesBulkDeleteConfirm'))) return;

    setDeleting(true);
    setError(null);
    const ids = [...selectedIds];
    try {
      const results = await Promise.all(
        ids.map((attrId) => deleteAttributeDefinition(attrId, locale)),
      );
      const failed = results.filter((r) => r.error || !r.response.ok);
      if (failed.length === ids.length) {
        setError(msg('errorGeneric'));
        return;
      }
      setSelectedIds(new Set());
      await refresh();
    } finally {
      setDeleting(false);
    }
  }

  const title = model
    ? (model.display_name ?? labelFromTranslations(model.translations, model.key, locale))
    : msg('loading');

  const addLabel = activeTab === 'model' ? msg('cmdAddModelField') : msg('cmdAddCaseField');
  const colCount = activeTab === 'instance' ? (advanced ? 6 : 5) : advanced ? 5 : 4;

  function thSort(column: SortColumn, label: MessageKey, className?: string) {
    return (
      <th
        className={className}
        aria-sort={sortColumn === column ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
      >
        <button type="button" className="admin-table-sort" onClick={() => handleSortColumn(column)}>
          {msg(label)}
          {sortIcon(column)}
        </button>
      </th>
    );
  }

  return (
    <div className="admin-page admin-page--shell">
      <nav className="admin-breadcrumb" aria-label="Breadcrumb">
        <Link to="/apps/case-model-designer">{msg('cmdAppTitle')}</Link>
        <span className="admin-breadcrumb-sep">›</span>
        <span aria-current="page">{title}</span>
      </nav>

      {model && (
        <>
          <header className="admin-page-header">
            <h1 className="admin-page-title">{title}</h1>
            <div className="admin-toolbar">
              <button type="button" className="button-outline" onClick={() => setCreateOpen(true)}>
                + {addLabel}
              </button>
              <button
                type="button"
                className="button-icon button-icon--danger"
                title={msg('cmdDeleteModel')}
                aria-label={msg('cmdDeleteModel')}
                disabled={deletingModel}
                onClick={() => void handleDeleteModel()}
              >
                <LuTrash2 size={18} aria-hidden />
              </button>
              <Link
                to="/apps/case-model-designer/settings"
                className="button-icon"
                title="App-Settings"
                aria-label="App-Settings"
              >
                <LuSettings size={18} aria-hidden />
              </Link>
            </div>
          </header>

          <div className="admin-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'model'}
              className={`admin-tab${activeTab === 'model' ? ' admin-tab--active' : ''}`}
              onClick={() => setActiveTab('model')}
            >
              {msg('cmdTabModelFields')}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'instance'}
              className={`admin-tab${activeTab === 'instance' ? ' admin-tab--active' : ''}`}
              onClick={() => setActiveTab('instance')}
            >
              {msg('cmdTabCaseFields')}
            </button>
          </div>

          <div className="admin-list-controls">
            <div className="admin-list-controls-left">
              <div className="admin-search-wrap">
                <input
                  type="search"
                  className="admin-search"
                  placeholder={msg('search')}
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(0);
                  }}
                />
              </div>

              <div className="admin-list-actions-slot">
                {selectedIds.size > 0 && (
                  <div className="admin-list-actions-row">
                    <div className="admin-bulk-actions" ref={actionsRef}>
                      <button
                        type="button"
                        className="button-outline admin-bulk-actions-toggle"
                        aria-expanded={actionsOpen}
                        aria-haspopup="menu"
                        disabled={deleting}
                        onClick={() => setActionsOpen((open) => !open)}
                      >
                        {msg('cmdActions')}
                        <LuChevronDown size={14} aria-hidden />
                      </button>
                      {actionsOpen && (
                        <div className="admin-bulk-actions-menu" role="menu">
                          <button
                            type="button"
                            role="menuitem"
                            className="admin-bulk-actions-menu--danger"
                            disabled={deleting}
                            onClick={() => void handleBulkDelete()}
                          >
                            {msg('cmdBulkDelete')}
                          </button>
                        </div>
                      )}
                    </div>
                    <span className="admin-list-toolbar-meta">
                      {msg('cmdSelectedCount').replace('{count}', String(selectedIds.size))}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {!loading && !settingsLoading && sorted.length > 0 && (
              <div className="admin-list-pagination">
                <button
                  type="button"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                  aria-label={msg('cmdPrevPage')}
                >
                  <LuChevronLeft size={16} aria-hidden />
                </button>
                <span>{pageRangeLabel}</span>
                <button
                  type="button"
                  disabled={page >= pageCount - 1}
                  onClick={() => setPage((p) => p + 1)}
                  aria-label={msg('cmdNextPage')}
                >
                  <LuChevronRight size={16} aria-hidden />
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {(loading || settingsLoading) && <p>{msg('loading')}</p>}
      {error && <p className="form-error">{error}</p>}

      {!loading && !settingsLoading && !error && model && (
        <div
          className={
            activeTab === 'model'
              ? 'admin-list-card admin-list-card--model-fields'
              : 'admin-list-card admin-list-card--case-fields'
          }
        >
          <div className="admin-table-wrap">
            <table className="admin-table admin-table--fixed-cols">
              <thead>
                <tr>
                  <th className="admin-table-col-check">
                    {selectablePageIds.length > 0 && (
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        className="admin-table-checkbox"
                        checked={allPageSelected}
                        onChange={toggleSelectAll}
                        aria-label={msg('cmdSelectAll')}
                      />
                    )}
                  </th>
                  {thSort('name', 'attributesColAttribute', 'admin-table-col-label')}
                  {advanced && <th className="admin-table-col-key">{msg('modelsColName')}</th>}
                  {thSort('type', 'modelsColType', 'admin-table-col-status')}
                  {activeTab === 'model' && thSort('default', 'cmdColValue')}
                  {activeTab === 'instance' && thSort('required', 'fieldsColRequired')}
                  {activeTab === 'instance' && thSort('default', 'fieldsColDefault')}
                  {activeTab === 'instance' &&
                    thSort('encryption', 'attributesEncryption', 'admin-table-col-encryption')}
                </tr>
              </thead>
              <tbody>
                {pageItems.length === 0 ? (
                  <tr>
                    <td colSpan={colCount} className="admin-table-empty">
                      {search ? msg('modelsNoResults') : msg('attributesEmpty')}
                    </td>
                  </tr>
                ) : (
                  pageItems.map((row) => {
                    if (row.kind === 'platform_status') {
                      const a = row.attribute;
                      const name = rowLabel(row);
                      return (
                        <tr key={row.id} className="admin-table-row--system">
                          <td className="admin-table-col-check" />
                          <td>
                            <button
                              type="button"
                              className="admin-table-link admin-table-link--button"
                              onClick={() => setEditTarget(a)}
                            >
                              {name}
                            </button>
                            <span className="admin-table-sub"> ({msg('cmdSystemField')})</span>
                          </td>
                          {advanced && (
                            <td className="admin-table-col-key">
                              <code>{a.key}</code>
                            </td>
                          )}
                          <td className="admin-table-col-status">
                            {msg(dataTypeMessageKey(a.data_type))}
                          </td>
                          <td>{a.is_required ? msg('yes') : msg('no')}</td>
                          <td>
                            <InstanceDefaultValueCell
                              attribute={a}
                              locale={locale}
                              saving={fieldSaving}
                              onSavingChange={setFieldSaving}
                              onUpdated={() => void refresh()}
                              readOnly
                            />
                          </td>
                          <td className="admin-table-col-encryption">
                            {msg(encryptionModeMessageKey(a.encryption_mode))}
                          </td>
                        </tr>
                      );
                    }
                    if (row.kind === 'system') {
                      return (
                        <tr key={row.id} className="admin-table-row--system">
                          <td className="admin-table-col-check" />
                          <td>
                            <span className="admin-table-link">{msg(row.labelKey)}</span>
                            <span className="admin-table-sub"> ({msg('cmdSystemField')})</span>
                          </td>
                          {advanced && (
                            <td className="admin-table-col-key">
                              <code>{row.fieldKey}</code>
                            </td>
                          )}
                          <td className="admin-table-col-status">{msg(row.typeKey)}</td>
                          <td className="admin-table-col-encryption">
                            <SystemFieldValueCell
                              row={row}
                              model={model}
                              saving={fieldSaving}
                              onPatch={patchModel}
                            />
                          </td>
                        </tr>
                      );
                    }

                    const selected = selectedIds.has(row.id);
                    const name = rowLabel(row);
                    const a = row.attribute;
                    return (
                      <tr
                        key={row.id}
                        className={selected ? 'admin-table-row--selected' : undefined}
                      >
                        <td className="admin-table-col-check">
                          <input
                            type="checkbox"
                            className="admin-table-checkbox"
                            checked={selected}
                            onChange={() => toggleSelect(row.id)}
                            aria-label={name}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="admin-table-link admin-table-link--button"
                            onClick={() => setEditTarget(a)}
                          >
                            {name}
                          </button>
                        </td>
                        {advanced && <td className="admin-table-col-key">{a.key}</td>}
                        <td className="admin-table-col-status">
                          {msg(dataTypeMessageKey(a.data_type))}
                        </td>
                        {activeTab === 'model' && (
                          <td>
                            <InstanceDefaultValueCell
                              attribute={a}
                              locale={locale}
                              saving={fieldSaving}
                              onSavingChange={setFieldSaving}
                              onUpdated={() => void refresh()}
                            />
                          </td>
                        )}
                        {activeTab === 'instance' && (
                          <>
                            <td>{a.is_required ? msg('yes') : msg('no')}</td>
                            <td>
                              <InstanceDefaultValueCell
                                attribute={a}
                                locale={locale}
                                saving={fieldSaving}
                                onSavingChange={setFieldSaving}
                                onUpdated={() => void refresh()}
                              />
                            </td>
                            <td className="admin-table-col-encryption">
                              {msg(encryptionModeMessageKey(a.encryption_mode))}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AttributeDialog
        open={createOpen}
        mode="create"
        definitionScope={definitionScope}
        defaultEncryptionMode={defaultEncryption}
        extendedFields
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />
      <AttributeDialog
        open={editTarget !== null}
        mode="edit"
        definitionScope={editTarget?.definition_scope ?? definitionScope}
        attribute={editTarget ?? undefined}
        extendedFields
        lockFields={
          editTarget && isCaseInstanceStatusAttribute(editTarget)
            ? {
                name: true,
                dataType: true,
                isRequired: true,
                encryption: true,
                selectOptions: true,
                defaultValue: true,
              }
            : undefined
        }
        onClose={() => setEditTarget(null)}
        onSubmit={handleEdit}
      />
    </div>
  );
}
