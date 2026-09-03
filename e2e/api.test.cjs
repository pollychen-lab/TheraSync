// TheraSync deployed-API validation. Exercises every endpoint and every
// documented failure mode against the live Cloud Run service.
const BASE = process.env.BASE_URL;

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; failures.push(name); console.log(`  FAIL  ${name}${detail ? `  -> ${detail}` : ''}`); }
}
const post = (p, body) => fetch(BASE + p, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

(async () => {
  console.log('\n--- health & transport ---');
  {
    const r = await fetch(BASE + '/api/health');
    const j = await r.json();
    check('GET /api/health -> 200 {status:ok}', r.status === 200 && j.status === 'ok', JSON.stringify(j));
  }
  {
    const r = await fetch(BASE + '/');
    check('GET / -> 200 html', r.status === 200 && /text\/html/.test(r.headers.get('content-type')));
    const body = await r.text();
    check('index.html references a hashed JS bundle',
      /\/static\/js\/main\.[a-f0-9]+\.js/.test(body), body.slice(0, 120));
  }
  {
    const r = await fetch(BASE + '/deep/client/route');
    check('SPA deep link -> 200 html (fallback)', r.status === 200 && /text\/html/.test(r.headers.get('content-type')));
  }
  {
    const r = await fetch(BASE + '/api/definitely-not-a-route');
    const j = await r.json().catch(() => null);
    check('unknown /api path -> 404 JSON not HTML', r.status === 404 && j && j.error === 'NOT_FOUND', JSON.stringify(j));
  }

  console.log('\n--- triage ---');
  {
    const r = await post('/api/triage', { rawNarrative: 'general stress' });
    const j = await r.json();
    check('triage with no filters returns all therapists', j.status === 'SUCCESS' && j.matches.length === 2, JSON.stringify(j).slice(0,120));
  }
  {
    const r = await post('/api/triage', { rawNarrative: 'anxiety at work', preferredModality: 'CBT' });
    const j = await r.json();
    check('modality filter CBT -> only Dr. Sarah Chen',
      j.status === 'SUCCESS' && j.matches.length === 1 && j.matches[0].id === 'th_01', JSON.stringify(j.matches?.map(m=>m.id)));
  }
  {
    const r = await post('/api/triage', { rawNarrative: 'relationship issues', preferredModality: 'EFT' });
    const j = await r.json();
    check('modality filter EFT -> only Marcus Vance',
      j.status === 'SUCCESS' && j.matches.length === 1 && j.matches[0].id === 'th_02', JSON.stringify(j.matches?.map(m=>m.id)));
  }
  {
    const r = await post('/api/triage', { rawNarrative: 'stress', focusAreas: ['Burnout'] });
    const j = await r.json();
    check('focus area Burnout -> Dr. Sarah Chen',
      j.status === 'SUCCESS' && j.matches[0].id === 'th_01', JSON.stringify(j.matches?.map(m=>m.id)));
  }
  {
    const r = await post('/api/triage', { rawNarrative: 'stress', focusAreas: ['NoSuchFocusArea'] });
    const j = await r.json();
    check('unmatched focus area falls back to full list rather than empty',
      j.status === 'SUCCESS' && j.matches.length === 2, JSON.stringify(j.matches?.map(m=>m.id)));
  }
  {
    const r = await post('/api/triage', {});
    const j = await r.json();
    check('triage with empty body still responds SUCCESS', j.status === 'SUCCESS', JSON.stringify(j).slice(0,80));
  }

  console.log('\n--- crisis screening (backend is authoritative) ---');
  for (const phrase of ['I am suicidal', 'I want to die', 'thinking about self-harm',
                        'I might hurt myself', 'there is no reason to live', 'I want to end my life']) {
    const r = await post('/api/triage', { rawNarrative: phrase });
    const j = await r.json();
    check(`crisis intercepted: "${phrase}"`,
      j.status === 'CRISIS_INTERCEPTED' && Array.isArray(j.crisisHotlines) && j.crisisHotlines.length === 3);
  }
  {
    const r = await post('/api/triage', { rawNarrative: 'I WANT TO DIE' });
    const j = await r.json();
    check('crisis detection is case-insensitive', j.status === 'CRISIS_INTERCEPTED');
  }
  {
    const r = await post('/api/triage', { rawNarrative: 'my back hurts and I feel tired' });
    const j = await r.json();
    check('benign narrative is NOT flagged as crisis', j.status === 'SUCCESS');
  }

  console.log('\n--- lock validation ---');
  {
    const r = await post('/api/book/lock', { therapistId: 'th_01' });
    const j = await r.json();
    check('lock without slot -> 400 MISSING_FIELDS', r.status === 400 && j.error === 'MISSING_FIELDS');
  }
  {
    const r = await post('/api/book/lock', { therapistId: 'nope', slot: 'Thursday 18:00' });
    const j = await r.json();
    check('lock unknown therapist -> 404 THERAPIST_NOT_FOUND', r.status === 404 && j.error === 'THERAPIST_NOT_FOUND');
  }
  {
    const r = await post('/api/book/lock', { therapistId: 'th_01', slot: 'Monday 09:00' });
    const j = await r.json();
    check('lock a slot the therapist does not offer -> 400 INVALID_SLOT', r.status === 400 && j.error === 'INVALID_SLOT');
  }
  {
    const a = await (await post('/api/book/lock', { therapistId: 'th_01', slot: 'Saturday 10:00' })).json();
    const b = await post('/api/book/lock', { therapistId: 'th_01', slot: 'Saturday 10:00' });
    const bj = await b.json();
    check('double lock on same slot -> 409 SLOT_UNAVAILABLE', b.status === 409 && bj.error === 'SLOT_UNAVAILABLE');
    // release so later tests and the demo find the slot free
    const rel = await post('/api/book/release', { therapistId: 'th_01', slot: 'Saturday 10:00', lockToken: a.lockToken });
    check('release returns success', (await rel.json()).success === true);
    const c = await post('/api/book/lock', { therapistId: 'th_01', slot: 'Saturday 10:00' });
    const cj = await c.json();
    check('slot is lockable again after release', c.status === 200 && cj.success === true);
    await post('/api/book/release', { therapistId: 'th_01', slot: 'Saturday 10:00', lockToken: cj.lockToken });
  }
  {
    const a = await (await post('/api/book/lock', { therapistId: 'th_02', slot: 'Wednesday 19:30' })).json();
    const bad = await post('/api/book/release', { therapistId: 'th_02', slot: 'Wednesday 19:30', lockToken: 'wrong-token' });
    check('release with wrong token responds success but does NOT free the lock', (await bad.json()).success === true);
    const still = await post('/api/book/lock', { therapistId: 'th_02', slot: 'Wednesday 19:30' });
    check('lock still held after forged release attempt', still.status === 409);
    await post('/api/book/release', { therapistId: 'th_02', slot: 'Wednesday 19:30', lockToken: a.lockToken });
  }

  console.log('\n--- commit validation ---');
  {
    const r = await post('/api/book/commit', { therapistId: 'th_01', slot: 'Thursday 18:00', lockToken: 'x' });
    const j = await r.json();
    check('commit without consent -> 400 CONSENT_REQUIRED', r.status === 400 && j.error === 'CONSENT_REQUIRED');
  }
  {
    const r = await post('/api/book/commit', { userConsent: true, therapistId: 'th_01' });
    const j = await r.json();
    check('commit missing slot/token -> 400 MISSING_FIELDS', r.status === 400 && j.error === 'MISSING_FIELDS');
  }
  {
    const r = await post('/api/book/commit', { userConsent: true, therapistId: 'th_01', slot: 'Thursday 18:00', lockToken: 'forged' });
    const j = await r.json();
    check('commit with forged token -> 409 LOCK_REQUIRED', r.status === 409 && j.error === 'LOCK_REQUIRED');
  }
  {
    const lock = await (await post('/api/book/lock', { therapistId: 'th_02', slot: 'Friday 16:00' })).json();
    const r = await post('/api/book/commit', {
      therapistId: 'th_02', slot: 'Friday 16:00', intakeSummary: 'E2E api commit',
      userConsent: true, lockToken: lock.lockToken,
    });
    const j = await r.json();
    check('valid lock+consent commits', j.status === 'SUCCESS' && /^BK_/.test(j.booking.bookingId), JSON.stringify(j).slice(0,120));
    const again = await post('/api/book/commit', {
      therapistId: 'th_02', slot: 'Friday 16:00', userConsent: true, lockToken: lock.lockToken,
    });
    check('replaying the same commit is rejected (lock consumed)', again.status === 409);
    const relock = await post('/api/book/lock', { therapistId: 'th_02', slot: 'Friday 16:00' });
    const rj = await relock.json();
    check('booked slot cannot be locked again', relock.status === 409 && rj.error === 'SLOT_UNAVAILABLE');
  }

  console.log(`\n=== API: ${pass} passed, ${fail} failed ===`);
  if (fail) { console.log('FAILED: ' + failures.join(' | ')); process.exit(1); }
})();
