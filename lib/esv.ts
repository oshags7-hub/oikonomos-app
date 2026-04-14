// ESV Bible API — get your free key at https://api.esv.org/
// Add EXPO_PUBLIC_ESV_API_KEY to your .env file
const ESV_KEY = process.env.EXPO_PUBLIC_ESV_API_KEY ?? '';
const BASE = 'https://api.esv.org/v3/passage/text/';

export async function fetchPassage(query: string): Promise<string> {
  if (!ESV_KEY) {
    return '[ESV API key not set — add EXPO_PUBLIC_ESV_API_KEY to your .env file. Get a free key at api.esv.org]';
  }
  try {
    const params = new URLSearchParams({
      q: query,
      'include-headings': 'false',
      'include-footnotes': 'false',
      'include-verse-numbers': 'true',
      'include-short-copyright': 'true',
      'include-passage-references': 'false',
    });
    const res = await fetch(`${BASE}?${params}`, {
      headers: { Authorization: `Token ${ESV_KEY}` },
    });
    const data = await res.json();
    return data.passages?.[0] ?? 'Passage not found.';
  } catch {
    return 'Could not load passage. Check your connection.';
  }
}

export async function fetchVerseOfDay(): Promise<{ text: string; ref: string }> {
  const verseList = [
    { ref: 'Proverbs 31:25', q: 'Proverbs 31:25' },
    { ref: 'Proverbs 31:27', q: 'Proverbs 31:27' },
    { ref: 'Philippians 4:6', q: 'Philippians 4:6' },
    { ref: 'Joshua 1:9', q: 'Joshua 1:9' },
    { ref: 'Psalm 23:1', q: 'Psalm 23:1' },
    { ref: 'Isaiah 40:31', q: 'Isaiah 40:31' },
    { ref: 'Romans 8:28', q: 'Romans 8:28' },
    { ref: 'Jeremiah 29:11', q: 'Jeremiah 29:11' },
  ];
  const today = new Date();
  const idx = (today.getMonth() * 31 + today.getDate()) % verseList.length;
  const verse = verseList[idx];
  const text = await fetchPassage(verse.q);
  // strip the ESV copyright line for display
  const clean = text.replace(/\(ESV\)[\s\S]*$/, '').trim();
  return { text: clean, ref: verse.ref };
}
