import { getCountFromServer, getDocFromServer, getDocsFromServer, onSnapshot, query, queryEqual, refEqual, where } from 'firebase/firestore'
import { createRealtimeChannel, recoverCollection } from '../utils/realtimeChannel.js'
import { createSharedSubscriptions } from '../utils/sharedSubscriptions.js'
import { updateRealtimeStatus } from './realtimeStatus.js'

const databases = new WeakMap()
const sameSource = (first, second) => first.type === 'document' || second.type === 'document'
  ? first.type === second.type && refEqual(first, second)
  : queryEqual(first, second)

function subscribe(source, onData, onError, onSync) {
  let pool = databases.get(source.firestore)
  if (!pool) {
    pool = createSharedSubscriptions({
      equal: sameSource,
      create: (target) => {
        const singleDocument = target.type === 'document'
        const games = target.type === 'collection' && target.path === 'games'
        const channel = createRealtimeChannel({
          listen: (next, failed) => onSnapshot(target, { includeMetadataChanges: true }, next, failed),
          read: singleDocument ? () => getDocFromServer(target) : target.type === 'collection' && target.path !== 'announcements'
            ? (snapshot) => recoverCollection(snapshot, {
              readAll: () => getDocsFromServer(target),
              readChanged: (cursor) => getDocsFromServer(query(target, where('updatedAt', '>=', cursor))),
              readCount: async () => (await getCountFromServer(target)).data().count,
            })
            // Preserve exact filters and permissions without requiring new composite indexes.
            : () => getDocsFromServer(target),
          interval: games ? 30000 : 60000,
        })
        return {
          subscribe(next, failed, sync) {
            return channel.subscribe(next, failed, (connected, info) => {
              updateRealtimeStatus(channel, info)
              sync?.(connected, info)
            })
          },
          channel,
        }
      },
      onRemove: (wrapper) => updateRealtimeStatus(wrapper.channel, null),
    })
    databases.set(source.firestore, pool)
  }
  return pool(source, onData, onError, onSync)
}

// All screens use the same resilient subscriptions; TV has no privileged refresh path.
export const watchGames = subscribe
export const watchSnapshot = subscribe
