export const REGISTRATION_REVIEWER_EMAIL = 'guilhermebasiliodebarros@gmail.com'

export const APPROVAL_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
}

export const APPROVAL_LABELS = {
  pending: 'Aguardando aprovação',
  approved: 'Aprovado',
  rejected: 'Recusado',
}

export function isRegistrationReviewer(user) {
  return String(user?.email || '').trim().toLowerCase() === REGISTRATION_REVIEWER_EMAIL
}

export function registrationApprovalStatus(profile) {
  return Object.values(APPROVAL_STATUS).includes(profile?.approvalStatus)
    ? profile.approvalStatus
    : APPROVAL_STATUS.PENDING
}

export function isApprovedParticipant(profile) {
  return profile?.role === 'user'
    && profile.participaRanking === true
    && registrationApprovalStatus(profile) === APPROVAL_STATUS.APPROVED
}
