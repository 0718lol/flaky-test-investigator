import { useMemo, useState } from 'react'
import { ArrowLeft, CalendarDays, Check, Loader2, MapPin, Sparkles, Users, WalletCards } from 'lucide-react'
import Modal from '../shared/Modal'
import { aiItineraryApi, type AiItinerary, type AiItineraryInput } from '../../api/client'
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

const interestOptions = [
  ['food', '美食'], ['culture', '历史文化'], ['nature', '自然风光'], ['shopping', '购物'],
  ['family', '亲子'], ['art', '艺术展览'], ['nightlife', '夜生活'], ['photo', '拍照打卡'], ['outdoor', '户外活动'],
] as const

const initialForm: AiItineraryForm = {
  destination: '',
  startDate: '',
  endDate: '',
  travelerCount: '',
  interests: [],
  pace: 'balanced',
  specialRequirements: '',
}

export default function AiTripPlannerModal({ isOpen, onClose, onCreated }: AiTripPlannerModalProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState<AiItineraryForm>(initialForm)
  const [itinerary, setItinerary] = useState<AiItinerary | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const dateError = useMemo(() => form.startDate && form.endDate && form.endDate < form.startDate, [form.startDate, form.endDate])
  const inputClass = 'w-full rounded-lg border border-edge-secondary bg-surface-card px-3 py-2.5 text-sm text-content outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200'

  const getTravelerCount = () => {
    if (typeof form.travelerCount !== 'number' || !Number.isInteger(form.travelerCount) || form.travelerCount < 1) return null
    return form.travelerCount
  }

  const reset = () => {
    setForm(initialForm)
    setItinerary(null)
    setError('')
    setLoading(false)
    setSaving(false)
  }

  const close = () => { reset(); onClose() }

  const toggleInterest = (label: string) => {
    setForm(prev => ({ ...prev, interests: prev.interests.includes(label) ? prev.interests.filter(x => x !== label) : [...prev.interests, label] }))
  }

  const generate = async () => {
    setError('')
    const travelerCount = getTravelerCount()
    if (!form.destination.trim() || !form.startDate || !form.endDate || !travelerCount) {
      setError(t('dashboard.aiRequired'))
      return
    }
    if (dateError) {
      setError(t('dashboard.aiDateError'))
      return
    }
    setLoading(true)
    try {
      const input: AiItineraryInput = {
        ...form,
        destination: form.destination.trim(),
        travelerCount,
        specialRequirements: form.specialRequirements.trim(),
      }
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
      const travelerCount = getTravelerCount()
      if (!travelerCount) {
        setError(t('dashboard.aiRequired'))
        return
      }
      const input: AiItineraryInput = {
        ...form,
        destination: form.destination.trim(),
        travelerCount,
        specialRequirements: form.specialRequirements.trim(),
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

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title={itinerary ? t('dashboard.aiPreviewTitle') : t('dashboard.aiPlanTitle')}
      size="xl"
      footer={(
        <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          {itinerary ? (
            <button type="button" onClick={() => { setItinerary(null); setError('') }} disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-edge-secondary px-4 py-2 text-sm text-content-secondary hover:bg-surface-muted disabled:opacity-50 sm:w-auto">
              <ArrowLeft size={16} />{t('dashboard.aiBackToForm')}
            </button>
          ) : <span className="hidden sm:block" />}
          <div className="flex w-full gap-3 sm:w-auto">
            <button type="button" onClick={close} disabled={loading || saving} className="flex-1 rounded-lg border border-edge-secondary px-4 py-2 text-sm text-content-secondary hover:bg-surface-muted disabled:opacity-50 sm:flex-none">{t('common.cancel')}</button>
            {itinerary ? (
              <button type="button" onClick={save} disabled={saving} className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50 sm:flex-none">
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
          <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <Sparkles size={20} className="mt-0.5 text-slate-700" />
            <div><p className="text-sm font-medium text-content">{t('dashboard.aiPlanIntro')}</p><p className="mt-1 text-xs text-content-secondary">{t('dashboard.aiPlanHint')}</p></div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-medium text-content"><MapPin size={14} className="mr-1 inline" />{t('dashboard.aiDestination')} *</span><input className={inputClass} value={form.destination} onChange={e => setForm({ ...form, destination: e.target.value })} placeholder={t('dashboard.aiDestinationPlaceholder')} /></label>
            <label><span className="mb-1.5 block text-sm font-medium text-content"><CalendarDays size={14} className="mr-1 inline" />{t('dashboard.startDate')} *</span><input type="date" className={inputClass} value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></label>
            <label><span className="mb-1.5 block text-sm font-medium text-content"><CalendarDays size={14} className="mr-1 inline" />{t('dashboard.endDate')} *</span><input type="date" className={inputClass} value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} /></label>
            <label><span className="mb-1.5 block text-sm font-medium text-content"><Users size={14} className="mr-1 inline" />{t('dashboard.aiTravelerCount')} *</span><input type="number" min={1} max={50} step={1} className={inputClass} value={form.travelerCount} onChange={e => setForm({ ...form, travelerCount: e.target.value === '' ? '' : Number(e.target.value) })} /></label>
            <label><span className="mb-1.5 block text-sm font-medium text-content"><WalletCards size={14} className="mr-1 inline" />{t('dashboard.aiBudget')}</span><input type="number" min={0} step={100} className={inputClass} value={form.budget ?? ''} onChange={e => setForm({ ...form, budget: e.target.value ? Number(e.target.value) : undefined })} placeholder={t('dashboard.aiBudgetPlaceholder')} /></label>
          </div>
          <fieldset><legend className="mb-2 text-sm font-medium text-content">{t('dashboard.aiInterests')}</legend><div className="flex flex-wrap gap-2">{interestOptions.map(([key, label]) => <button type="button" key={key} onClick={() => toggleInterest(label)} className={`rounded-full border px-3 py-1.5 text-xs transition ${form.interests.includes(label) ? 'border-slate-900 bg-slate-900 text-white' : 'border-edge-secondary text-content-secondary hover:border-slate-400'}`}>{label}</button>)}</div></fieldset>
          <label><span className="mb-1.5 block text-sm font-medium text-content">{t('dashboard.aiPace')}</span><select className={inputClass} value={form.pace} onChange={e => setForm({ ...form, pace: e.target.value as AiItineraryInput['pace'] })}><option value="relaxed">{t('dashboard.aiPaceRelaxed')}</option><option value="balanced">{t('dashboard.aiPaceBalanced')}</option><option value="packed">{t('dashboard.aiPacePacked')}</option></select></label>
          <label><span className="mb-1.5 block text-sm font-medium text-content">{t('dashboard.aiRequirements')}</span><textarea className={`${inputClass} min-h-24 resize-y`} maxLength={1000} value={form.specialRequirements} onChange={e => setForm({ ...form, specialRequirements: e.target.value })} placeholder={t('dashboard.aiRequirementsPlaceholder')} /></label>
        </div>
      ) : (
        <div className="space-y-5">
          <div><h3 className="text-xl font-semibold text-content">{itinerary.title}</h3>{itinerary.summary && <p className="mt-1 text-sm text-content-secondary">{itinerary.summary}</p>}</div>
          <div className="space-y-4">{itinerary.days.map(day => <section key={day.date} className="rounded-xl border border-edge-secondary p-4"><div className="flex items-baseline justify-between gap-3"><div><h4 className="font-medium text-content">{day.title}</h4><p className="text-xs text-content-secondary">{day.date}</p></div><span className="text-xs text-content-secondary">{day.items.length} {t('dashboard.aiPlaces')}</span></div>{day.notes && <p className="mt-2 text-xs text-content-secondary">{day.notes}</p>}<div className="mt-3 space-y-2">{day.items.length === 0 ? <p className="text-sm text-content-secondary">{t('dashboard.aiNoPlaces')}</p> : day.items.map((item, index) => <div key={`${day.date}-${item.name}-${index}`} className="flex gap-3 border-t border-edge-secondary pt-2 first:border-t-0 first:pt-0"><div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs text-slate-600">{index + 1}</div><div className="min-w-0"><p className="text-sm font-medium text-content">{item.name}</p><p className="text-xs text-content-secondary">{[item.startTime, item.durationMinutes ? `${item.durationMinutes} min` : null, item.address].filter(Boolean).join(' · ')}</p>{item.description && <p className="mt-1 text-sm text-content-secondary">{item.description}</p>}</div></div>)}</div></section>)}</div>
          {itinerary.notes.length > 0 && <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">{itinerary.notes.map(note => <p key={note}>• {note}</p>)}</div>}
        </div>
      )}
    </Modal>
  )
}
