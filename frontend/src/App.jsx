import { useState, useEffect, useCallback } from 'react'
import {
  GetAllCountries, AddCountry, UpdateCountry, DeleteCountry,
  GetAllMaterialGroups, AddMaterialGroup, UpdateMaterialGroup, DeleteMaterialGroup,
  GetAllDeclarations, AddDeclaration, UpdateDeclaration, DeleteDeclaration,
  GetAllRegulations, AddRegulation, UpdateRegulation, DeleteRegulation,
  GetAllItemData, AddItemData, UpdateItemData, DeleteItemData, SearchItemData,
} from '../wailsjs/go/main/App'
import { BrowserOpenURL } from '../wailsjs/runtime/runtime'

// ── URL helper ────────────────────────────────────────────────────
const isURL = (val) => {
  if (!val || typeof val !== 'string') return false
  return /^https?:\/\//i.test(val.trim())
}

// ── Tiny helpers ──────────────────────────────────────────────────
const useToast = () => {
  const [toast, setToast] = useState(null)
  const show = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2800)
  }
  return [toast, show]
}

// ── Generic lookup-table panel (Country / MaterialGroup / Regulation) ─────
function LookupPanel({ title, rows, cols, onAdd, onUpdate, onDelete, emptyRow, renderForm }) {
  const [showModal, setShowModal] = useState(false)
  const [editRow, setEditRow] = useState(null)
  const [form, setForm] = useState(emptyRow)
  const [delTarget, setDelTarget] = useState(null)
  const [toast, showToast] = useToast()

  const openAdd = () => { setForm(emptyRow); setEditRow(null); setShowModal(true) }
  const openEdit = (r) => { setForm(r); setEditRow(r); setShowModal(true) }

  const handleSubmit = async (e) => {
    e.preventDefault()
    try {
      if (editRow) await onUpdate(form)
      else await onAdd(form)
      showToast(editRow ? `${title} updated` : `${title} added`)
      setShowModal(false)
    } catch (err) { showToast('Operation failed', 'error') }
  }

  const handleDelete = async () => {
    try {
      await onDelete(delTarget.id)
      showToast(`${title} deleted`)
      setDelTarget(null)
    } catch (err) { showToast('Delete failed', 'error') }
  }

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title">{title}</span>
        <span className="panel-count">{rows.length} rows</span>
        <button className="btn-add-sm" onClick={openAdd}>+ Add</button>
      </div>
      <div className="panel-body">
        {rows.length === 0 ? (
          <div className="panel-empty">No records yet</div>
        ) : (
          <table className="mini-table">
            <thead><tr>
              {cols.map(c => <th key={c.key}>{c.label}</th>)}
              <th></th>
            </tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id ?? i}>
                  {cols.map(c => <td key={c.key}>{r[c.key]}</td>)}
                  <td className="td-actions">
                    <button className="btn-edit" onClick={() => openEdit(r)}>Edit</button>
                    <button className="btn-del" onClick={() => setDelTarget(r)}>Del</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editRow ? `Edit ${title}` : `Add ${title}`}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form className="form" onSubmit={handleSubmit}>
              {renderForm(form, setForm)}
              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-save">{editRow ? 'Save' : 'Add'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {delTarget && (
        <div className="overlay" onClick={() => setDelTarget(null)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete {title}</h2>
              <button className="modal-close" onClick={() => setDelTarget(null)}>✕</button>
            </div>
            <p className="confirm-text">Delete <strong>{delTarget.name ?? `#${delTarget.id}`}</strong>? This cannot be undone.</p>
            <div className="form-actions">
              <button className="btn-cancel" onClick={() => setDelTarget(null)}>Cancel</button>
              <button className="btn-del-confirm" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}

// ── Empty ItemData form ───────────────────────────────────────────
const emptyItemData = {
  itemid: '', materialName: '', regulationtype: '', country: '',
  regulationLink: '', labellingReq: '', packagingReq: '', phytoSanitaryReq: '',
  declaration: '0', solvent: '', aflatoxin: '', ochratoxin: '', heavyMetal: '',
  pesticides: '', pah: '', pcbs: '', remarks: '', website: '',
  mercury: '', cadmium: '', aflatoxinB1: '', aflatoxinSum: '',
  ochratoxinA: '', pahLink: '', arsenic: '',
}

const toItemData = (f) => ({
  ...f,
  itemid: parseInt(f.itemid) || 0,
  materialName: parseInt(f.materialName) || 0,
  regulationtype: parseInt(f.regulationtype) || 0,
  country: parseInt(f.country) || 0,
  declaration: parseInt(f.declaration) || 0,
})

const fromItemData = (d) => ({
  ...d,
  itemid: String(d.itemid),
  materialName: String(d.materialName),
  regulationtype: String(d.regulationtype),
  country: String(d.country),
  declaration: String(d.declaration),
})

// ── ItemData section ──────────────────────────────────────────────
function ItemDataSection({ countries, materials, regulations, declarations }) {
  const [rows, setRows] = useState([])
  const [allRows, setAllRows] = useState([])
  const [search, setSearch] = useState('')
  const [filterCountry, setFilterCountry] = useState('')
  const [filterMaterial, setFilterMaterial] = useState('')
  const [filterRegulation, setFilterRegulation] = useState('')
  const [loading, setLoading] = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [editKey, setEditKey] = useState(null)   // composite key object
  const [form, setForm] = useState(emptyItemData)
  const [viewRow, setViewRow] = useState(null)
  const [delTarget, setDelTarget] = useState(null)
  const [toast, showToast] = useToast()
  const [tab, setTab] = useState('basic') // basic | contaminants | links

  const applyFilters = (data, country, material, regulation) => {
    return data.filter(r => {
      if (country && String(r.country) !== String(country)) return false
      if (material && String(r.materialName) !== String(material)) return false
      if (regulation && String(r.regulationtype) !== String(regulation)) return false
      return true
    })
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = search.trim() ? await SearchItemData(search) : await GetAllItemData()
      const fetched = data || []
      setAllRows(fetched)
      setRows(fetched)
    } catch { showToast('Failed to load', 'error') }
    finally { setLoading(false) }
  }, [search])

  const handleFind = () => {
    setRows(applyFilters(allRows, filterCountry, filterMaterial, filterRegulation))
  }

  const handleClearFilters = () => {
    setFilterCountry('')
    setFilterMaterial('')
    setFilterRegulation('')
    setRows(allRows)
  }

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) }, [load])

  const openAdd = () => { setForm(emptyItemData); setEditKey(null); setTab('basic'); setShowModal(true) }
  const openEdit = (r) => {
    setForm(fromItemData(r))
    setEditKey({ itemid: r.itemid, country: r.country, materialName: r.materialName, regulationtype: r.regulationtype })
    setTab('basic')
    setShowModal(true)
  }

  const f = (key) => (e) => setForm(p => ({ ...p, [key]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    const payload = toItemData(form)
    try {
      if (editKey) { await UpdateItemData(payload); showToast('Record updated') }
      else { await AddItemData(payload); showToast('Record added') }
      setShowModal(false)
      await load()
    } catch (err) { showToast('Operation failed: ' + err, 'error') }
  }

  const handleDelete = async () => {
    try {
      await DeleteItemData(delTarget.itemid, delTarget.country, delTarget.materialName, delTarget.regulationtype)
      setDelTarget(null)
      showToast('Record deleted')
      await load()
    } catch { showToast('Delete failed', 'error') }
  }

  const handleDuplicate = async (r) => {
    const duped = fromItemData({ ...r, itemid: 0 })
    setForm(duped)
    setEditKey(null)
    setTab('basic')
    setShowModal(true)
  }

  const handlePrint = (r) => {
    const fields = [
      ['Item ID', r.itemid], ['Country', cName(r.country)],
      ['Material', mName(r.materialName)], ['Regulation', rName(r.regulationtype)],
      ['Declaration', dName(r.declaration)], ['Labelling Req', r.labellingReq],
      ['Packaging Req', r.packagingReq], ['PhytoSanitary Req', r.phytoSanitaryReq],
      ['Solvent', r.solvent], ['Aflatoxin', r.aflatoxin],
      ['Aflatoxin B1', r.aflatoxinB1], ['Aflatoxin Sum', r.aflatoxinSum],
      ['Ochratoxin', r.ochratoxin], ['Ochratoxin A', r.ochratoxinA],
      ['Heavy Metal', r.heavyMetal], ['Pesticides', r.pesticides],
      ['PAH', r.pah], ['PCBs', r.pcbs],
      ['Mercury', r.mercury], ['Cadmium', r.cadmium],
      ['Arsenic', r.arsenic], ['Remarks', r.remarks],
      ['Website', r.website], ['Regulation Link', r.regulationLink],
      ['PAH Link', r.pahLink],
    ]
    const rows = fields.map(([k, v]) => `
      <tr>
        <td style="padding:6px 12px;font-weight:700;color:#555;font-size:11px;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #eee;white-space:nowrap">${k}</td>
        <td style="padding:6px 12px;font-family:monospace;font-size:12px;border-bottom:1px solid #eee;word-break:break-all">${v || '—'}</td>
      </tr>`).join('')
    const html = `<!DOCTYPE html><html><head><title>Item #${r.itemid}</title>
      <style>body{font-family:system-ui,sans-serif;margin:0;padding:24px;color:#222}
      h1{font-size:18px;margin-bottom:16px}table{border-collapse:collapse;width:100%}
      @media print{body{padding:0}}</style></head>
      <body><h1>Item Data — ID ${r.itemid} &nbsp;|&nbsp; ${mName(r.materialName)} &nbsp;|&nbsp; ${cName(r.country)}</h1>
      <table>${rows}</table></body></html>`
    const w = window.open('', '_blank', 'width=700,height=800')
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => w.print(), 400)
  }

  const cName = (id) => countries.find(c => c.id === id)?.name ?? id
  const mName = (id) => materials.find(m => m.id === id)?.name ?? id
  const rName = (id) => regulations.find(r => r.id === id)?.name ?? id
  const dName = (id) => declarations.find(d => d.id === id)?.description ?? id
  // Shared input helper
  const fi = (label, key, opts = {}) => (
    <div className="form-row">
      <label>{label}</label>
      <input value={form[key]} onChange={f(key)} placeholder={opts.placeholder || ''} type={opts.type || 'text'} />
    </div>
  )
  const nonEditKeys = ["country", "materialName", "regulationtype"]
  const fs = (label, key, options) => {
    const locked = editKey && nonEditKeys.includes(key)
    return (
      <div className="form-row">
        <label>{label}</label>
        <select value={form[key]} onChange={f(key)} disabled={locked}>
          <option value="">— select —</option>
          {options.map(o => <option key={o.id} value={o.id}>{o.name ?? o.description ?? o.id}</option>)}
        </select>
      </div>
    )
  }

  return (
    <div className="item-section">
      <div className="section-toolbar">
        <div className="search-wrap">
          <span className="search-icon">⌕</span>
          <input className="search" placeholder="Search item ID, remarks, website…"
            value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button className="search-clear" onClick={() => setSearch('')}>✕</button>}
        </div>

        <div className="filter-group">
          <select
            className="filter-select"
            value={filterCountry}
            onChange={e => setFilterCountry(e.target.value)}
            title="Filter by Country"
          >
            <option value="">All Countries</option>
            {countries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select
            className="filter-select"
            value={filterMaterial}
            onChange={e => setFilterMaterial(e.target.value)}
            title="Filter by Material"
          >
            <option value="">All Materials</option>
            {materials.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>

          <select
            className="filter-select"
            value={filterRegulation}
            onChange={e => setFilterRegulation(e.target.value)}
            title="Filter by Regulation Type"
          >
            <option value="">All Regulations</option>
            {regulations.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>

          <button className="btn-find" onClick={handleFind}>🔍 Find</button>
          {(filterCountry || filterMaterial || filterRegulation) && (
            <button className="btn-clear-filter" onClick={handleClearFilters} title="Clear filters">✕</button>
          )}
        </div>

        <button className="btn-add" onClick={openAdd}>+ Add Record</button>
      </div>

      {loading ? (
        <div className="empty-state"><div className="spinner" /></div>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">⊞</div>
          <p>{search ? 'No records match.' : 'No item data yet.'}</p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Item ID</th>
                <th>Country</th>
                <th>Material</th>
                <th>Regulation</th>             
                <th>Declaration</th>
                <th>Labelling Req</th>
                <th>Remarks</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${r.itemid}-${r.country}-${r.materialName}-${r.regulationtype}`}
                    className="row" style={{ animationDelay: `${i * 20}ms` }}>
                  <td className="td-id">{r.itemid}</td>
                  <td><span className="tag tag-cty">{cName(r.country)}</span></td>
                  <td><span className="tag">{mName(r.materialName)}</span></td>
                  <td><span className="tag tag-reg">{rName(r.regulationtype)}</span></td>
                  <td><span className="tag tag-dec">{dName(r.declaration)}</span></td>
                  <td className="td-clip">{r.labellingReq || '—'}</td>
                  <td className="td-clip">{r.remarks || '—'}</td>
                  <td className="td-actions">
                    <button className="btn-view" onClick={() => setViewRow(r)}>View</button>
                    <button className="btn-edit" onClick={() => openEdit(r)}>Edit</button>
                    <button className="btn-dup" onClick={() => handleDuplicate(r)} title="Duplicate">⧉</button>
                    <button className="btn-del" onClick={() => setDelTarget(r)}>Del</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="overlay" onClick={() => setShowModal(false)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editKey ? 'Edit Item Data' : 'Add Item Data'}</h2>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="tab-bar">
              {['basic', 'contaminants', 'links'].map(t => (
                <button key={t} className={`tab-btn ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
            <form className="form" onSubmit={handleSubmit}>
              {tab === 'basic' && (
                <>
                  <div className="form-2col">
                    {/* {fi('Item ID', 'itemid', { type: 'number', placeholder: 'Auto if blank' })} */}
                    {fs('Country *', 'country', countries)}
                  </div>
                  <div className="form-2col">
                    {fs('Material Group *', 'materialName', materials)}
                    {fs('Regulation Type *', 'regulationtype', regulations)}
                  </div>
                  <div className="form-2col">
                    {fs('Declaration', 'declaration', declarations)}
                    {fi('Packaging Req', 'packagingReq')}
                  </div>
                  {fi('Labelling Req', 'labellingReq')}
                  {fi('PhytoSanitary Req', 'phytoSanitaryReq')}
                  {fi('Remarks', 'remarks')}
                </>
              )}
              {tab === 'contaminants' && (
                <>
                  <div className="form-2col">
                    {fi('Solvent', 'solvent')}
                    {fi('Heavy Metal', 'heavyMetal')}
                  </div>
                  <div className="form-2col">
                    {fi('Aflatoxin', 'aflatoxin')}
                    {fi('Aflatoxin B1', 'aflatoxinB1')}
                  </div>
                  <div className="form-2col">
                    {fi('Aflatoxin Sum', 'aflatoxinSum')}
                    {fi('Ochratoxin', 'ochratoxin')}
                  </div>
                  <div className="form-2col">
                    {fi('Ochratoxin A', 'ochratoxinA')}
                    {fi('Pesticides', 'pesticides')}
                  </div>
                  <div className="form-2col">
                    {fi('PAH', 'pah')}
                    {fi('PCBs', 'pcbs')}
                  </div>
                  <div className="form-2col">
                    {fi('Mercury', 'mercury')}
                    {fi('Cadmium', 'cadmium')}
                  </div>
                  {fi('Arsenic', 'arsenic')}
                </>
              )}
              {tab === 'links' && (
                <>
                  {fi('Regulation Link', 'regulationLink')}
                  {fi('Website', 'website')}
                  {fi('PAH Link', 'pahLink')}
                </>
              )}
              <div className="form-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn-save">{editKey ? 'Save Changes' : 'Add Record'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* View modal */}
      {viewRow && (
        <div className="overlay" onClick={() => setViewRow(null)}>
          <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Item Data — ID {viewRow.itemid}</h2>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn-print" onClick={() => handlePrint(viewRow)} title="Print">🖨 Print</button>
                <button className="btn-dup-view" onClick={() => { setViewRow(null); handleDuplicate(viewRow) }} title="Duplicate this record">⧉ Duplicate</button>
                <button className="modal-close" onClick={() => setViewRow(null)}>✕</button>
              </div>
            </div>
            <div className="view-grid">
              {[
                ['Item ID', viewRow.itemid], ['Country', cName(viewRow.country)],
                ['Material', mName(viewRow.materialName)], ['Regulation', rName(viewRow.regulationtype)],
                ['Declaration', viewRow.declaration], ['Labelling Req', viewRow.labellingReq],
                ['Packaging Req', viewRow.packagingReq], ['PhytoSanitary Req', viewRow.phytoSanitaryReq],
                ['Solvent', viewRow.solvent], ['Aflatoxin', viewRow.aflatoxin],
                ['Aflatoxin B1', viewRow.aflatoxinB1], ['Aflatoxin Sum', viewRow.aflatoxinSum],
                ['Ochratoxin', viewRow.ochratoxin], ['Ochratoxin A', viewRow.ochratoxinA],
                ['Heavy Metal', viewRow.heavyMetal], ['Pesticides', viewRow.pesticides],
                ['PAH', viewRow.pah], ['PCBs', viewRow.pcbs],
                ['Mercury', viewRow.mercury], ['Cadmium', viewRow.cadmium],
                ['Arsenic', viewRow.arsenic], ['Remarks', viewRow.remarks],
                ['Website', viewRow.website], ['Regulation Link', viewRow.regulationLink],
                ['PAH Link', viewRow.pahLink],
              ].map(([k, v]) => (
                <div key={k} className="view-field">
                  <span className="view-label">{k}</span>
                  <div className="view-val-row">
                    {isURL(v) ? (
                      <button
                        className="view-link"
                        onClick={() => BrowserOpenURL(v)}
                        title={`Open: ${v}`}
                      >
                        🔗 {v}
                      </button>
                    ) : (
                      <span className="view-val">{v || '—'}</span>
                    )}
                    {v ? (
                      <button
                        className="btn-copy-field"
                        title="Copy value"
                        onClick={() => {
                          navigator.clipboard.writeText(String(v))
                          showToast(`Copied: ${k}`, 'success')
                        }}
                      >⎘</button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            <div className="form-actions">
              <button className="btn-save" onClick={() => { setViewRow(null); openEdit(viewRow) }}>Edit This Record</button>
              <button className="btn-cancel" onClick={() => setViewRow(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {delTarget && (
        <div className="overlay" onClick={() => setDelTarget(null)}>
          <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Delete Record</h2>
              <button className="modal-close" onClick={() => setDelTarget(null)}>✕</button>
            </div>
            <p className="confirm-text">
              Delete Item <strong>#{delTarget.itemid}</strong> ({cName(delTarget.country)},
              {mName(delTarget.materialName)}, {rName(delTarget.regulationtype)})? Cannot be undone.
            </p>
            <div className="form-actions">
              <button className="btn-cancel" onClick={() => setDelTarget(null)}>Cancel</button>
              <button className="btn-del-confirm" onClick={handleDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast toast-${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}

// ── Root App ──────────────────────────────────────────────────────
export default function App() {
  const [activeTab, setActiveTab] = useState('itemdata')
  const [countries, setCountries] = useState([])
  const [materials, setMaterials] = useState([])
  const [itemData, setItemData] = useState([])
  const [declarations, setDeclarations] = useState([])
  const [regulations, setRegulations] = useState([])

  const refreshLookups = useCallback(async () => {
    const [c, m, d, r, i] = await Promise.all([
      GetAllCountries(), GetAllMaterialGroups(), GetAllDeclarations(), GetAllRegulations(), GetAllItemData()
    ])
    setCountries(c || [])
    setMaterials(m || [])
    setDeclarations(d || [])
    setRegulations(r || [])
    setItemData(i || [])
  }, [])

  useEffect(() => { refreshLookups() }, [refreshLookups])

  const TABS = [
    { id: 'itemdata',  label: '⊞ Item Data' },
    { id: 'country',   label: '🌍 Countries' },
    { id: 'material',  label: '⬡ Materials' },
    { id: 'decl',      label: '📋 Declarations' },
    { id: 'reg',       label: '⚖ Regulations' },
  ]

  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          <span className="logo-icon"></span>
          <span className="logo-text">Food Data</span>
        </div>
        <nav className="nav-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`nav-tab ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => { setActiveTab(t.id); refreshLookups() }}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="header-badges">
           <span className="badge">{itemData.length} Items</span>
          <span className="badge">{countries.length} Countries</span>
          <span className="badge">{materials.length} Materials</span>
          <span className="badge">{regulations.length} Regulations</span>
        </div>
      </header>

      <main className="main">
        {activeTab === 'itemdata' && (
          <ItemDataSection
            countries={countries} materials={materials}
            regulations={regulations} declarations={declarations}
          />
        )}

        {activeTab === 'country' && (
          <LookupPanel
            title="Country"
            rows={countries}
            cols={[{ key: 'id', label: 'ID' }, { key: 'name', label: 'Name' }, { key: 'code', label: 'Code' }]}
            emptyRow={{ name: '', code: '' }}
            onAdd={async (f) => { await AddCountry(f.name, f.code); refreshLookups() }}
            onUpdate={async (f) => { await UpdateCountry(f.id, f.name, f.code); refreshLookups() }}
            onDelete={async (id) => { await DeleteCountry(id); refreshLookups() }}
            renderForm={(form, setForm) => (
              <>
                <div className="form-row">
                  <label>Name *</label>
                  <input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="form-row">
                  <label>Code</label>
                  <input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} placeholder="e.g. IN, US, DE" />
                </div>
              </>
            )}
          />
        )}

        {activeTab === 'material' && (
          <LookupPanel
            title="Material Group"
            rows={materials}
            cols={[{ key: 'id', label: 'ID' }, { key: 'name', label: 'Name' }, { key: 'code', label: 'Code' }]}
            emptyRow={{ name: '', code: '' }}
            onAdd={async (f) => { await AddMaterialGroup(f.name, f.code); refreshLookups() }}
            onUpdate={async (f) => { await UpdateMaterialGroup(f.id, f.name, f.code); refreshLookups() }}
            onDelete={async (id) => { await DeleteMaterialGroup(id); refreshLookups() }}
            renderForm={(form, setForm) => (
              <>
                <div className="form-row">
                  <label>Name *</label>
                  <input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="form-row">
                  <label>Code</label>
                  <input value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} />
                </div>
              </>
            )}
          />
        )}

        {activeTab === 'decl' && (
          <LookupPanel
            title="Declaration"
            rows={declarations}
            cols={[{ key: 'id', label: 'ID' }, { key: 'code', label: 'Code' }, { key: 'description', label: 'Description' }]}
            emptyRow={{ code: '', description: '' }}
            onAdd={async (f) => { await AddDeclaration(parseInt(f.code) || 0, f.description); refreshLookups() }}
            onUpdate={async (f) => { await UpdateDeclaration(f.id, parseInt(f.code) || 0, f.description); refreshLookups() }}
            onDelete={async (id) => { await DeleteDeclaration(id); refreshLookups() }}
            renderForm={(form, setForm) => (
              <>
                <div className="form-row">
                  <label>Code *</label>
                  <input required type="number" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} />
                </div>
                <div className="form-row">
                  <label>Description</label>
                  <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                </div>
              </>
            )}
          />
        )}

        {activeTab === 'reg' && (
          <LookupPanel
            title="Regulation"
            rows={regulations}
            cols={[{ key: 'id', label: 'ID' }, { key: 'name', label: 'Name' }, { key: 'description', label: 'Description' }]}
            emptyRow={{ name: '', description: '' }}
            onAdd={async (f) => { await AddRegulation(f.name, f.description); refreshLookups() }}
            onUpdate={async (f) => { await UpdateRegulation(f.id, f.name, f.description); refreshLookups() }}
            onDelete={async (id) => { await DeleteRegulation(id); refreshLookups() }}
            renderForm={(form, setForm) => (
              <>
                <div className="form-row">
                  <label>Name *</label>
                  <input required value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="form-row">
                  <label>Description</label>
                  <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                </div>
              </>
            )}
          />
        )}
      </main>
    </div>
  )
}
