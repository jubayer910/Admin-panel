import type { Database, SqlValue } from "sql.js";
import files from "./files.json";

/*
 * The demo's data: made up, but shaped like a year of a real portfolio.
 *
 * Only the owner is real (Maniruzzaman Jubayer: the name, the photo and the
 * profile links); every project, client, booking, visit and click is
 * invented. Everything comes from one seeded random generator, so every
 * visitor sees the same data, and the dates are counted back from today, so
 * the demo always looks current.
 */

const DAY = 86_400_000;
const HOUR = 3_600_000;

/* ---------------------------------------------------------------- random */

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let rand = mulberry32(20260927);
const between = (a: number, b: number) => a + rand() * (b - a);
const int = (a: number, b: number) => Math.floor(between(a, b + 1));
const pick = <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
const chance = (p: number) => rand() < p;

/** pick by weight: [[value, weight], ...] */
function weighted<T>(options: readonly (readonly [T, number])[]): T {
  const total = options.reduce((a, [, w]) => a + w, 0);
  let x = rand() * total;
  for (const [v, w] of options) {
    x -= w;
    if (x <= 0) return v;
  }
  return options[options.length - 1][0];
}

const hex = (n: number) => Array.from({ length: n }, () => Math.floor(rand() * 16).toString(16)).join("");
const sqlTime = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace("T", " ");
const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

type Row = Record<string, SqlValue>;

function insert(d: Database, table: string, rows: Row[]) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const stmt = d.prepare(`INSERT INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`);
  try {
    for (const r of rows) stmt.run(cols.map((c) => r[c] ?? null));
  } finally {
    stmt.free();
  }
}

/* ---------------------------------------------------------------- content */

const OWNER = "Maniruzzaman Jubayer";

const SETTINGS: Record<string, string> = {
  "brand.avatar": "brand/avatar.webp",
  "footer.copyright": `© ${new Date().getFullYear()}. ${OWNER}`,
  "footer.behance": "https://www.behance.net/jubayer10",
  "footer.linkedin": "https://www.linkedin.com/in/jubayer910",
  "footer.email": "hello@example.com",
  "seo.title": `${OWNER} | Admin panel demo`,
  "seo.description": "An open-source admin panel for a designer's portfolio, shown here with made-up projects, bookings and analytics.",
  "hero.title": "Design partner for ambitious product teams.",
  "hero.intro":
    "This is the admin of a designer's portfolio, filled with made-up projects, clients and visits so you can click through all of it.",
  "hero.aboutLabel": "More About Me",
  "work.title": "Selected work",
  "clients.label": "Clients:",
  "clients.more": "40+ more",
  "creativeCore.label": "Life at the studio",
  "perks.label": "Perks:",
  "perks.body": "Unlimited requests and revisions, delivery every 48 hours, async check-ins, pause anytime.",
  "pricing.label": "Pricing:",
  "pricing.body": "Subscriptions from $2,950 a month, or fixed-scope projects from $6,000.",
  "pricing.linkLabel": "See plans",
  "pricing.linkHref": "#offers",
  "offers.eyebrow": "Plans",
  "offers.title": "Clear pricing, no surprises",
  "testimonials.title": "What clients say",
  "faqs.title": "Questions, answered",
  "cta.title": "Have a product in mind?\nLet's talk.",
  "cta.messageLabel": "Message",
  "cta.messageHref": "https://wa.me/10000000000",
  "cta.messageIcon": "whatsapp",
  "cta.callLabel": "Intro Call",
  "cta.callHref": "",
  "tracking.metaPixelId": "1234567890123456",
  "about.title": "Designer and design lead, building products people trust.",
  "about.subtitle":
    "Eight years across SaaS, fintech and consumer apps: research, product design, design systems and the brands around them.",
  "about.recognitionLabel": "Recognition:",
  "about.recognition": "24 gallery features and a 5.0 client rating.",
  "about.recognitionLinkLabel": "View profile",
  "about.recognitionLinkHref": "https://www.behance.net/jubayer10",
  "about.experienceLabel": "Experience:",
  "about.experienceSummary": "8+ years and 40+ products shipped for startups and enterprise teams.",
  "about.storyTitle": "My story",
  "about.story":
    "I started with posters and logos for friends, then fell for the harder problem: software that has to explain itself.\n\nToday I lead design on products from the first sketch to the release notes, with a small team that stays with a client for years.",
  "about.experienceTitle": "Experience",
  "about.experienceNote": "Studios, startups and a few years on my own.",
  "about.awardsTitle": "Awards",
  "about.awardsNote": "Featured 24 times across curated galleries.",
  "about.awardsLinkLabel": "View all awards",
  "about.awardsLinkHref": "https://www.behance.net/jubayer10",
  "about.galleryTitle": "Gallery",
  "about.galleryNote": "The studio, the team and the days in between.",
  "booking.calLink": "your-name/30min",
  "booking.title": "Book an intro call",
  "booking.eventTitle": "30 min intro call",
  "booking.facts": "30 min\nGoogle Meet",
  "booking.footnote": "Free, no obligation. You leave with clear next steps.",
  "booking.agendaLabel": "What we'll cover",
  "booking.agenda": "Your product and where it is headed\nWhere design is slowing you down\nNext steps and a rough scope",
  "booking.needs": "Product design\nWebsite\nBranding\nDesign system\nMobile app\nNot sure yet",
  "booking.successTitle": "You're booked",
  "booking.successText": "A calendar invite with the meeting link is on its way to your inbox.",
};

