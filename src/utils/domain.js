const MX_RECORD_TYPE = 15

function extractDomain(email) {
  const at = email.lastIndexOf('@')
  if (at === -1) return ''
  return email.slice(at + 1).trim().toLowerCase()
}

async function domainHasMx(domain) {
  const endpoints = [
    `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`,
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(domain)}&type=MX`,
  ]

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/dns-json' },
      })
      if (!res.ok) continue
      const data = await res.json()
      if (Array.isArray(data.Answer)) {
        return data.Answer.some((record) => record.type === MX_RECORD_TYPE)
      }
      if (typeof data.Status === 'number') {
        return false
      }
    } catch {
      continue
    }
  }

  return null
}

export async function checkEmailDomain(email) {
  const domain = extractDomain(email)

  if (
    !domain ||
    !domain.includes('.') ||
    domain.startsWith('.') ||
    domain.endsWith('.')
  ) {
    return { ok: false, domain, reason: 'invalid' }
  }

  const hasMx = await domainHasMx(domain)

  if (hasMx === null) {
    return { ok: false, domain, reason: 'unreachable' }
  }

  if (!hasMx) {
    return { ok: false, domain, reason: 'no-mx' }
  }

  return { ok: true, domain }
}
