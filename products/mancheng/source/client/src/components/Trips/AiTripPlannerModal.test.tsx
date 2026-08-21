import { describe, expect, it, vi } from 'vitest'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { render, screen, waitFor } from '../../../tests/helpers/render'
import { server } from '../../../tests/helpers/msw/server'
import AiTripPlannerModal from './AiTripPlannerModal'
import type { AiItinerary } from '../../api/client'

const itinerary: AiItinerary = {
  title: 'Hangzhou getaway',
  summary: 'A balanced two-day trip.',
  notes: ['Confirm opening hours.'],
  days: [
    {
      date: '2026-10-01',
      title: 'West Lake',
      notes: 'Wear comfortable shoes.',
      items: [
        { name: 'Museum', description: 'Local history.', address: '1 Museum Rd', startTime: '09:00', durationMinutes: 90 },
        { name: 'Temple', description: 'Historic temple.', address: '2 Temple Rd', startTime: '11:00', durationMinutes: 120 },
      ],
    },
    {
      date: '2026-10-02',
      title: 'Old town',
      notes: '',
      items: [{ name: 'Old Street', description: 'Walk the old quarter.', durationMinutes: 90 }],
    },
  ],
}

async function generatePreview(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Destination/), 'Hangzhou')
  await user.type(screen.getByLabelText(/Start Date/), '2026-10-01')
  await user.type(screen.getByLabelText(/End Date/), '2026-10-02')
  await user.type(screen.getByLabelText(/Travelers/), '3')
  await user.click(screen.getByText('Arrival, stay and transport (optional)'))
  await user.type(screen.getByLabelText(/Arrival time/), '11:30')
  await user.type(screen.getByLabelText(/Departure time/), '18:00')
  await user.type(screen.getByLabelText(/Accommodation/), 'West Lake Hotel')
  await user.selectOptions(screen.getByLabelText(/Main transport/), 'public_transit')
  await user.click(screen.getByRole('button', { name: 'Food' }))
  await user.click(screen.getByRole('button', { name: 'Generate itinerary' }))
  await screen.findByDisplayValue('Hangzhou getaway')
}

describe('AiTripPlannerModal', () => {
  it('edits, reorders, deletes and adds places before saving', async () => {
    const user = userEvent.setup()
    const onCreated = vi.fn()
    let savedBody: unknown
    server.use(
      http.post('/api/ai/itinerary/generate', () => HttpResponse.json({ itinerary })),
      http.post('/api/ai/itinerary/create', async ({ request }) => {
        savedBody = await request.json()
        return HttpResponse.json({ trip: { id: 42, title: 'Hangzhou getaway' }, days: [] }, { status: 201 })
      }),
    )

    render(<AiTripPlannerModal isOpen onClose={vi.fn()} onCreated={onCreated} />)
    expect(screen.getByText('Excludes travel to the destination and accommodation')).toBeInTheDocument()
    await generatePreview(user)

    await user.click(screen.getByRole('button', { name: 'Move down Museum' }))
    expect(screen.getAllByText(/^(Museum|Temple)$/).map(node => node.textContent)).toEqual(['Temple', 'Museum'])

    await user.click(screen.getByRole('button', { name: 'Edit place Museum' }))
    const placeName = screen.getByLabelText(/Place name/)
    await user.clear(placeName)
    await user.type(placeName, 'Art Museum')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('Art Museum')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Delete place Temple' }))
    expect(screen.queryByText('Temple')).not.toBeInTheDocument()

    await user.click(screen.getAllByRole('button', { name: 'Add place' })[0])
    await user.type(screen.getByLabelText(/Place name/), 'City Park')
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(screen.getByText('City Park')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save to Mancheng' }))
    await waitFor(() => expect(onCreated).toHaveBeenCalled())
    const saved = savedBody as { itinerary: AiItinerary }
    expect(savedBody).toMatchObject({
      input: {
        arrivalTime: '11:30',
        departureTime: '18:00',
        baseLocation: 'West Lake Hotel',
        transportPreference: 'public_transit',
        interests: ['food'],
      },
    })
    expect(saved.itinerary.days[0].items.map(item => item.name)).toEqual(['Art Museum', 'City Park'])
    expect(saved.itinerary.days[0].items[0].lat).toBeNull()
    expect(saved.itinerary.days[0].items[0].lng).toBeNull()
  })

  it('replaces only the selected day after confirmation', async () => {
    const user = userEvent.setup()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    let regenerateBody: unknown
    server.use(
      http.post('/api/ai/itinerary/generate', () => HttpResponse.json({ itinerary })),
      http.post('/api/ai/itinerary/regenerate-day', async ({ request }) => {
        regenerateBody = await request.json()
        return HttpResponse.json({
          day: {
            date: '2026-10-01',
            title: 'Tea country',
            notes: 'A slower day.',
            items: [{ name: 'Tea Museum', description: 'Learn about local tea.', durationMinutes: 120 }],
          },
        })
      }),
    )

    render(<AiTripPlannerModal isOpen onClose={vi.fn()} onCreated={vi.fn()} />)
    await generatePreview(user)
    await user.click(screen.getAllByRole('button', { name: 'Regenerate this day' })[0])

    await screen.findByText('Tea Museum')
    expect(screen.queryByText('Museum')).not.toBeInTheDocument()
    expect(screen.getByText('Old Street')).toBeInTheDocument()
    expect(regenerateBody).toMatchObject({ targetDate: '2026-10-01' })
    expect(confirm).toHaveBeenCalledWith('Regenerating will replace the current plan for this day. Continue?')
    confirm.mockRestore()
  })
})