const CATEGORIES = [
  ["product", "Product design"],
  ["web", "Websites"],
  ["mobile", "Mobile apps"],
  ["branding", "Branding"],
  ["motion", "Motion"],
] as const;

/** title, category (matches scripts/make-art.mjs) */
const PROJECTS: [string, string][] = [
  ["Northwind Analytics", "product"],
  ["Lumen Banking app", "mobile"],
  ["Tidal Brand identity", "branding"],
  ["Orbit Travel planner", "web"],
  ["Pulse Health dashboard", "product"],
  ["Kite Commerce", "web"],
  ["Ferro Logistics", "product"],
  ["Aurora Energy rebrand", "branding"],
  ["Cobalt CRM", "product"],
  ["Maple Learning app", "mobile"],
  ["Quill Notes", "mobile"],
  ["Harbor Real estate", "web"],
  ["Nimbus Cloud console", "product"],
  ["Sable Fashion store", "web"],
  ["Echo Podcast app", "mobile"],
  ["Vertex AI assistant", "product"],
  ["Juniper Coffee", "branding"],
  ["Atlas Maps launch film", "motion"],
  ["Prism Design system", "product"],
  ["Relay Messaging", "mobile"],
  ["Bloom Florist", "branding"],
  ["Summit Outdoor", "web"],
  ["Onyx Security", "product"],
  ["Waypoint Fleet", "product"],
  ["Crest Insurance", "web"],
  ["Fable Kids books", "branding"],
  ["Glide Payments", "mobile"],
  ["Mosaic Museum", "motion"],
  ["Tandem HR", "product"],
  ["Verve Fitness", "mobile"],
  ["Lattice Fintech", "branding"],
  ["Beacon Nonprofit", "motion"],
];

const SUMMARIES = [
  "A calmer way to read a busy business: the numbers that matter first, the rest one click away.",
  "Onboarding cut from nine screens to three, and support tickets down by a third.",
  "A new identity that works from an app icon to a trade-show wall.",
  "Planning a trip with friends, without the forty-message group chat.",
  "One view of every patient's week, built with the nurses who use it.",
  "A storefront that loads fast on a train and sells more at night.",
  "Routes, drivers and delays on one live map.",
  "A rebrand for a company moving from oil to wind.",
  "A CRM the sales team opens because they want to, not because they have to.",
  "Lessons in ten-minute pieces, with streaks that feel earned.",
  "Notes that find themselves when you need them.",
  "Listings with the photos first and the paperwork handled.",
  "The whole cloud estate, readable at a glance.",
  "A fashion store that feels like the lookbook.",
  "Shows, clips and chapters in a player people keep open.",
  "An assistant that shows its sources and knows when to ask.",
];

const CLIENTS = [
  "Northwind", "Lumen", "Orbit", "Tidal", "Pulse", "Kite", "Ferro", "Aurora",
  "Cobalt", "Maple", "Harbor", "Nimbus", "Vertex", "Juniper", "Prism", "Summit",
];

