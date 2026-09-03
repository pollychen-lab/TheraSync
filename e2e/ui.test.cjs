// TheraSync deployed-UI validation: the WebMCP tool layer, the human booking
// path, and the human-in-the-loop approval guard, driven in a real browser.
const { chromium } = require('playwright');
const BASE = process.env.BASE_URL;
const MARK = 'E2E-MARKER';

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; failures.push(name); console.log(`  FAIL  ${name}${detail !== undefined ? `  -> ${detail}` : ''}`); }
}

const api = (p, body) => fetch(BASE + p, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

(async () => {
  const browser = await chromium.launch();
  const newPage = async (initScript) => {
    const ctx = await browser.newContext();
    if (initScript) await ctx.addInitScript(initScript);
    const page = await ctx.newPage();
    return { ctx, page };
  };
  const gotoApp = async (page) => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => Array.isArray(window.__WEBMCP_TOOLS__), null, { timeout: 20000 });
  };

  try {
    // ---------------------------------------------------------------- shell
    console.log('\n--- page shell ---');
    {
      const { ctx, page } = await newPage();
      const logs = [];
      page.on('console', (m) => logs.push(m.text()));
      await gotoApp(page);
      check('page title is "TheraSync Co-Pilot"', (await page.title()) === 'TheraSync Co-Pilot', await page.title());
      check('"WebMCP Connected" status pill is visible',
        await page.locator('.thera-status-pill', { hasText: 'WebMCP Connected' }).isVisible());
      check('empty state prompts for intake',
        (await page.locator('.thera-empty-panel').count()) === 2);
      check('console logs "[WebMCP] Tools registered"',
        logs.some((l) => l.includes('[WebMCP] Tools registered')), JSON.stringify(logs).slice(0, 200));
      await ctx.close();
    }

    // ------------------------------------------------- tool registration
    console.log('\n--- WebMCP tool registration ---');
    {
      const { ctx, page } = await newPage();
      await gotoApp(page);
      const tools = await page.evaluate(() =>
        window.__WEBMCP_TOOLS__.map((t) => ({
          name: t.name, hasHandler: typeof t.handler === 'function',
          description: t.description, schema: t.input_schema,
        })));
      check('exactly 2 tools on window.__WEBMCP_TOOLS__', tools.length === 2, JSON.stringify(tools.map(t=>t.name)));
      check('tool 1 is triage_and_match_therapists', tools[0]?.name === 'triage_and_match_therapists');
      check('tool 2 is commit_intake_booking', tools[1]?.name === 'commit_intake_booking');
      check('both tools expose a callable handler', tools.every((t) => t.hasHandler));
      check('triage schema requires raw_narrative',
        JSON.stringify(tools[0]?.schema?.required) === JSON.stringify(['raw_narrative']), JSON.stringify(tools[0]?.schema?.required));
      check('triage schema declares focus_areas + preferred_modality',
        !!tools[0]?.schema?.properties?.focus_areas && !!tools[0]?.schema?.properties?.preferred_modality);
      check('booking schema requires therapist_id + selected_slot',
        JSON.stringify(tools[1]?.schema?.required) === JSON.stringify(['therapist_id', 'selected_slot']), JSON.stringify(tools[1]?.schema?.required));
      check('booking tool description flags human confirmation',
        /confirmed by a human/i.test(tools[1]?.description || ''), tools[1]?.description);
      await ctx.close();
    }

    // ------------------------- navigator.modelContext progressive enhancement
    console.log('\n--- navigator.modelContext registration paths ---');
    for (const [label, stub] of [
      ['registerTools', () => {
        window.__captured = null;
        navigator.modelContext = { registerTools: (t) => { window.__captured = t; } };
      }],
      ['provideContext', () => {
        window.__captured = null;
        navigator.modelContext = { provideContext: (c) => { window.__captured = c.tools; } };
      }],
      ['registerTool', () => {
        window.__captured = [];
        navigator.modelContext = { registerTool: (t) => { window.__captured.push(t); } };
      }],
    ]) {
      const { ctx, page } = await newPage(stub);
      await gotoApp(page);
      const captured = await page.evaluate(() =>
        (window.__captured || []).map((t) => ({
          name: t.name,
          hasInputSchema: !!t.inputSchema,
          hasExecute: typeof t.execute === 'function',
          leakedSnakeCase: 'input_schema' in t || 'handler' in t,
        })));
      check(`modelContext.${label} receives both tools`, captured.length === 2, JSON.stringify(captured));
      check(`modelContext.${label} gets browser-API shape (inputSchema + execute)`,
        captured.length === 2 && captured.every((t) => t.hasInputSchema && t.hasExecute), JSON.stringify(captured));
      check(`modelContext.${label} does not leak the internal shape`,
        captured.length === 2 && captured.every((t) => !t.leakedSnakeCase));

      // The tool handlers are rebuilt whenever the match list changes. The host
      // must not end up holding a second copy of every tool each time that
      // happens, and the copy it already holds must still reach live state.
      await page.evaluate(() => window.__WEBMCP_TOOLS__[0].handler({ raw_narrative: 'work anxiety' }));
      await page.waitForSelector('.thera-therapist-card');
      await page.evaluate(() => window.__WEBMCP_TOOLS__[0].handler({ raw_narrative: 'relationship strain' }));
      await page.waitForTimeout(500);
      const afterRerender = await page.evaluate(() => (window.__captured || []).length);
      check(`modelContext.${label} does not re-register on state change`, afterRerender === 2, `held ${afterRerender} tools`);
      const viaHost = await page.evaluate(() =>
        window.__captured[0].execute({ raw_narrative: 'work anxiety', preferred_modality: 'CBT' }));
      check(`modelContext.${label} descriptor still executes against live state`,
        viaHost && viaHost.status === 'SUCCESS' && viaHost.matched_count === 1, JSON.stringify(viaHost).slice(0, 80));
      await ctx.close();
    }

    // ------------------------------------------------------ triage via tool
    console.log('\n--- triage_and_match_therapists ---');
    {
      const { ctx, page } = await newPage();
      await gotoApp(page);
      const res = await page.evaluate(() =>
        window.__WEBMCP_TOOLS__[0].handler({ raw_narrative: 'work stress and poor sleep', preferred_modality: 'CBT' }));
      check('tool returns SUCCESS', res.status === 'SUCCESS', JSON.stringify(res));
      check('tool returns matched_count', res.matched_count === 1, JSON.stringify(res));
      check('tool returns therapist id/name/slots', res.therapists?.[0]?.id === 'th_01' && !!res.therapists?.[0]?.slots, JSON.stringify(res.therapists));
      await page.waitForSelector('.thera-therapist-card');
      check('UI renders the matched therapist card',
        (await page.locator('.thera-therapist-card').count()) === 1);
      check('section heading reflects the match count',
        (await page.locator('.thera-section-title').first().innerText()).includes('(1)'));
      check('schedule panel auto-selects the first therapist',
        (await page.locator('.thera-schedule-panel').innerText()).includes('Dr. Sarah Chen'));
      check('slot buttons rendered for the selected therapist',
        (await page.locator('.thera-slot-button').count()) === 2);
      await ctx.close();
    }

    // --------------------------------------------------- crisis, tool path
    console.log('\n--- crisis circuit breaker (tool path) ---');
    {
      const { ctx, page } = await newPage();
      const triageCalls = [];
      page.on('request', (r) => { if (r.url().includes('/api/triage')) triageCalls.push(r.url()); });
      await gotoApp(page);
      const res = await page.evaluate(() =>
        window.__WEBMCP_TOOLS__[0].handler({ raw_narrative: 'I want to die, there is no point' }));
      check('tool returns CRISIS_INTERCEPTED', res.status === 'CRISIS_INTERCEPTED', JSON.stringify(res));
      check('crisis modal is displayed',
        await page.locator('.thera-modal-card', { hasText: 'Support is available right now' }).isVisible());
      const modalText = await page.locator('.thera-modal-card').innerText();
      check('modal lists the 988 lifeline', modalText.includes('988'));
      check('modal lists emergency services', modalText.includes('911'));
      check('modal lists the crisis text line', modalText.includes('741741'));
      check('frontend short-circuits without calling /api/triage', triageCalls.length === 0, JSON.stringify(triageCalls));
      await page.locator('.thera-modal-button', { hasText: 'Acknowledge' }).click();
      await page.waitForSelector('.thera-modal-card', { state: 'detached' });
      check('acknowledging returns to safe mode', (await page.locator('.thera-modal-card').count()) === 0);
      await ctx.close();
    }

    // --------------------------------- human-in-the-loop approval (tool path)
    console.log('\n--- commit_intake_booking: human-in-the-loop guard ---');
    {
      const { ctx, page } = await newPage();
      await gotoApp(page);
      await page.evaluate(() => window.__WEBMCP_TOOLS__[0].handler({ raw_narrative: 'burnout' }));
      await page.waitForSelector('.thera-therapist-card');
      await page.evaluate((mark) => {
        window.__bookResult = null;
        window.__WEBMCP_TOOLS__[1]
          .handler({ therapist_id: 'th_01', selected_slot: 'Thursday 18:00', intake_summary: `agent summary ${mark}` })
          .then((r) => { window.__bookResult = r; });
      }, MARK);
      await page.waitForSelector('.thera-modal-card');
      check('approval modal opens before anything is committed',
        await page.locator('.thera-modal-card', { hasText: 'Confirm intake booking' }).isVisible());
      const modalText = await page.locator('.thera-modal-card').innerText();
      check('modal is labelled WebMCP Approval Guard',
        /webmcp approval guard/i.test(modalText));  // CSS uppercases this label
      check('modal shows the therapist', modalText.includes('Dr. Sarah Chen'));
      check('modal shows the slot to lock', modalText.includes('Thursday 18:00'));
      check('modal prefills the agent-supplied intake summary',
        (await page.locator('#approval-summary').inputValue()).includes('agent summary'));
      await page.waitForTimeout(1500);
      check('TOOL CALL STAYS SUSPENDED while the human decides',
        (await page.evaluate(() => window.__bookResult)) === null);
      // The human edits the summary before signing; the edited text must be
      // what is persisted, not the agent's original.
      await page.fill('#approval-summary', `human edited summary ${MARK}`);
      await page.locator('.thera-modal-button', { hasText: 'Approve & sign intake' }).click();
      await page.waitForFunction(() => window.__bookResult !== null, null, { timeout: 20000 });
      const res = await page.evaluate(() => window.__bookResult);
      check('tool resolves SUCCESS after approval', res.status === 'SUCCESS', JSON.stringify(res));
      check('tool returns a booking_id', /^BK_/.test(res.booking_id || ''), JSON.stringify(res));
      await page.waitForSelector('.thera-banner');
      check('success banner is shown',
        (await page.locator('.thera-banner').innerText()).includes('Booking confirmed'));
      global.__editedBookingId = res.booking_id;
      await ctx.close();
    }

    // --------------------------------------------- decline releases the lock
    console.log('\n--- decline path releases the reservation ---');
    {
      const { ctx, page } = await newPage();
      await gotoApp(page);
      await page.evaluate(() => window.__WEBMCP_TOOLS__[0].handler({ raw_narrative: 'burnout' }));
      await page.waitForSelector('.thera-therapist-card');
      await page.evaluate(() => {
        window.__bookResult = null;
        window.__WEBMCP_TOOLS__[1]
          .handler({ therapist_id: 'th_01', selected_slot: 'Saturday 10:00' })
          .then((r) => { window.__bookResult = r; });
      });
      await page.waitForSelector('.thera-modal-card');
      check('modal defaults the summary when the agent supplies none',
        (await page.locator('#approval-summary').inputValue()).length > 0);
      // While the modal is open the slot must already be held.
      const heldResp = await api('/api/book/lock', { therapistId: 'th_01', slot: 'Saturday 10:00' });
      check('slot is locked while the human is deciding', heldResp.status === 409);
      await page.locator('.thera-modal-button', { hasText: 'Decline' }).click();
      await page.waitForFunction(() => window.__bookResult !== null, null, { timeout: 20000 });
      const res = await page.evaluate(() => window.__bookResult);
      check('declining resolves REJECTED_BY_USER', res.status === 'REJECTED_BY_USER', JSON.stringify(res));
      check('no success banner after a decline',
        (await page.locator('.thera-banner').count()) === 0);
      const freed = await api('/api/book/lock', { therapistId: 'th_01', slot: 'Saturday 10:00' });
      const freedJson = await freed.json();
      check('declining releases the lock immediately', freed.status === 200, `${freed.status} ${JSON.stringify(freedJson)}`);
      if (freedJson.lockToken) {
        await api('/api/book/release', { therapistId: 'th_01', slot: 'Saturday 10:00', lockToken: freedJson.lockToken });
      }
      await ctx.close();
    }

    // ---------------------------------------------------- tool error surfacing
    console.log('\n--- tool error handling ---');
    {
      const { ctx, page } = await newPage();
      await gotoApp(page);
      await page.evaluate(() => window.__WEBMCP_TOOLS__[0].handler({ raw_narrative: 'burnout' }));
      await page.waitForSelector('.thera-therapist-card');
      const unknown = await page.evaluate(() =>
        window.__WEBMCP_TOOLS__[1].handler({ therapist_id: 'th_99', selected_slot: 'Thursday 18:00' }));
      check('booking an unknown therapist returns THERAPIST_NOT_FOUND',
        unknown.error_code === 'THERAPIST_NOT_FOUND', JSON.stringify(unknown));
      const taken = await page.evaluate(() =>
        window.__WEBMCP_TOOLS__[1].handler({ therapist_id: 'th_01', selected_slot: 'Thursday 18:00' }));
      check('booking an already-booked slot is refused', taken.status === 'SLOT_UNAVAILABLE', JSON.stringify(taken));
      check('the refusal is surfaced in the UI banner',
        (await page.locator('.thera-banner').innerText()).includes('already booked'));
      const badSlot = await page.evaluate(() =>
        window.__WEBMCP_TOOLS__[1].handler({ therapist_id: 'th_01', selected_slot: 'Monday 09:00' }));
      check('booking a slot the therapist does not offer is refused', badSlot.status === 'INVALID_SLOT', JSON.stringify(badSlot));
      await ctx.close();
    }

    // --------------------------------------------------------- human UI path
    console.log('\n--- human-driven booking path ---');
    {
      const { ctx, page } = await newPage();
      await gotoApp(page);
      check('Find Therapists is disabled until a narrative is entered',
        await page.locator('.thera-primary-button', { hasText: 'Find Therapists' }).isDisabled());
      await page.fill('#intake-narrative', 'I have been anxious since starting a new job');
      await page.fill('.thera-input >> nth=0', 'EFT');
      await page.locator('.thera-primary-button', { hasText: 'Find Therapists' }).click();
      await page.waitForSelector('.thera-therapist-card');
      check('human search returns the EFT therapist',
        (await page.locator('.thera-therapist-card').innerText()).includes('Marcus Vance'));
      check('intake form collapses to a summary row',
        await page.locator('.thera-intake-summary-row').isVisible());
      await page.locator('.thera-secondary-button', { hasText: 'Edit Search' }).click();
      check('"Edit Search" reopens the form',
        await page.locator('#intake-narrative').isVisible());
      // Changing the narrative after a search must block booking until re-run.
      await page.fill('#intake-narrative', 'completely different concern now');
      const guard = page.locator('.thera-primary-button', { hasText: 'Run Search First' });
      check('booking button switches to "Run Search First"', await guard.isVisible());
      check('booking button is disabled while intake is stale', await guard.isDisabled());
      check('a warning explains the stale intake',
        (await page.locator('.thera-schedule-panel').innerText()).includes('Run Find Therapists again'));
      // Re-run the search to clear the guard.
      await page.fill('#intake-narrative', 'relationship strain at home');
      await page.locator('.thera-primary-button', { hasText: 'Find Therapists' }).click();
      await page.waitForSelector('.thera-intake-summary-row');
      const slots = page.locator('.thera-slot-button');
      check('selected therapist exposes two slots', (await slots.count()) === 2);
      await slots.nth(1).click();
      await page.locator('.thera-primary-button', { hasText: 'Book This Slot' }).click();
      await page.waitForSelector('.thera-modal-card');
      check('human booking opens the same approval guard',
        (await page.locator('.thera-modal-card').innerText()).includes('Confirm intake booking'));
      check('modal carries the human narrative as the intake summary',
        (await page.locator('#approval-summary').inputValue()).includes('relationship strain'));
      await page.fill('#approval-summary', `human path summary ${MARK}`);
      await page.locator('.thera-modal-button', { hasText: 'Approve & sign intake' }).click();
      await page.waitForSelector('.thera-banner');
      check('human path shows the confirmation banner',
        (await page.locator('.thera-banner').innerText()).includes('Booking confirmed'));
      await ctx.close();
    }

    // ------------------------------------------------ crisis via human input
    console.log('\n--- crisis circuit breaker (human path) ---');
    {
      const { ctx, page } = await newPage();
      await gotoApp(page);
      await page.fill('#intake-narrative', 'I feel like I want to kill myself');
      await page.locator('.thera-primary-button', { hasText: 'Find Therapists' }).click();
      await page.waitForSelector('.thera-modal-card');
      check('human crisis input triggers the safety modal',
        (await page.locator('.thera-modal-card').innerText()).includes('Support is available right now'));
      check('no therapists are matched during a crisis intercept',
        (await page.locator('.thera-therapist-card').count()) === 0);
      await ctx.close();
    }

    // -------------------------------------------- therapist switching in UI
    console.log('\n--- therapist selection ---');
    {
      const { ctx, page } = await newPage();
      await gotoApp(page);
      await page.evaluate(() => window.__WEBMCP_TOOLS__[0].handler({ raw_narrative: 'general support' }));
      await page.waitForSelector('.thera-therapist-card');
      check('both therapists listed with no filter',
        (await page.locator('.thera-therapist-card').count()) === 2);
      const panelBefore = await page.locator('.thera-schedule-panel').innerText();
      await page.locator('.thera-therapist-card').nth(1).click();
      const panelAfter = await page.locator('.thera-schedule-panel').innerText();
      check('clicking the second therapist switches the schedule panel',
        panelBefore !== panelAfter && panelAfter.includes('Marcus Vance'), panelAfter.split('\n')[0]);
      check('schedule shows the 8-week recurring label', panelAfter.includes('recurring, locked for 8 weeks'));
      await ctx.close();
    }

    console.log(`\n=== UI: ${pass} passed, ${fail} failed ===`);
    if (global.__editedBookingId) console.log(`(booking created for summary check: ${global.__editedBookingId})`);
  } finally {
    await browser.close();
  }
  if (fail) { console.log('FAILED: ' + failures.join(' | ')); process.exit(1); }
})();
