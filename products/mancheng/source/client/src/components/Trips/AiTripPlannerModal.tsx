import { useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CalendarDays,
  Check,
  ChevronDown,
  Clock3,
  Hotel,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  TrainFront,
  Users,
  WalletCards,
  X,
} from 'lucide-react'
import Modal from '../shared/Modal'
import {
  aiItineraryApi,
  type AiItinerary,
  type AiItineraryDay,
  type AiItineraryInput,
  type AiItineraryItem,
} from '../../api/client'
import { getApiErrorMessage, type Trip } from '../../types'
import { useTranslation } from '../../i18n'

interface AiTripPlannerModalProps {
  isOpen: boolean
  onClose: () => void
  onCreated: (trip: Trip) => void
}

type AiItineraryForm = Omit<AiItineraryInput, 'travelerCount'> & {
  travelerCount: number | ''
}

type EditableItem = Omit<AiItineraryItem, 'durationMinutes' | 'estimatedCost'> & {
  durationMinutes: number | ''
  estimatedCost: number | ''
}

interface ItemEditorState {
  dayDate: string
  index: number
  isNew: boolean
  draft: EditableItem
}

const interestOptions = [
  ['food', 'dashboard.aiInterestFood'],
  ['culture', 'dashboard.aiInterestCulture'],
  ['nature', 'dashboard.aiInterestNature'],
  ['shopping', 'dashboard.aiInterestShopping'],
  ['family', 'dashboard.aiInterestFamily'],
  ['art', 'dashboard.aiInterestArt'],
  ['nightlife', 'dashboard.aiInterestNightlife'],
  ['photo', 'dashboard.aiInterestPhoto'],
  ['outdoor', 'dashboard.aiInterestOutdoor'],
] as const

const initialForm: AiItineraryForm = {
  destination: '',
  startDate: '',
  endDate: '',
  travelerCount: '',
  arrivalTime: '',
  departureTime: '',
  baseLocation: '',
  transportPreference: 'mixed',
  interests: [],
  pace: 'balanced',
  specialRequirements: '',
}

const emptyItem: EditableItem = {
  name: '',
  description: '',
  address: null,
  startTime: null,
  durationMinutes: 90,
  estimatedCost: '',
}

