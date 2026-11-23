import { test } from 'node:test'
import assert from 'node:assert/strict'
import { APPROVAL_STATUS, isApprovedParticipant, isRegistrationReviewer, registrationApprovalStatus } from '../src/utils/registrationApproval.js'
import { APP_VIEWS, resolveAppView } from '../src/utils/navigation.js'

test('new, legacy, rejected and malformed profiles cannot enter the bolão or ranking', () => {
  for (const profile of [null, {}, { role: 'user', participaRanking: true }, ...['pending', 'rejected', 'invalid', null].map((approvalStatus) => ({ role: 'user', participaRanking: true, approvalStatus }))]) {
    assert.equal(isApprovedParticipant(profile), false)
  }
  assert.equal(registrationApprovalStatus({}), APPROVAL_STATUS.PENDING)
  assert.equal(registrationApprovalStatus({ approvalStatus: 'invalid' }), APPROVAL_STATUS.PENDING)
  assert.equal(isApprovedParticipant({ role: 'user', approvalStatus: 'approved', participaRanking: true }), true)
  for (const role of ['master', 'viewer', 'admin', undefined]) assert.equal(isApprovedParticipant({ role, approvalStatus: 'approved', participaRanking: true }), false)
  for (const participaRanking of [false, undefined, 'true']) assert.equal(isApprovedParticipant({ role: 'user', approvalStatus: 'approved', participaRanking }), false)
})

test('review permissions identify the authenticated email and never grant approval to other masters or participants', () => {
  assert.equal(isRegistrationReviewer({ email: 'GuilhermeBasilioDeBarros@gmail.com' }), true)
  for (const user of [null, {}, { email: 'outro@gmail.com', role: 'master' }, { email: 'guilhermebasiliodebarros@gmail.com.outro.com' }, { email: 'aluno@gmail.com', profile: { email: 'guilhermebasiliodebarros@gmail.com' } }]) assert.equal(isRegistrationReviewer(user), false)
})

test('every direct link, including mobile quick mode and TV, sends pending or rejected accounts to their status', () => {
  for (const requested of [...APP_VIEWS, 'unknown']) {
    for (const participantHome of ['dashboard', 'jogos']) {
      assert.equal(resolveAppView(requested, { signedIn: true, isMaster: false, isParticipant: false, participantHome }), 'aprovacao')
    }
  }
})

test('Guilherme can review registrations even when his own participant profile awaits approval, without gaining master access', () => {
  for (const requested of APP_VIEWS) assert.equal(resolveAppView(requested, { signedIn: true, canReviewRegistrations: true }), 'cadastros')
  assert.equal(resolveAppView('cadastros', { signedIn: true, canReviewRegistrations: true, isMaster: true }), 'cadastros')
  assert.equal(resolveAppView('cadastros', { signedIn: true, canReviewRegistrations: true, isParticipant: true }), 'cadastros')
  assert.equal(resolveAppView('admin', { signedIn: true, canReviewRegistrations: true, isParticipant: true }), 'dashboard')
  assert.equal(resolveAppView('cadastros', { signedIn: false, canReviewRegistrations: true }), 'login')
  assert.equal(resolveAppView('cadastros', { signedIn: true, isMaster: true }), 'admin')
  assert.equal(resolveAppView('cadastros', { signedIn: true, isViewer: true }), 'calendario')
})
