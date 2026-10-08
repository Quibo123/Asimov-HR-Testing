/**
 * @ui @knownissue
 * Documents a real frontend defect found by the S-105 suite.
 *
 * DEFECT: SPA navigation between module routes does not re-render the page
 * heading. In src/App.tsx every module route renders the same `ModulePage`
 * component with a different i18n namespace:
 *
 *   <Route path="/talently" element={<ModulePage ns="talently" />} />
 *
 * `useTranslation(ns)` is only evaluated when that component instance mounts.
 * React Router reuses the same element position across sibling routes, so the
 * component is not remounted and `ns` never changes - the h1 keeps showing the
 * previous module's title while the URL changes.
 *
 * Verified behaviour: direct navigation and hard reload render the correct
 * title; only in-app client-side navigation is affected.
 *
 * This test is tagged @knownissue so it is EXCLUDED from the CI gate and stays
 * green, while still documenting the expected behaviour. Delete this file once
 * the developer fixes App.tsx.
 */
import { strict as assert } from 'node:assert'

Feature('Asimov HR known issues @ui')

Scenario('in-app navigation updates the module heading @knownissue', async ({ I }) => {
  I.amOnPage('/')
  I.waitForElement('aside', 15)

  I.click('aside a[href="/talently"]')
  I.waitForURL(/\/talently$/, 15)
  I.waitForText('Talently', 15, 'h1')

  // Currently fails: heading stays "Talently" after navigating to /people.
  I.click('aside a[href="/people"]')
  I.waitForURL(/\/people$/, 15)
  I.waitForText('People', 15, 'h1')

  assert.equal(await I.grabTextFrom('h1'), 'People')
})
