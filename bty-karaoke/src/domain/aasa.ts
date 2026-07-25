// Apple App Site Association (BUILD 19B). The measured native identity is
// Team ID CS92W2HFCH + bundle com.bty.BTYNorebangAdmin. AASA authorizes ONLY the
// Guest-to-App handoff path — never all site routes — so no unrelated route becomes a
// Universal Link. There are no pre-existing AASA app entries to preserve (measured 404).

export const AASA_APP_ID = 'CS92W2HFCH.com.bty.BTYNorebangAdmin';

/** The canonical AASA document. `appIDs` + `components` is the modern format; only
 *  `/app/join/*` is claimed. */
export const APPLE_APP_SITE_ASSOCIATION = {
  applinks: {
    details: [
      {
        appIDs: [AASA_APP_ID],
        components: [
          { '/': '/app/join/*', comment: 'BTY Norebang Guest-to-App handoff' },
        ],
      },
    ],
  },
} as const;