const PEOPLE: [string, string, string][] = [
  ["Ayesha Rahman", "Head of Product", "Northwind"],
  ["Daniel Okafor", "Founder", "Lumen"],
  ["Sofia Marquez", "Design Director", "Tidal"],
  ["Kenji Watanabe", "CTO", "Orbit"],
  ["Emily Carter", "VP Marketing", "Pulse"],
  ["Omar Haddad", "CEO", "Kite"],
  ["Priya Nair", "Product Lead", "Nimbus"],
  ["Lea Schmidt", "Co-founder", "Juniper"],
  ["Marco Rossi", "Head of Growth", "Vertex"],
  ["Hannah Lee", "COO", "Prism"],
];

const QUOTES = [
  "They took a product nobody could explain and made it obvious. Our demo calls got shorter and our close rate went up.",
  "The first design partner who asked about our numbers before our colours. Every screen had a reason.",
  "Fast, calm and honest about trade-offs. The rebrand landed with customers and with our own team.",
  "We shipped the new app two months early. The design system alone saved our engineers weeks.",
  "Clear thinking, beautiful work, and no drama. We have renewed three times.",
  "They turned forty pages of requirements into a flow our users understood on the first try.",
  "Every handoff was ready to build. Our developers kept asking who made the files.",
  "They care about the small things: empty states, error messages, the loading screen. It shows.",
  "Our investors noticed the new product before we told them about it.",
  "Working with them felt like adding a senior designer to the team, not hiring an agency.",
];

const FAQS: [string, string][] = [
  ["How does the subscription work?", "One monthly fee, one queue of requests. We work through it in order, a design lands every 48 hours or so, and you can pause whenever you like."],
  ["Who will I actually work with?", "The same small senior team from the first call to the last file, with one person as your point of contact."],
  ["Do you build as well as design?", "Yes. Once the designs are signed off we can carry them into production, or hand them to your engineers with everything they need."],
  ["What if our priorities change?", "They usually do. Requests and revisions are unlimited, so we reorder the queue with you and keep going."],
  ["How fast can we start?", "Most teams start within a week of the intro call."],
  ["Can you work with our in-house team?", "Often. We join your tools and rituals, follow your conventions and leave the files organised the way your team likes."],
  ["Who owns the work?", "You do, in full, as soon as the invoice is paid."],
  ["Do you sign NDAs?", "Of course. Send yours over before the first call if you like."],
  ["What does a typical project cost?", "Subscriptions start at $2,950 a month; fixed-scope projects start at $6,000. The intro call ends with a clear number."],
  ["Which time zones do you work in?", "The team overlaps with Europe, the Middle East and Asia, and holds early calls for the Americas."],
];

const PLANS = [
  {
    id: "plan-starter", name: "Starter", blurb: "One request at a time, for early teams.", badge: null, monthly_price: 2950,
    trial_label: "First two weeks", trial_price: 1475, icon: "demo/icons/plan-starter.svg",
    features: ["One request at a time", "Delivery in about 48 hours", "Product and web design", "Unlimited revisions", "Pause or cancel anytime"],
  },
  {
    id: "plan-growth", name: "Growth", blurb: "Two requests at a time, for teams shipping every week.", badge: "Popular", monthly_price: 4950,
    trial_label: "First two weeks", trial_price: 2475, icon: "demo/icons/plan-growth.svg",
    features: ["Two requests at a time", "Delivery in about 48 hours", "Design system upkeep", "Weekly review call", "Slack channel with the team", "Pause or cancel anytime"],
  },
  {
    id: "plan-custom", name: "Custom", blurb: "Fixed scope, for launches and rebuilds.", badge: null, monthly_price: null,
    trial_label: null, trial_price: null, icon: "demo/icons/plan-custom.svg",
    features: ["A scope and a date", "Research and strategy", "Design and build", "Launch support"],
  },
];

const ROLES: [string, string, string][] = [
  ["Design Lead", "Studio North", "2024 - Present"],
  ["Senior Product Designer", "Brightside", "2022 - 2024"],
  ["Product Designer", "Parallel Labs", "2021 - 2022"],
  ["UI Designer", "Freelance", "2019 - 2021"],
  ["Junior Designer", "Pixel & Co", "2018 - 2019"],
];

const AWARDS: [string, string, string][] = [
  ["UI/UX", "Featured 9x", "demo/awards/ui-ux.svg"],
  ["Branding", "Featured 7x", "demo/awards/branding.svg"],
  ["Interaction", "Featured 5x", "demo/awards/interaction.svg"],
  ["Web design", "Featured 3x", "demo/awards/web-design.svg"],
];

/* ---------------------------------------------------------------- bookings */

