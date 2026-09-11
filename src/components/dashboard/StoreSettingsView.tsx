import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Store, SlidersHorizontal, Lock, RefreshCw, Camera, ImageIcon, X, Check, AlertCircle } from 'lucide-react'
import { useSettingsStore, useAdminAuthStore } from '../../store/store'
import { BRAND_LOGO, BRAND_EN } from '../../lib/brand'
import { isSupabaseConfigured } from '../../lib/supabase'

export default function StoreSettingsView() {
  const { settings, loading, saving, fetchSettings, updateSettings, uploadLogo, changePassword } = useSettingsStore()
  const role = useAdminAuthStore(state => state.role)

  const [form, setForm] = useState({
    name: '', ownerName: '', phone: '', email: '', address: '', instagramHandle: '',
    gstEnabled: false, lowStockThreshold: 5,
  })
  const [saveMsg, setSaveMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoErr, setLogoErr] = useState('')
  const logoInputRef = useRef<HTMLInputElement>(null)

  const [pwOpen, setPwOpen] = useState(false)
  const [pwNew, setPwNew] = useState('')
  const [pwConfirm, setPwConfirm] = useState('')
  const [pwErr, setPwErr] = useState('')
  const [pwSaving, setPwSaving] = useState(false)
  const [pwSuccess, setPwSuccess] = useState(false)

  useEffect(() => { void fetchSettings() }, [fetchSettings])

  useEffect(() => {
    if (!settings) return
    setForm({
      name: settings.name,
      ownerName: settings.ownerName,
      phone: settings.phone,
      email: settings.email,
      address: settings.address,
      instagramHandle: settings.instagramHandle,
      gstEnabled: settings.gstEnabled,
      lowStockThreshold: settings.lowStockThreshold,
    })
  }, [settings])

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    setSaveMsg(null)
    const { error } = await updateSettings(form)
    setSaveMsg(error ? { type: 'err', text: error } : { type: 'ok', text: 'Configuration saved.' })
    if (!error) setTimeout(() => setSaveMsg(null), 3000)
  }

  const handleLogoFile = async (file: File) => {
    setLogoErr('')
    if (file.size > 5_000_000) { setLogoErr('Image must be under 5 MB.'); return }
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'].includes(file.type)) {
      setLogoErr('Only JPEG, PNG, WebP, or SVG images are accepted.'); return
    }
    setLogoUploading(true)
    const { error } = await uploadLogo(file)
    setLogoUploading(false)
    if (error) setLogoErr(error)
  }

  const openPasswordModal = () => {
    setPwNew(''); setPwConfirm(''); setPwErr(''); setPwSuccess(false); setPwOpen(true)
  }

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault()
    setPwErr('')
    if (pwNew.trim().length < 4) { setPwErr('Password must be at least 4 characters.'); return }
    if (pwNew !== pwConfirm) { setPwErr('Passwords do not match.'); return }
    if (!role) { setPwErr('No active role found.'); return }
    setPwSaving(true)
    const { error } = await changePassword(role, pwNew.trim())
    setPwSaving(false)
    if (error) { setPwErr(error); return }
    setPwSuccess(true)
    setTimeout(() => setPwOpen(false), 1500)
  }

  const logoSrc = settings?.logoUrl || BRAND_LOGO

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[20px] sm:text-[22px] font-black text-[#111111]">Store Configuration &amp; Settings</h2>
          <p className="text-[13px] text-[#6B7280] mt-1">Manage shop information, contact details, branding, and system thresholds.</p>
        </div>
        <button
          type="button"
          onClick={() => void fetchSettings()}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-[#E5E7EB] rounded-xl text-[13px] font-bold text-[#111111] hover:bg-[#F9FAFB] transition-colors shadow-sm"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Reload
        </button>
      </div>

      {loading && !settings ? (
        <div className="p-10 text-center text-[13px] font-bold text-[#6B7280]">Loading settings...</div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Branding */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB]/60 p-4 sm:p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <ImageIcon size={16} className="text-[#2E7D32]" />
              <h3 className="text-[13px] font-black uppercase tracking-wider text-[#2E7D32]">Branding</h3>
            </div>
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border border-[#E5E7EB]">
                  <img src={logoSrc} alt={BRAND_EN} className="w-full h-full object-cover" />
                </div>
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  disabled={logoUploading || !isSupabaseConfigured}
                  className="absolute bottom-0 right-0 w-7 h-7 bg-[#2E7D32] hover:bg-[#256428] text-white rounded-full flex items-center justify-center shadow-md transition-colors disabled:opacity-60"
                  aria-label="Change logo"
                  title="Change logo"
                >
                  {logoUploading ? <RefreshCw size={13} className="animate-spin" /> : <Camera size={13} />}
                </button>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) void handleLogoFile(f) }}
                />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-[#111111]">Store logo</p>
                <p className="text-[12px] text-[#6B7280] break-words">
                  Used everywhere the app shows your brand mark — navigation bar, login screens, and generated invoices &amp; receipts.
                </p>
                {!isSupabaseConfigured && (
                  <p className="text-[11px] text-amber-700 mt-1">Connect Supabase to enable logo uploads.</p>
                )}
                {logoErr && <p className="text-[11px] text-red-600 mt-1">{logoErr}</p>}
              </div>
            </div>
          </div>

          {/* Business Information */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB]/60 p-4 sm:p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <Store size={16} className="text-[#2E7D32]" />
              <h3 className="text-[13px] font-black uppercase tracking-wider text-[#2E7D32]">Business Information</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Shop Name">
                <input className={inputCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </Field>
              <Field label="Owner / Signatory Name">
                <input className={inputCls} value={form.ownerName} onChange={e => setForm(f => ({ ...f, ownerName: e.target.value }))} />
              </Field>
              <Field label="Contact Phone Number(s)">
                <input className={inputCls} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </Field>
              <Field label="Store Email Address">
                <input type="email" className={inputCls} value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </Field>
              <Field label="Store Address (Invoices &amp; Receipts)" full>
                <textarea rows={2} className={`${inputCls} resize-none`} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
              </Field>
              <Field label="Instagram Handle" full>
                <input className={inputCls} value={form.instagramHandle} onChange={e => setForm(f => ({ ...f, instagramHandle: e.target.value }))} />
              </Field>
            </div>
          </div>

          {/* Billing & Inventory Thresholds */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB]/60 p-4 sm:p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <SlidersHorizontal size={16} className="text-[#2E7D32]" />
              <h3 className="text-[13px] font-black uppercase tracking-wider text-[#2E7D32]">Billing &amp; Inventory Thresholds</h3>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="flex-1">
                <Field label="Default Low Stock Threshold">
                  <input
                    type="number" min={0} step={1} className={inputCls}
                    value={form.lowStockThreshold}
                    onChange={e => setForm(f => ({ ...f, lowStockThreshold: Number(e.target.value) || 0 }))}
                  />
                </Field>
                <p className="text-[11px] text-[#6B7280] mt-1.5">Triggers automatic alerts and banners when product stock reaches or drops below this count.</p>
              </div>
              <label className="flex items-start gap-2.5 sm:mt-6 cursor-pointer">
                <input
                  type="checkbox" checked={form.gstEnabled}
                  onChange={e => setForm(f => ({ ...f, gstEnabled: e.target.checked }))}
                  className="mt-0.5 w-4 h-4 accent-[#2E7D32]"
                />
                <span>
                  <span className="block text-[13px] font-bold text-[#111111]">Enable GST Billing in POS</span>
                  <span className="block text-[11px] text-[#6B7280]">When enabled, GST line items are computed on invoices.</span>
                </span>
              </label>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            {saveMsg && (
              <span className={`text-[12px] font-bold flex items-center gap-1.5 ${saveMsg.type === 'ok' ? 'text-[#2E7D32]' : 'text-red-600'}`}>
                {saveMsg.type === 'ok' ? <Check size={14} /> : <AlertCircle size={14} />} {saveMsg.text}
              </span>
            )}
            <button
              type="submit" disabled={saving}
              className="px-6 py-3 bg-[#2E7D32] hover:bg-[#256428] text-white rounded-xl text-[13px] font-bold shadow-sm transition-colors disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Configuration'}
            </button>
          </div>

          {/* Account Security */}
          <div className="bg-white rounded-2xl border border-[#E5E7EB]/60 p-4 sm:p-6 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Lock size={16} className="text-[#2E7D32] shrink-0" />
              <div>
                <p className="text-[13px] font-black uppercase tracking-wider text-[#2E7D32]">Account Security</p>
                <p className="text-[12px] text-[#6B7280]">Update your {role || 'portal'} login password.</p>
              </div>
            </div>
            <button
              type="button" onClick={openPasswordModal}
              className="px-5 py-2.5 bg-[#0A0A0A] hover:bg-[#1A1A1A] text-white rounded-xl text-[13px] font-bold shadow-sm transition-colors shrink-0"
            >
              Change Password
            </button>
          </div>
        </form>
      )}

      {pwOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4" onClick={() => setPwOpen(false)}>
          <div
            onClick={e => e.stopPropagation()}
            className="w-full max-w-sm bg-white rounded-2xl shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between p-4 border-b border-[#E5E7EB]">
              <h3 className="text-[14px] font-black text-[#111111]">Change Password</h3>
              <button type="button" onClick={() => setPwOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#F9FAFB] text-[#6B7280]">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleChangePassword} className="p-4 space-y-4">
              {pwSuccess ? (
                <p className="text-[13px] font-bold text-[#2E7D32] flex items-center gap-2"><Check size={16} /> Password updated.</p>
              ) : (
                <>
                  <Field label="New Password">
                    <input type="password" className={inputCls} value={pwNew} onChange={e => setPwNew(e.target.value)} autoFocus />
                  </Field>
                  <Field label="Confirm New Password">
                    <input type="password" className={inputCls} value={pwConfirm} onChange={e => setPwConfirm(e.target.value)} />
                  </Field>
                  {pwErr && <p className="text-[12px] text-red-600">{pwErr}</p>}
                  <button
                    type="submit" disabled={pwSaving}
                    className="w-full py-3 bg-[#2E7D32] hover:bg-[#256428] text-white rounded-xl text-[13px] font-bold shadow-sm transition-colors disabled:opacity-60"
                  >
                    {pwSaving ? 'Saving...' : 'Update Password'}
                  </button>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

const inputCls = 'w-full px-3.5 py-2.5 bg-[#F9FAFB] border border-[#E5E7EB]/60 rounded-xl text-[13px] font-bold text-[#111111] placeholder:text-[#9CA3AF] focus:outline-none focus:border-[#2E7D32] transition-colors'

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <label className="block text-[11px] font-black uppercase tracking-wider text-[#6B7280] mb-1.5">{label}</label>
      {children}
    </div>
  )
}
