export function formatDateTime(value) {
  if (!value) {
    return 'Data a definir'
  }

  const date = toDate(value)

  if (Number.isNaN(date.getTime())) {
    return 'Data a definir'
  }

  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function toDate(value) {
  if (!value) {
    return new Date(Number.NaN)
  }

  return value?.toDate ? value.toDate() : new Date(value)
}

export function toDateTimeLocalValue(value) {
  const date = toDate(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const pad = (part) => String(part).padStart(2, '0')

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}`
}

export function formatTimeRemaining(value, now = new Date()) {
  const deadline = toDate(value)

  if (Number.isNaN(deadline.getTime())) {
    return 'Sem prazo definido'
  }

  const diff = deadline.getTime() - now.getTime()

  if (diff <= 0) {
    return 'Prazo encerrado'
  }

  const totalMinutes = Math.ceil(diff / 60000)
  const days = Math.floor(totalMinutes / 1440)
  const hours = Math.floor((totalMinutes % 1440) / 60)
  const minutes = totalMinutes % 60

  if (days > 0) {
    return `Faltam ${days}d ${hours}h`
  }

  if (hours > 0) {
    return `Faltam ${hours}h ${minutes}min`
  }

  return minutes <= 1 ? 'Menos de 1min' : `Faltam ${minutes}min`
}

export function minutesUntil(value, now = new Date()) {
  const deadline = toDate(value)

  if (Number.isNaN(deadline.getTime())) {
    return null
  }

  return Math.ceil((deadline.getTime() - now.getTime()) / 60000)
}

export function asNumberOrNull(value) {
  if (value === '' || value === null || value === undefined) {
    return null
  }

  const number = Number(value)
  return Number.isFinite(number) ? number : null
}
