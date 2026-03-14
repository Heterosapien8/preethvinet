import { useEffect, useState } from 'react'
import { collection, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore'
import { format } from 'date-fns'
import clsx from 'clsx'
import { db } from '../../config/firebase'
import { COLLECTIONS, ROLES } from '../../config/constants'
import { useAuth } from '../../contexts/AuthContext'

export default function ViolationList() {
  const { role, roId } = useAuth()
  const [violations, setViolations] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const isAdmin = role === ROLES.SUPER_ADMIN
    const violationQuery = isAdmin
      ? query(collection(db, COLLECTIONS.VIOLATIONS), orderBy('detectedAt', 'desc'), limit(50))
      : query(
          collection(db, COLLECTIONS.VIOLATIONS),
          where('roId', '==', roId),
          orderBy('detectedAt', 'desc'),
          limit(50)
        )

    return onSnapshot(violationQuery, (snapshot) => {
      setViolations(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
      setLoading(false)
    }, () => setLoading(false))
  }, [role, roId])

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Violation Records</h1>
        <p className="text-sm text-gray-400">
          Live breach log across air, water, and noise submissions.
        </p>
      </div>

      <div className="card !p-0 overflow-hidden">
        {loading ? (
          <div className="py-16 flex items-center justify-center">
            <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : violations.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">No violations recorded.</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-primary-700 text-white">
                <th className="px-4 py-3 text-left text-xs font-medium">Industry</th>
                <th className="px-4 py-3 text-left text-xs font-medium">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium">RO</th>
                <th className="px-4 py-3 text-left text-xs font-medium">Parameters</th>
                <th className="px-4 py-3 text-left text-xs font-medium">Severity</th>
                <th className="px-4 py-3 text-left text-xs font-medium">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium">Detected</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {violations.map((violation, index) => (
                <tr key={violation.id} className={clsx('hover:bg-primary-50', index % 2 === 1 && 'bg-gray-50')}>
                  <td className="px-4 py-3 font-medium text-gray-700">{violation.industryName ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-500 capitalize">{violation.readingType ?? '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{violation.roName ?? '-'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {violation.violatedParameters?.map((item) => `${item.parameter}: ${item.measured}/${item.limit}`).join(' · ') ?? '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={clsx(
                      'px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide',
                      violation.severity === 'critical' ? 'bg-red-100 text-red-700' :
                      violation.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                      'bg-yellow-100 text-yellow-700'
                    )}>
                      {violation.severity ?? 'medium'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={violation.status === 'open' ? 'badge-violation' : 'badge-compliant'}>
                      {violation.status ?? 'open'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {violation.detectedAt?.toDate ? format(violation.detectedAt.toDate(), 'dd/MM/yyyy HH:mm') : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
