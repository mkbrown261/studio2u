// Studio2U booking flow — vanilla JS, no framework needed for this scope.
;(function () {
  const root = document.getElementById('booking-app')
  let step = 1
  const state = {
    sessionDate: '',
    sessionTime: '',
    durationHours: 3,
    locationType: 'apartment',
    locationAddress: '',
    specialNotes: '',
    songCount: '',
    genre: '',
    customerName: '',
    customerEmail: '',
    customerPhone: ''
  }

  function el(html) {
    const div = document.createElement('div')
    div.innerHTML = html.trim()
    return div.firstChild
  }

  function fieldWrap(label, inputHtml, hint) {
    return `
      <div class="mb-5">
        <label class="block text-sm font-medium text-muted mb-2">${label}</label>
        ${inputHtml}
        ${hint ? `<p class="text-xs text-muted mt-1.5">${hint}</p>` : ''}
      </div>
    `
  }

  const inputClass =
    'w-full bg-ink border border-gold/20 rounded-lg px-4 py-3 text-cream focus:outline-none focus:border-gold'

  function renderStep1() {
    root.innerHTML = `
      <div class="flex items-center gap-2 mb-6 text-xs text-muted">
        <span class="text-gold font-semibold">Step 1 of 3</span> · Session Details
      </div>
      <div class="grid sm:grid-cols-2 gap-4">
        ${fieldWrap(
          'Date',
          `<input type="date" id="f-date" class="${inputClass}" value="${state.sessionDate}" min="${new Date().toISOString().split('T')[0]}" required />`
        )}
        ${fieldWrap(
          'Time',
          `<input type="time" id="f-time" class="${inputClass}" value="${state.sessionTime}" required />`
        )}
      </div>
      <div id="availability-note" class="hidden mb-5 text-sm bg-gold/10 border border-gold/30 rounded-lg px-4 py-3 text-gold">
        <i class="fa-solid fa-triangle-exclamation mr-2"></i>
        This time is outside our standard Mon–Fri, 11am–11pm window. You can still submit it as a <strong>special request</strong> — we'll confirm availability directly.
      </div>
      ${fieldWrap(
        'Session Length (hours)',
        `<select id="f-duration" class="${inputClass}">
          <option value="1">1 hour</option>
          <option value="2">2 hours</option>
          <option value="3" selected>3 hours</option>
          <option value="4">4 hours</option>
          <option value="5">5 hours</option>
          <option value="6">6 hours</option>
        </select>`
      )}
      <div class="grid sm:grid-cols-2 gap-4">
        ${fieldWrap(
          'Location Type',
          `<select id="f-location-type" class="${inputClass}">
            <option value="apartment">Apartment</option>
            <option value="house">House</option>
            <option value="hotel">Hotel</option>
            <option value="studio">Studio</option>
            <option value="other">Other</option>
          </select>`
        )}
        ${fieldWrap(
          'Genre',
          `<input type="text" id="f-genre" class="${inputClass}" placeholder="e.g. Hip Hop, R&B, Pop" value="${state.genre}" />`
        )}
      </div>
      ${fieldWrap(
        'Address / Location Details',
        `<input type="text" id="f-address" class="${inputClass}" placeholder="Street address or general area" value="${state.locationAddress}" />`
      )}
      ${fieldWrap(
        'Number of Songs',
        `<input type="number" id="f-songcount" min="1" class="${inputClass}" placeholder="e.g. 2" value="${state.songCount}" />`
      )}
      ${fieldWrap(
        'Special Notes',
        `<textarea id="f-notes" rows="3" class="${inputClass}" placeholder="Anything we should know?">${state.specialNotes}</textarea>`
      )}
      <button id="next-1" class="w-full bg-gold hover:bg-gold-light text-ink font-semibold py-3.5 rounded-full transition mt-2">
        Continue <i class="fa-solid fa-arrow-right ml-1"></i>
      </button>
    `

    const dateInput = document.getElementById('f-date')
    const timeInput = document.getElementById('f-time')
    const note = document.getElementById('availability-note')

    function checkAvailability() {
      const date = dateInput.value
      const time = timeInput.value
      if (!date || !time) {
        note.classList.add('hidden')
        return
      }
      fetch(`/api/availability-check?date=${date}&time=${time}`)
        .then((r) => r.json())
        .then((data) => {
          note.classList.toggle('hidden', data.withinStandardHours)
        })
        .catch(() => {})
    }

    dateInput.addEventListener('change', checkAvailability)
    timeInput.addEventListener('change', checkAvailability)

    document.getElementById('next-1').addEventListener('click', () => {
      state.sessionDate = dateInput.value
      state.sessionTime = timeInput.value
      state.durationHours = parseFloat(document.getElementById('f-duration').value)
      state.locationType = document.getElementById('f-location-type').value
      state.locationAddress = document.getElementById('f-address').value
      state.genre = document.getElementById('f-genre').value
      state.songCount = document.getElementById('f-songcount').value
      state.specialNotes = document.getElementById('f-notes').value

      if (!state.sessionDate || !state.sessionTime) {
        alert('Please select a date and time.')
        return
      }
      step = 2
      renderStep2()
    })
  }

  function renderStep2() {
    root.innerHTML = `
      <div class="flex items-center gap-2 mb-6 text-xs text-muted">
        <span class="text-gold font-semibold">Step 2 of 3</span> · Your Info
      </div>
      ${fieldWrap('Full Name', `<input type="text" id="f-name" class="${inputClass}" value="${state.customerName}" required />`)}
      ${fieldWrap(
        'Email',
        `<input type="email" id="f-email" class="${inputClass}" value="${state.customerEmail}" required />`,
        'We use this to check if this is your first session (special pricing!) or a returning booking.'
      )}
      ${fieldWrap('Phone Number', `<input type="tel" id="f-phone" class="${inputClass}" value="${state.customerPhone}" required />`)}
      <div class="flex gap-3">
        <button id="back-2" class="flex-1 border border-gold/30 hover:bg-gold/10 text-cream font-semibold py-3.5 rounded-full transition">
          <i class="fa-solid fa-arrow-left mr-1"></i> Back
        </button>
        <button id="next-2" class="flex-1 bg-gold hover:bg-gold-light text-ink font-semibold py-3.5 rounded-full transition">
          Review <i class="fa-solid fa-arrow-right ml-1"></i>
        </button>
      </div>
    `

    document.getElementById('back-2').addEventListener('click', () => {
      step = 1
      renderStep1()
    })

    document.getElementById('next-2').addEventListener('click', () => {
      state.customerName = document.getElementById('f-name').value.trim()
      state.customerEmail = document.getElementById('f-email').value.trim()
      state.customerPhone = document.getElementById('f-phone').value.trim()

      if (!state.customerName || !state.customerEmail || !state.customerPhone) {
        alert('Please fill out all fields.')
        return
      }
      step = 3
      renderStep3()
    })
  }

  function renderStep3() {
    root.innerHTML = `
      <div class="flex items-center gap-2 mb-6 text-xs text-muted">
        <span class="text-gold font-semibold">Step 3 of 3</span> · Review & Confirm
      </div>
      <div class="bg-ink/50 rounded-xl p-5 space-y-2 text-sm mb-6">
        <div class="flex justify-between"><span class="text-muted">Date & Time</span><span>${state.sessionDate} @ ${state.sessionTime}</span></div>
        <div class="flex justify-between"><span class="text-muted">Duration</span><span>${state.durationHours} hours</span></div>
        <div class="flex justify-between"><span class="text-muted">Location</span><span class="capitalize">${state.locationType}</span></div>
        <div class="flex justify-between"><span class="text-muted">Name</span><span>${state.customerName}</span></div>
        <div class="flex justify-between"><span class="text-muted">Email</span><span>${state.customerEmail}</span></div>
        <div class="flex justify-between"><span class="text-muted">Phone</span><span>${state.customerPhone}</span></div>
      </div>
      <div id="price-box" class="bg-gold/10 border border-gold/30 rounded-xl p-5 mb-6 text-center">
        <div class="text-muted text-xs uppercase tracking-wide mb-1">Estimated Price</div>
        <div id="price-amount" class="text-3xl font-display font-bold text-gold">Calculating...</div>
        <div id="price-breakdown" class="text-xs text-muted mt-1"></div>
      </div>
      <div id="submit-error" class="hidden text-sm text-wine-light bg-wine/20 border border-wine/40 rounded-lg px-4 py-3 mb-4"></div>
      <div class="flex gap-3">
        <button id="back-3" class="flex-1 border border-gold/30 hover:bg-gold/10 text-cream font-semibold py-3.5 rounded-full transition">
          <i class="fa-solid fa-arrow-left mr-1"></i> Back
        </button>
        <button id="submit-booking" class="flex-1 bg-gold hover:bg-gold-light text-ink font-semibold py-3.5 rounded-full transition">
          Confirm Booking
        </button>
      </div>
    `

    fetch(`/api/price-check?email=${encodeURIComponent(state.customerEmail)}&duration=${state.durationHours}`)
      .then((r) => r.json())
      .then((data) => {
        document.getElementById('price-amount').textContent = `$${data.amount}`
        document.getElementById('price-breakdown').textContent = data.breakdown
      })
      .catch(() => {
        document.getElementById('price-amount').textContent = 'Error'
      })

    document.getElementById('back-3').addEventListener('click', () => {
      step = 2
      renderStep2()
    })

    document.getElementById('submit-booking').addEventListener('click', async (e) => {
      const btn = e.currentTarget
      btn.disabled = true
      btn.textContent = 'Booking...'
      const errBox = document.getElementById('submit-error')
      errBox.classList.add('hidden')

      try {
        const res = await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(state)
        })
        const data = await res.json()
        if (!res.ok) {
          throw new Error(data.error || 'Something went wrong.')
        }
        window.location.href = `/book/confirmation/${data.bookingId}`
      } catch (err) {
        errBox.textContent = err.message
        errBox.classList.remove('hidden')
        btn.disabled = false
        btn.textContent = 'Confirm Booking'
      }
    })
  }

  renderStep1()
})()