const FIRST = ["Aarav", "Ama", "Ben", "Chloe", "Diego", "Elif", "Farah", "Felix", "Grace", "Hugo", "Ines", "Jonas", "Kira", "Leo", "Mia", "Nadia", "Noah", "Olivia", "Rafael", "Sara", "Tariq", "Uma", "Victor", "Yara", "Zoe", "Ibrahim", "Lucia", "Mateo", "Nora", "Arjun"];
const LAST = ["Ahmed", "Becker", "Costa", "Diaz", "Evans", "Fischer", "Garcia", "Hassan", "Ito", "Jensen", "Khan", "Lopez", "Moreau", "Nakamura", "Okoye", "Patel", "Quinn", "Rossi", "Silva", "Tanaka", "Umar", "Varga", "Weber", "Yilmaz", "Zhang"];
const COMPANY_WORDS = ["arc", "bright", "cedar", "delta", "ember", "fern", "granite", "helix", "iris", "jade", "kelp", "lumen", "mint", "nova", "opal", "pine", "quartz", "reef", "slate", "tide"];
const NEEDS = ["Product design", "Website", "Branding", "Design system", "Mobile app", "Not sure yet"];
const NOTES = [
  "We are redesigning our onboarding and need help for about three months.",
  "Seed-stage fintech, looking for a partner for the MVP and the brand.",
  "Our dashboard has grown for five years without a designer. Time to fix it.",
  "Launching in Europe in Q1, need a new marketing site before then.",
  "Two component libraries, one product. Want a single design system.",
  "Just want to chat about options and pricing.",
  "Healthcare app, HIPAA context, needs someone who has done regulated products.",
  "We saw your work on a travel app and want something in that spirit.",
  "Agency looking for a white-label design partner.",
  "Mobile app with good retention but poor reviews on the checkout flow.",
];
const TIMEZONES = ["Asia/Dhaka", "Europe/London", "Europe/Berlin", "America/New_York", "America/Los_Angeles", "Asia/Dubai", "Asia/Singapore", "Australia/Sydney", "Asia/Kolkata", "Europe/Madrid", "Africa/Lagos", "Asia/Tokyo"];
const CANCEL_REASONS = ["Found another time", "Budget moved to next quarter", "Went with an in-house hire", "Double-booked, will rebook", null];

/* ---------------------------------------------------------------- traffic */

const SOURCES: (readonly [{ referrer: string | null; utm?: [string, string, string] }, number])[] = [
  [{ referrer: null }, 34],
  [{ referrer: "google.com" }, 24],
  [{ referrer: "linkedin.com" }, 12],
  [{ referrer: "dribbble.com" }, 8],
  [{ referrer: "behance.net" }, 7],
  [{ referrer: "x.com" }, 4],
  [{ referrer: "facebook.com" }, 3],
  [{ referrer: "bing.com" }, 2],
  [{ referrer: null, utm: ["newsletter", "email", "september-issue"] }, 3],
  [{ referrer: null, utm: ["linkedin", "paid", "founders-q3"] }, 2],
  [{ referrer: null, utm: ["producthunt", "referral", "launch"] }, 1],
];
const PLACES: (readonly [[string, string | null], number])[] = [
  [["US", "New York"], 10], [["US", "San Francisco"], 6], [["US", "Austin"], 3],
  [["GB", "London"], 9], [["GB", "Manchester"], 2], [["DE", "Berlin"], 6], [["DE", "Munich"], 2],
  [["BD", "Dhaka"], 8], [["BD", "Chattogram"], 2], [["IN", "Bengaluru"], 5], [["IN", "Mumbai"], 3],
  [["CA", "Toronto"], 4], [["AU", "Sydney"], 3], [["NL", "Amsterdam"], 3], [["AE", "Dubai"], 3],
  [["SG", "Singapore"], 3], [["FR", "Paris"], 3], [["SE", "Stockholm"], 2], [["ES", "Madrid"], 2],
  [["BR", "São Paulo"], 2], [["JP", "Tokyo"], 2], [["NG", "Lagos"], 1], [["PK", "Karachi"], 1], [[" ", null], 1],
];
const LANGS: (readonly [string, number])[] = [["en-US", 44], ["en-GB", 16], ["de-DE", 8], ["bn-BD", 7], ["fr-FR", 4], ["es-ES", 4], ["ja-JP", 2], ["nl-NL", 3], ["pt-BR", 2], ["en-IN", 7], ["sv-SE", 2]];
const ENTRY: (readonly [string, number])[] = [["/", 60], ["/work", 16], ["/about", 10], ["/book", 5], ["/work/northwind-analytics", 4], ["/work/tidal-brand-identity", 3], ["/work/lumen-banking-app", 2]];
const NEXT: (readonly [string, number])[] = [["/work", 34], ["/about", 24], ["/book", 12], ["/", 12], ["/work/cobalt-crm", 6], ["/work/vertex-ai-assistant", 6], ["/work/prism-design-system", 6]];