export default function AiTripPlannerModal({ isOpen, onClose, onCreated }: AiTripPlannerModalProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState<AiItineraryForm>(initialForm)
  const [itinerary, setItinerary] = useState<AiItinerary | null>(null)
  const [editingItem, setEditingItem] = useState<ItemEditorState | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [regeneratingDate, setRegeneratingDate] = useState<string | null>(null)
  const [error, setError] = useState('')

  const dateError = useMemo(() => form.startDate && form.endDate && form.endDate < form.startDate, [form.startDate, form.endDate])
  const scheduleError = useMemo(
    () => form.startDate && form.startDate === form.endDate && form.arrivalTime && form.departureTime && form.departureTime <= form.arrivalTime,
    [form.arrivalTime, form.departureTime, form.endDate, form.startDate],
  )
  const inputClass = 'w-full rounded-lg border border-edge-secondary bg-surface-card px-3 py-2.5 text-sm text-content outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200'
  const iconButtonClass = 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-content-secondary transition hover:bg-surface-muted hover:text-content disabled:cursor-not-allowed disabled:opacity-30'

  const getTravelerCount = () => {
    if (typeof form.travelerCount !== 'number' || !Number.isInteger(form.travelerCount) || form.travelerCount < 1) return null
    return form.travelerCount
  }

  const getInput = (): AiItineraryInput | null => {
    const travelerCount = getTravelerCount()
    if (!travelerCount) return null
    return {
      ...form,
      destination: form.destination.trim(),
      travelerCount,
      arrivalTime: form.arrivalTime || undefined,
      departureTime: form.departureTime || undefined,
      baseLocation: form.baseLocation?.trim() || undefined,
      specialRequirements: form.specialRequirements.trim(),
    }
  }

  const reset = () => {
    setForm(initialForm)
    setItinerary(null)
    setEditingItem(null)
    setError('')
    setLoading(false)
    setSaving(false)
    setRegeneratingDate(null)
  }

  const close = () => { reset(); onClose() }

  const toggleInterest = (label: string) => {
    setForm(prev => ({ ...prev, interests: prev.interests.includes(label) ? prev.interests.filter(x => x !== label) : [...prev.interests, label] }))
  }

  const updateDay = (date: string, update: (day: AiItineraryDay) => AiItineraryDay) => {
    setItinerary(current => current ? { ...current, days: current.days.map(day => day.date === date ? update(day) : day) } : current)
  }

  const generate = async () => {
    setError('')
    const input = getInput()
    if (!input || !input.destination || !form.startDate || !form.endDate) {
      setError(t('dashboard.aiRequired'))
      return
    }
    if (dateError) {
      setError(t('dashboard.aiDateError'))
      return
    }
    if (scheduleError) {
      setError(t('dashboard.aiTimeError'))
      return
    }
    setLoading(true)
    try {
      const result = await aiItineraryApi.generate(input)
      setItinerary(result.itinerary)
    } catch (err) {
      setError(getApiErrorMessage(err, t('dashboard.aiGenerateError')))
    } finally {
      setLoading(false)
    }
  }

  const save = async () => {
    if (!itinerary) return
    setError('')
    setSaving(true)
    try {
      const input = getInput()
      if (!input) {
        setError(t('dashboard.aiRequired'))
        return
      }
      const result = await aiItineraryApi.create(input, itinerary)
      onCreated(result.trip)
      close()
    } catch (err) {
      setError(getApiErrorMessage(err, t('dashboard.aiSaveError')))
    } finally {
      setSaving(false)
    }
  }

  const startEditItem = (dayDate: string, index: number, item: AiItineraryItem) => {
    setError('')
    setEditingItem({
      dayDate,
      index,
      isNew: false,
      draft: {
        ...item,
        durationMinutes: item.durationMinutes,
        estimatedCost: item.estimatedCost ?? '',
      },
    })
  }

  const startAddItem = (dayDate: string, index: number) => {
    setError('')
    setEditingItem({ dayDate, index, isNew: true, draft: { ...emptyItem } })
  }

  const saveEditedItem = () => {
    if (!editingItem) return
    const { draft, dayDate, index, isNew } = editingItem
    const name = draft.name.trim()
    if (!name || draft.durationMinutes === '' || draft.durationMinutes < 15 || draft.durationMinutes > 720) {
      setError(t('dashboard.aiEditValidation'))
      return
    }
    const item: AiItineraryItem = {
      ...draft,
      name,
      description: draft.description.trim(),
      address: draft.address?.trim() || null,
      startTime: draft.startTime || null,
      durationMinutes: draft.durationMinutes,
      estimatedCost: draft.estimatedCost === '' ? undefined : draft.estimatedCost,
      lat: null,
      lng: null,
    }
    updateDay(dayDate, day => {
      const items = [...day.items]
      if (isNew) items.splice(index, 0, item)
      else items[index] = item
      return { ...day, items }
    })
    setEditingItem(null)
    setError('')
  }

  const deleteItem = (dayDate: string, index: number) => {
    updateDay(dayDate, day => ({ ...day, items: day.items.filter((_, itemIndex) => itemIndex !== index) }))
    if (editingItem?.dayDate === dayDate && editingItem.index === index) setEditingItem(null)
  }

  const moveItem = (dayDate: string, index: number, direction: -1 | 1) => {
    updateDay(dayDate, day => {
      const target = index + direction
      if (target < 0 || target >= day.items.length) return day
      const items = [...day.items]
      const [item] = items.splice(index, 1)
      items.splice(target, 0, item)
      return { ...day, items }
    })
    setEditingItem(null)
  }

  const regenerateDay = async (date: string) => {
    if (!itinerary || !window.confirm(t('dashboard.aiRegenerateDayConfirm'))) return
    const input = getInput()
    if (!input) return
    setError('')
    setEditingItem(null)
    setRegeneratingDate(date)
    try {
      const result = await aiItineraryApi.regenerateDay(input, itinerary, date)
      updateDay(date, () => result.day)
    } catch (err) {
      setError(getApiErrorMessage(err, t('dashboard.aiRegenerateError')))
    } finally {
      setRegeneratingDate(null)
    }
  }

  const renderItemEditor = () => {
    if (!editingItem) return null
    const { draft } = editingItem
    const setDraft = (patch: Partial<EditableItem>) => setEditingItem(current => current ? { ...current, draft: { ...current.draft, ...patch } } : current)
    return (
      <div className="space-y-3 border-t border-edge-secondary pt-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2"><span className="mb-1 block text-xs font-medium text-content">{t('dashboard.aiPlaceName')} *</span><input autoFocus maxLength={200} className={inputClass} value={draft.name} onChange={e => setDraft({ name: e.target.value })} /></label>
          <label><span className="mb-1 block text-xs font-medium text-content">{t('dashboard.aiStartTime')}</span><input type="time" className={inputClass} value={draft.startTime ?? ''} onChange={e => setDraft({ startTime: e.target.value || null })} /></label>
          <label><span className="mb-1 block text-xs font-medium text-content">{t('dashboard.aiDuration')}</span><input type="number" min={15} max={720} step={15} className={inputClass} value={draft.durationMinutes} onChange={e => setDraft({ durationMinutes: e.target.value === '' ? '' : Number(e.target.value) })} /></label>
          <label><span className="mb-1 block text-xs font-medium text-content">{t('dashboard.aiEstimatedCost')}</span><input type="number" min={0} step={10} className={inputClass} value={draft.estimatedCost} onChange={e => setDraft({ estimatedCost: e.target.value === '' ? '' : Number(e.target.value) })} /></label>
          <label><span className="mb-1 block text-xs font-medium text-content">{t('dashboard.aiAddress')}</span><input maxLength={500} className={inputClass} value={draft.address ?? ''} onChange={e => setDraft({ address: e.target.value || null })} /></label>
          <label className="sm:col-span-2"><span className="mb-1 block text-xs font-medium text-content">{t('dashboard.aiDescription')}</span><textarea maxLength={2000} className={`${inputClass} min-h-20 resize-y`} value={draft.description} onChange={e => setDraft({ description: e.target.value })} /></label>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setEditingItem(null)} className="inline-flex items-center gap-1.5 rounded-lg border border-edge-secondary px-3 py-1.5 text-xs text-content-secondary hover:bg-surface-muted"><X size={14} />{t('common.cancel')}</button>
          <button type="button" onClick={saveEditedItem} className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-white hover:bg-slate-700"><Check size={14} />{t('common.save')}</button>
        </div>
      </div>
    )
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title={itinerary ? t('dashboard.aiPreviewTitle') : t('dashboard.aiPlanTitle')}
      size="2xl"
      footer={(
        <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          {itinerary ? (
            <button type="button" onClick={() => { setItinerary(null); setEditingItem(null); setError('') }} disabled={saving || Boolean(regeneratingDate)} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-edge-secondary px-4 py-2 text-sm text-content-secondary hover:bg-surface-muted disabled:opacity-50 sm:w-auto">
              <ArrowLeft size={16} />{t('dashboard.aiBackToForm')}
            </button>
          ) : <span className="hidden sm:block" />}
          <div className="flex w-full gap-3 sm:w-auto">
            <button type="button" onClick={close} disabled={loading || saving || Boolean(regeneratingDate)} className="flex-1 rounded-lg border border-edge-secondary px-4 py-2 text-sm text-content-secondary hover:bg-surface-muted disabled:opacity-50 sm:flex-none">{t('common.cancel')}</button>
            {itinerary ? (
              <button type="button" onClick={save} disabled={saving || Boolean(regeneratingDate) || Boolean(editingItem)} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50 sm:flex-none">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                {saving ? t('common.saving') : t('dashboard.aiSave')}
              </button>
            ) : (
              <button type="button" onClick={generate} disabled={loading} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50 sm:flex-none">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                {loading ? t('dashboard.aiGenerating') : t('dashboard.aiGenerate')}
              </button>
            )}
          </div>
        </div>
      )}
    >
      {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</div>}
      {!itinerary ? (
        <div className="space-y-5">
          <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <Sparkles size={20} className="mt-0.5 text-slate-700" />
            <div><p className="text-sm font-medium text-content">{t('dashboard.aiPlanIntro')}</p><p className="mt-1 text-xs text-content-secondary">{t('dashboard.aiPlanHint')}</p></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-medium text-content"><MapPin size={14} className="mr-1 inline" />{t('dashboard.aiDestination')} *</span><input className={inputClass} value={form.destination} onChange={e => setForm({ ...form, destination: e.target.value })} placeholder={t('dashboard.aiDestinationPlaceholder')} /></label>
            <label><span className="mb-1.5 block text-sm font-medium text-content"><CalendarDays size={14} className="mr-1 inline" />{t('dashboard.startDate')} *</span><input type="date" className={inputClass} value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></label>
            <label><span className="mb-1.5 block text-sm font-medium text-content"><CalendarDays size={14} className="mr-1 inline" />{t('dashboard.endDate')} *</span><input type="date" className={inputClass} value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} /></label>
            <label><span className="mb-1.5 block text-sm font-medium text-content"><Users size={14} className="mr-1 inline" />{t('dashboard.aiTravelerCount')} *</span><input type="number" min={1} max={50} step={1} className={inputClass} value={form.travelerCount} onChange={e => setForm({ ...form, travelerCount: e.target.value === '' ? '' : Number(e.target.value) })} /></label>
            <label><span className="mb-1.5 block text-sm font-medium text-content"><WalletCards size={14} className="mr-1 inline" />{t('dashboard.aiBudget')}</span><input type="number" min={0} step={100} className={inputClass} value={form.budget ?? ''} onChange={e => setForm({ ...form, budget: e.target.value ? Number(e.target.value) : undefined })} placeholder={t('dashboard.aiBudgetPlaceholder')} /><span className="mt-1 block text-xs text-content-secondary">{t('dashboard.aiBudgetHint')}</span></label>
            <details className="group sm:col-span-2 rounded-lg border border-edge-secondary">
              <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-sm font-medium text-content marker:content-none">
                {t('dashboard.aiTravelDetails')}
                <ChevronDown size={16} className="text-content-secondary transition-transform group-open:rotate-180" />
              </summary>
              <div className="grid gap-4 border-t border-edge-secondary p-3 sm:grid-cols-2">
                <label><span className="mb-1.5 block text-sm font-medium text-content"><Clock3 size={14} className="mr-1 inline" />{t('dashboard.aiArrivalTime')}</span><input type="time" className={inputClass} value={form.arrivalTime ?? ''} onChange={e => setForm({ ...form, arrivalTime: e.target.value })} /><span className="mt-1 block text-xs text-content-secondary">{t('dashboard.aiArrivalTimeHint')}</span></label>
                <label><span className="mb-1.5 block text-sm font-medium text-content"><Clock3 size={14} className="mr-1 inline" />{t('dashboard.aiDepartureTime')}</span><input type="time" className={inputClass} value={form.departureTime ?? ''} onChange={e => setForm({ ...form, departureTime: e.target.value })} /><span className="mt-1 block text-xs text-content-secondary">{t('dashboard.aiDepartureTimeHint')}</span></label>
                <label><span className="mb-1.5 block text-sm font-medium text-content"><Hotel size={14} className="mr-1 inline" />{t('dashboard.aiBaseLocation')}</span><input maxLength={300} className={inputClass} value={form.baseLocation ?? ''} onChange={e => setForm({ ...form, baseLocation: e.target.value })} placeholder={t('dashboard.aiBaseLocationPlaceholder')} /></label>
                <label><span className="mb-1.5 block text-sm font-medium text-content"><TrainFront size={14} className="mr-1 inline" />{t('dashboard.aiTransport')}</span><select className={inputClass} value={form.transportPreference} onChange={e => setForm({ ...form, transportPreference: e.target.value as AiItineraryInput['transportPreference'] })}><option value="mixed">{t('dashboard.aiTransportMixed')}</option><option value="public_transit">{t('dashboard.aiTransportPublic')}</option><option value="walking">{t('dashboard.aiTransportWalking')}</option><option value="taxi">{t('dashboard.aiTransportTaxi')}</option><option value="self_drive">{t('dashboard.aiTransportDriving')}</option></select></label>
              </div>
            </details>
          </div>
          <fieldset><legend className="mb-2 text-sm font-medium text-content">{t('dashboard.aiInterests')}</legend><div className="flex flex-wrap gap-2">{interestOptions.map(([key, translationKey]) => <button type="button" key={key} onClick={() => toggleInterest(key)} className={`rounded-full border px-3 py-1.5 text-xs transition ${form.interests.includes(key) ? 'border-slate-900 bg-slate-900 text-white' : 'border-edge-secondary text-content-secondary hover:border-slate-400'}`}>{t(translationKey)}</button>)}</div></fieldset>
          <label><span className="mb-1.5 block text-sm font-medium text-content">{t('dashboard.aiPace')}</span><select className={inputClass} value={form.pace} onChange={e => setForm({ ...form, pace: e.target.value as AiItineraryInput['pace'] })}><option value="relaxed">{t('dashboard.aiPaceRelaxed')}</option><option value="balanced">{t('dashboard.aiPaceBalanced')}</option><option value="packed">{t('dashboard.aiPacePacked')}</option></select></label>
          <label><span className="mb-1.5 block text-sm font-medium text-content">{t('dashboard.aiRequirements')}</span><textarea className={`${inputClass} min-h-24 resize-y`} maxLength={1000} value={form.specialRequirements} onChange={e => setForm({ ...form, specialRequirements: e.target.value })} placeholder={t('dashboard.aiRequirementsPlaceholder')} /></label>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="space-y-2">
            <input aria-label={t('dashboard.aiItineraryTitle')} maxLength={200} className={`${inputClass} text-lg font-semibold`} value={itinerary.title ?? ''} onChange={e => setItinerary({ ...itinerary, title: e.target.value })} />
            <textarea aria-label={t('dashboard.aiItinerarySummary')} maxLength={2000} className={`${inputClass} min-h-16 resize-y`} value={itinerary.summary} onChange={e => setItinerary({ ...itinerary, summary: e.target.value })} />
          </div>
          <div className="space-y-4">{itinerary.days.map(day => {
            const isRegenerating = regeneratingDate === day.date
            return <section key={day.date} className="rounded-lg border border-edge-secondary p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><h4 className="font-medium text-content">{day.title}</h4><p className="text-xs text-content-secondary">{day.date} · {day.items.length} {t('dashboard.aiPlaces')}</p></div>
                <button type="button" onClick={() => regenerateDay(day.date)} disabled={Boolean(regeneratingDate) || saving} className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-edge-secondary px-2.5 py-1 text-xs text-content-secondary hover:bg-surface-muted disabled:opacity-50">
                  {isRegenerating ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                  {isRegenerating ? t('dashboard.aiRegeneratingDay') : t('dashboard.aiRegenerateDay')}
                </button>
              </div>
              {day.notes && <p className="mt-2 text-xs text-content-secondary">{day.notes}</p>}
              <div className="mt-3 space-y-2">
                {day.items.length === 0 && !(editingItem?.dayDate === day.date && editingItem.isNew) ? <p className="text-sm text-content-secondary">{t('dashboard.aiNoPlaces')}</p> : day.items.map((item, index) => {
                  const isEditing = editingItem?.dayDate === day.date && editingItem.index === index && !editingItem.isNew
                  return <div key={`${day.date}-${item.name}-${index}`} className="border-t border-edge-secondary pt-3 first:border-t-0 first:pt-0">
                    {isEditing ? renderItemEditor() : <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-600">{index + 1}</div>
                      <div className="min-w-0 flex-1"><p className="text-sm font-medium text-content">{item.name}</p><p className="text-xs text-content-secondary">{[item.startTime, item.durationMinutes ? `${item.durationMinutes} ${t('dashboard.aiMinutes')}` : null, item.estimatedCost != null ? `¥${item.estimatedCost}` : null, item.address].filter(Boolean).join(' · ')}</p>{item.description && <p className="mt-1 text-sm text-content-secondary">{item.description}</p>}</div>
                      <div className="flex shrink-0 items-center">
                        <button type="button" title={t('dashboard.aiMoveUp')} aria-label={`${t('dashboard.aiMoveUp')} ${item.name}`} onClick={() => moveItem(day.date, index, -1)} disabled={index === 0 || Boolean(regeneratingDate)} className={iconButtonClass}><ArrowUp size={15} /></button>
                        <button type="button" title={t('dashboard.aiMoveDown')} aria-label={`${t('dashboard.aiMoveDown')} ${item.name}`} onClick={() => moveItem(day.date, index, 1)} disabled={index === day.items.length - 1 || Boolean(regeneratingDate)} className={iconButtonClass}><ArrowDown size={15} /></button>
                        <button type="button" title={t('dashboard.aiEditPlace')} aria-label={`${t('dashboard.aiEditPlace')} ${item.name}`} onClick={() => startEditItem(day.date, index, item)} disabled={Boolean(regeneratingDate)} className={iconButtonClass}><Pencil size={15} /></button>
                        <button type="button" title={t('dashboard.aiDeletePlace')} aria-label={`${t('dashboard.aiDeletePlace')} ${item.name}`} onClick={() => deleteItem(day.date, index)} disabled={Boolean(regeneratingDate)} className={`${iconButtonClass} hover:bg-red-50 hover:text-red-600`}><Trash2 size={15} /></button>
                      </div>
                    </div>}
                  </div>
                })}
                {editingItem?.dayDate === day.date && editingItem.isNew && renderItemEditor()}
              </div>
              {!editingItem && <button type="button" onClick={() => startAddItem(day.date, day.items.length)} disabled={Boolean(regeneratingDate)} className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-content-secondary hover:text-content disabled:opacity-50"><Plus size={14} />{t('dashboard.aiAddPlace')}</button>}
            </section>
          })}</div>
          {itinerary.notes.length > 0 && <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">{itinerary.notes.map(note => <p key={note}>• {note}</p>)}</div>}
        </div>
      )}
    </Modal>
  )
}
