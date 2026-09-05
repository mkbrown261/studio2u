// Studio2U booking flow — vanilla JS, no framework needed for this scope.
;(function () {
  const root = document.getElementById('booking-app')
  const engineerId = root.getAttribute('data-engineer-id')
  let step = 1
  const state = {
    engineerId: engineerId,
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
    customerPhone: '',
    recordingConsentAccepted: false,
    applyCreditCents: 0
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

  function formatHour(h) {
    var period = h >= 12 ? 'PM' : 'AM'
    var display = h % 12
    if (display === 0) display = 12
    return display + ' ' + period
  }

  // Given the engineer's open hours for a date, return which START hours have
  // enough CONSECUTIVE open hours to fit the full session duration.
  function computeValidStarts(openHours, durationHours) {
    var openSet = {}
    openHours.forEach(function (h) { openSet[h] = true })
    var span = Math.max(1, Math.ceil(durationHours))
    var valid = []
    openHours.forEach(function (h) {
      var fits = true
      for (var i = 0; i < span; i++) {
        if (!openSet[h + i]) { fits = false; break }
      }
      if (fits) valid.push(h)
    })
    return valid
  }

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
      </div>
      <div class="mb-5">
        <label class="block text-sm font-medium text-muted mb-2">Available Start Times</label>
        <div id="slot-grid" class="grid grid-cols-3 sm:grid-cols-4 gap-2">
          <p class="col-span-full text-sm text-muted">Pick a date to see open times.</p>
        </div>
        <input type="hidden" id="f-time" value="${state.sessionTime}" />
      </div>
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
    const durationSelect = document.getElementById('f-duration')
    const timeInput = document.getElementById('f-time')
    const slotGrid = document.getElementById('slot-grid')
    if (state.durationHours) durationSelect.value = String(state.durationHours)

    function renderSlots(validStarts) {
      if (!dateInput.value) {
        slotGrid.innerHTML = '<p class="col-span-full text-sm text-muted">Pick a date to see open times.</p>'
        return
      }
      if (validStarts.length === 0) {
        slotGrid.innerHTML = '<p class="col-span-full text-sm text-muted">No open times for this date at this duration. Try a shorter session or a different date.</p>'
        timeInput.value = ''
        return
      }
      slotGrid.innerHTML = validStarts
        .map(function (h) {
          const selected = String(h) === String(timeInput.value).split(':')[0] ? '1' : ''
          return `<button type="button" data-hour="${h}" class="slot-btn text-xs sm:text-sm py-2.5 rounded-lg border transition ${
            selected ? 'bg-gold text-ink border-gold font-semibold' : 'border-gold/20 text-cream hover:border-gold/50'
          }">${formatHour(h)}</button>`
        })
        .join('')
      slotGrid.querySelectorAll('.slot-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const h = btn.getAttribute('data-hour')
          timeInput.value = (h.length === 1 ? '0' + h : h) + ':00'
          slotGrid.querySelectorAll('.slot-btn').forEach(function (b) {
            b.classList.remove('bg-gold', 'text-ink', 'border-gold', 'font-semibold')
            b.classList.add('border-gold/20', 'text-cream')
          })
          btn.classList.add('bg-gold', 'text-ink', 'border-gold', 'font-semibold')
          btn.classList.remove('border-gold/20', 'text-cream')
        })
      })
    }

    function loadSlots() {
      const date = dateInput.value
      const duration = parseFloat(durationSelect.value)
      timeInput.value = ''
      if (!date) {
        renderSlots([])
        return
      }
      slotGrid.innerHTML = '<p class="col-span-full text-sm text-muted"><i class="fa-solid fa-spinner fa-spin mr-1"></i> Checking availability...</p>'
      fetch(`/api/available-slots?engineerId=${encodeURIComponent(engineerId)}&date=${date}`)
        .then((r) => r.json())
        .then((data) => {
          const validStarts = computeValidStarts(data.hours || [], duration)
          renderSlots(validStarts)
        })
        .catch(() => {
          slotGrid.innerHTML = '<p class="col-span-full text-sm text-wine-light">Could not load availability. Please try again.</p>'
        })
    }

    dateInput.addEventListener('change', loadSlots)
    durationSelect.addEventListener('change', loadSlots)
    if (dateInput.value) loadSlots()

    document.getElementById('next-1').addEventListener('click', () => {
      state.sessionDate = dateInput.value
      state.sessionTime = timeInput.value
      state.durationHours = parseFloat(durationSelect.value)
      state.locationType = document.getElementById('f-location-type').value
      state.locationAddress = document.getElementById('f-address').value
      state.genre = document.getElementById('f-genre').value
      state.songCount = document.getElementById('f-songcount').value
      state.specialNotes = document.getElementById('f-notes').value

      if (!state.sessionDate || !state.sessionTime) {
        alert('Please select a date and an available start time.')
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
      <div id="price-box" class="bg-gold/10 border border-gold/30 rounded-xl p-5 mb-4 text-center">
        <div class="text-muted text-xs uppercase tracking-wide mb-1">Estimated Price</div>
        <div id="price-amount" class="text-3xl font-display font-bold text-gold">Calculating...</div>
        <div id="price-breakdown" class="text-xs text-muted mt-1"></div>
        <div id="price-after-credit" class="text-sm text-emerald-400 mt-2 hidden"></div>
      </div>
      <div id="credit-box" class="hidden bg-ink/50 border border-gold/20 rounded-xl p-4 mb-6">
        <label class="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" id="use-credit-checkbox" class="accent-gold mt-0.5 w-4 h-4 flex-shrink-0" />
          <span class="text-sm text-cream">
            Use my account credit — <span id="credit-available-text" class="text-gold font-semibold"></span> available
          </span>
        </label>
      </div>
      <label id="consent-label" class="flex items-start gap-3 bg-ink/50 border border-gold/20 rounded-xl p-4 mb-6 cursor-pointer hover:border-gold/40 transition">
        <input type="checkbox" id="recording-consent-checkbox" class="accent-gold mt-0.5 w-4 h-4 flex-shrink-0" ${state.recordingConsentAccepted ? 'checked' : ''} />
        <span class="text-sm text-muted leading-relaxed">
          I confirm that I have obtained all legally required recording consent and agree to the
          <a href="/consent" target="_blank" class="text-gold hover:underline">Studio2U Recording Consent &amp; User Responsibility Agreement</a>.
        </span>
      </label>
      <div id="submit-error" class="hidden text-sm text-wine-light bg-wine/20 border border-wine/40 rounded-lg px-4 py-3 mb-4"></div>
      <div class="flex gap-3">
        <button id="back-3" class="flex-1 border border-gold/30 hover:bg-gold/10 text-cream font-semibold py-3.5 rounded-full transition">
          <i class="fa-solid fa-arrow-left mr-1"></i> Back
        </button>
        <button id="submit-booking" class="flex-1 bg-gold hover:bg-gold-light text-ink font-semibold py-3.5 rounded-full transition disabled:opacity-40 disabled:cursor-not-allowed" ${state.recordingConsentAccepted ? '' : 'disabled'}>
          Confirm Booking
        </button>
      </div>
    `

    var priceAmountDollars = 0
    var maxCreditApplicableCents = 0

    function updateCreditDisplay() {
      var afterCreditEl = document.getElementById('price-after-credit')
      var checkbox = document.getElementById('use-credit-checkbox')
      if (checkbox && checkbox.checked && maxCreditApplicableCents > 0) {
        state.applyCreditCents = maxCreditApplicableCents
        var finalAmount = Math.max(0, priceAmountDollars - maxCreditApplicableCents / 100)
        afterCreditEl.textContent = '-$' + (maxCreditApplicableCents / 100).toFixed(2) + ' credit applied → $' + finalAmount.toFixed(2) + ' due'
        afterCreditEl.classList.remove('hidden')
      } else {
        state.applyCreditCents = 0
        afterCreditEl.classList.add('hidden')
      }
    }

    fetch(`/api/price-check?engineerId=${encodeURIComponent(state.engineerId)}&email=${encodeURIComponent(state.customerEmail)}&duration=${state.durationHours}`)
      .then((r) => r.json())
      .then((data) => {
        document.getElementById('price-amount').textContent = `$${data.amount}`
        document.getElementById('price-breakdown').textContent = data.breakdown
        priceAmountDollars = data.amount

        maxCreditApplicableCents = data.maxCreditApplicableCents || 0
        if (maxCreditApplicableCents > 0) {
          document.getElementById('credit-available-text').textContent = '$' + (maxCreditApplicableCents / 100).toFixed(2)
          document.getElementById('credit-box').classList.remove('hidden')
          document.getElementById('use-credit-checkbox').addEventListener('change', updateCreditDisplay)
        }
      })
      .catch(() => {
        document.getElementById('price-amount').textContent = 'Error'
      })

    document.getElementById('back-3').addEventListener('click', () => {
      step = 2
      renderStep2()
    })

    // "Confirm Booking" stays disabled until the Recording Consent checkbox is
    // checked — a mandatory click-through, not a PDF someone can ignore.
    document.getElementById('recording-consent-checkbox').addEventListener('change', (e) => {
      state.recordingConsentAccepted = e.currentTarget.checked
      document.getElementById('submit-booking').disabled = !state.recordingConsentAccepted
    })

    document.getElementById('submit-booking').addEventListener('click', async (e) => {
      if (!state.recordingConsentAccepted) return
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
        // Send the customer straight into Stripe's hosted Checkout page — payment
        // happens there, then Stripe redirects back to our confirmation page.
        window.location.href = data.checkoutUrl
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
