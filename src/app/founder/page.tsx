// The standalone founder page has been retired. Its content now lives on the
// /about page (consolidated into a "Founder" section). This route now performs a
// permanent redirect to /about so any existing links (or bookmarks) keep working.

import { redirect } from 'next/navigation';

export default function FounderPage() {
  redirect('/about');
}