function device(): { device: string; browser: string; os: string; screen_w: number } {
  const kind = weighted([["desktop", 58], ["mobile", 38], ["tablet", 4]] as const);
  if (kind === "desktop") {
    const os = weighted([["macOS", 46], ["Windows", 44], ["Linux", 7], ["ChromeOS", 3]] as const);
    const browser = os === "macOS" ? weighted([["Chrome", 55], ["Safari", 35], ["Firefox", 6], ["Arc", 4]] as const) : weighted([["Chrome", 70], ["Edge", 18], ["Firefox", 12]] as const);
    return { device: kind, browser, os, screen_w: pick([1280, 1366, 1440, 1440, 1536, 1680, 1920, 1920, 2560]) };
  }
  if (kind === "tablet") return { device: kind, browser: "Safari", os: "iPadOS", screen_w: pick([768, 810, 820, 1024]) };
  const os = weighted([["iOS", 55], ["Android", 45]] as const);
  return { device: kind, browser: os === "iOS" ? "Safari" : weighted([["Chrome", 80], ["Samsung Internet", 20]] as const), os, screen_w: pick([360, 375, 390, 393, 412, 430]) };
}

/* ---------------------------------------------------------------- seed */

export function seed(d: Database): void {
  rand = mulberry32(20260927);
  const now = Date.now();

  insert(d, "settings", Object.entries(SETTINGS).map(([key, value]) => ({ key, value, updated_at: sqlTime(now - int(1, 40) * DAY) })));

  /* ---- the media library: every file the rest points at */
  const media: Row[] = [
    { id: "media-avatar", key: "brand/avatar.webp", filename: "avatar.webp", mime: "image/webp", size: 1862, width: 148, height: 148, created_at: sqlTime(now - 210 * DAY), original_size: 48_210, fallback_key: null, optimized: 1 },
  ];
  files.forEach((f, i) => {
    const raster = f.mime === "image/webp";
    media.push({
      id: `media-${i}`,
      key: f.key,
      filename: f.filename,
      mime: f.mime,
      size: f.size,
      width: f.width,
      height: f.height,
      created_at: sqlTime(now - between(2, 200) * DAY),
      original_size: raster ? Math.round(f.size * between(3.5, 9)) : f.size,
      fallback_key: null,
      optimized: 1,
    });
  });
  insert(d, "media", media);

  /* ---- work */
  insert(d, "categories", CATEGORIES.map(([id, title], i) => ({ id: `cat-${id}`, title, slug: slugify(title), icon: null, icon_animated: null, icon_active: null, position: i })));
  const home = new Set([0, 1, 2, 4, 5, 8, 15, 18, 26]);
  insert(
    d,
    "works",
    PROJECTS.map(([title, cat], i) => ({
      id: `work-${i + 1}`,
      title,
      slug: slugify(title),
      category_id: `cat-${cat}`,
      cover: `demo/covers/${slugify(title)}.webp`,
      preview_video: null,
      client: title.split(" ")[0],
      year: String(new Date(now).getFullYear() - Math.floor(i / 9)),
      summary: SUMMARIES[i % SUMMARIES.length],
      live_link: chance(0.4) ? `https://example.com/${slugify(title)}` : null,
      show_on_homepage: home.has(i) ? 1 : 0,
      position: i,
      created_at: sqlTime(now - (PROJECTS.length - i) * 9 * DAY),
    })),
  );

  insert(
    d,
    "clients",
    CLIENTS.map((name, i) => ({
      id: `client-${i + 1}`,
      name,
      logo: `demo/logos/${name.toLowerCase()}.svg`,
      width: Math.round((60 + name.length * 19) / 2.2),
      height: 36,
      row_index: i < 8 ? 0 : 1,
      position: i % 8,
    })),
  );

  insert(
    d,
    "photos",
    files
      .filter((f) => f.kind === "photo")
      .map((f, i) => ({ id: `photo-${i + 1}`, src: f.key, alt: (f as { alt?: string }).alt ?? "", position: i })),
  );

  /* ---- about */
  insert(d, "experience", ROLES.map(([role, company, period], i) => ({ id: `role-${i + 1}`, role, company, period, position: i })));
  insert(d, "awards", AWARDS.map(([name, count, badge], i) => ({ id: `award-${i + 1}`, name, count, badge, href: "https://www.behance.net/jubayer10", position: i })));

  /* ---- plans */
  insert(
    d,
    "plans",
    PLANS.map((p, i) => ({
      id: p.id, name: p.name, blurb: p.blurb, badge: p.badge, monthly_price: p.monthly_price, trial_label: p.trial_label,
      trial_price: p.trial_price, trial_discount: 50, cta_label: "Intro Call", cta_href: null, position: i, cta_icon: "googleMeet", icon: p.icon,
    })),
  );
  insert(d, "plan_features", PLANS.flatMap((p) => p.features.map((text, j) => ({ id: `${p.id}-f${j + 1}`, plan_id: p.id, text, position: j }))));

  /* ---- words from clients, questions */
  insert(
    d,
    "testimonials",
    PEOPLE.map(([name, role, company], i) => ({
      id: `quote-${i + 1}`,
      quote: QUOTES[i],
      name,
      role: `${role}, ${company}`,
      avatar: `demo/avatars/${slugify(name)}.webp`,
      position: i,
    })),
  );
  insert(d, "faqs", FAQS.map(([question, answer], i) => ({ id: `faq-${i + 1}`, question, answer, position: i })));

  /* ---- a year of visits and clicks */
  const views: Row[] = [];
  const events: Row[] = [];
  const sessions: { id: string; ts: number }[] = [];
  const visitors: string[] = [];
  let v = 0;
  let e = 0;

  for (let day = 365; day >= 0; day--) {
    const date = new Date(now - day * DAY);
    const growth = 6 + (365 - day) * 0.05 + (day < 60 ? (60 - day) * 0.12 : 0); // busier over the year, more so lately
    const weekend = date.getUTCDay() === 0 || date.getUTCDay() === 6 ? 0.65 : 1;
    const launch = day > 110 && day < 118 ? 2.4 : 1; // a feature on a gallery, some months ago
    const count = Math.max(1, Math.round(growth * weekend * launch * between(0.7, 1.3)));

    for (let n = 0; n < count; n++) {
      const start = now - day * DAY - between(0, DAY) + (day === 0 ? 0 : 0);
      if (start > now) continue;
      const returning = visitors.length > 20 && chance(0.22);
      const visitor = returning ? pick(visitors) : `vis-${hex(10)}`;
      if (!returning) visitors.push(visitor);
      const session = `ses-${hex(12)}`;
      sessions.push({ id: session, ts: start });
      const source = weighted(SOURCES);
      const [country, city] = weighted(PLACES);
      const who = device();
      const lang = weighted(LANGS);
      const internal = chance(0.015) ? 1 : 0;
      const pages = weighted([[1, 48], [2, 26], [3, 14], [4, 8], [5, 4]] as const);

      let t = start;
      let path = weighted(ENTRY);
      let converted = false;
      for (let p = 0; p < pages; p++) {
        const id = `view-${++v}`;
        const duration = Math.round(Math.min(900_000, Math.exp(between(8.3, 12.6))));
        views.push({
          id, ts: Math.round(t), visitor, session, path,
          referrer: p === 0 ? source.referrer : null,
          utm_source: p === 0 && source.utm ? source.utm[0] : null,
          utm_medium: p === 0 && source.utm ? source.utm[1] : null,
          utm_campaign: p === 0 && source.utm ? source.utm[2] : null,
          utm_term: null, utm_content: null,
          country: country.trim() || null, region: null, city,
          device: who.device, browser: who.browser, os: who.os, screen_w: who.screen_w, lang,
          duration_ms: duration, scroll_pct: path === "/" ? int(15, 100) : int(30, 100), internal,
        });

        const ev = (name: string, extra: Partial<Row> = {}) =>
          events.push({ id: `ev-${++e}`, ts: Math.round(t + between(2_000, Math.max(3_000, duration))), visitor, session, view_id: id, name, path, location: null, label: null, plan: null, target: null, href: null, internal, ...extra });

        if (path === "/" && chance(0.42)) ev("section_view", { location: "pricing" });
        if (!converted && chance(path === "/book" ? 0.3 : 0.075)) {
          converted = true;
          const location = weighted([["sidebar", 38], ["pricing", 30], ["cta", 16], ["work", 10], ["about", 6]] as const);
          const call = chance(0.72);
          ev("cta_click", {
            location,
            label: call ? "Intro Call" : "Message",
            plan: location === "pricing" ? weighted([["Starter", 40], ["Growth", 45], ["Custom", 15]] as const) : null,
            target: call ? "booking" : "whatsapp",
            href: call ? "/book" : "https://wa.me/10000000000",
          });
          if (call) {
            ev("booking_open", { location });
            if (chance(0.55)) ev("booking_time", { location });
          }
        }
        t += duration + between(1_000, 20_000);
        path = weighted(NEXT);
      }
    }
  }

  // a few people on the site right now
  for (let n = 0; n < 3; n++) {
    const who = device();
    views.push({
      id: `view-${++v}`, ts: now - int(20, 170) * 1000, visitor: `vis-${hex(10)}`, session: `ses-${hex(12)}`, path: pick(["/", "/work", "/about"]),
      referrer: pick(["google.com", null, "linkedin.com"]), utm_source: null, utm_medium: null, utm_campaign: null, utm_term: null, utm_content: null,
      country: pick(["US", "GB", "DE"]), region: null, city: null, device: who.device, browser: who.browser, os: who.os, screen_w: who.screen_w,
      lang: "en-US", duration_ms: int(60_000, 240_000), scroll_pct: int(20, 80), internal: 0,
    });
  }

  insert(d, "analytics_views", views);
  insert(d, "analytics_events", events);

  /* ---- bookings, tied to real-looking sessions for "came from" */
  const bookings: Row[] = [];
  const recentSessions = sessions.filter((s) => s.ts > now - 170 * DAY);
  for (let n = 0; n < 104; n++) {
    // booked any day in the last five months, for a call a few days to two
    // weeks later; the last fourteen are the calls still coming up
    const upcoming = n >= 90;
    const created = upcoming ? now - between(2 / 24, 10) * DAY : now - between(2 / 24, 150) * DAY;
    const start = Math.round((upcoming ? now + between(0.2, 21) * DAY : created + between(1, 14) * DAY) / (30 * 60_000)) * 30 * 60_000;
    const first = pick(FIRST);
    const last = pick(LAST);
    const company = `${pick(COMPANY_WORDS)}${pick(["labs", "hq", "studio", "app", "works", "co"])}`;
    const cancelled = chance(upcoming ? 0.05 : 0.11);
    const noName = chance(0.04);
    const needs = [...new Set(Array.from({ length: weighted([[1, 50], [2, 35], [3, 15]] as const) }, () => pick(NEEDS)))];
    const session = recentSessions.length && chance(0.85) ? pick(recentSessions).id : null;
    bookings.push({
      id: `bk-${hex(10)}`,
      created_at: created,
      updated_at: created + int(0, 48) * HOUR,
      status: cancelled ? "cancelled" : "booked",
      name: noName ? null : `${first} ${last}`,
      email: `${first.toLowerCase()}@${company}.example`,
      needs: chance(0.92) ? needs.join(", ") : null,
      plan: weighted([["Starter", 30], ["Growth", 34], ["Custom", 16], [null, 20]] as const),
      note: chance(0.55) ? pick(NOTES) : null,
      session,
      ip_hash: hex(16),
      source: chance(0.14) ? "cal.com" : "site",
      cal_uid: `cal-${hex(16)}`,
      start_time: start,
      end_time: start + 30 * 60_000,
      timezone: pick(TIMEZONES),
      meet_url: `https://meet.google.com/${hex(3)}-${hex(4)}-${hex(3)}`,
      rescheduled: chance(0.1) ? 1 : 0,
      cancel_reason: cancelled ? pick(CANCEL_REASONS) : null,
    });
  }
  insert(d, "bookings", bookings);

  /* ---- the Cal.com webhook, connected */
  insert(d, "secrets", [
    { key: "cal.webhookSecret", value: `whsec_${hex(48)}`, updated_at: now - 120 * DAY },
    { key: "cal.lastEvent", value: "BOOKING_RESCHEDULED", updated_at: now - int(2, 9) * HOUR },
  ]);
}
