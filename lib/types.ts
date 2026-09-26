/* Data models - BUILD-SPEC.md §9
   Mirrors the two Framer CMS collections. */

export type Category = {
  id: string;
  title: string;
  slug: string;
  /** still image, shown by default */
  icon?: string;
  /** GIF, plays on hover */
  iconAnimated?: string;
  /** GIF, plays while this tab is the active filter */
  iconActive?: string;
  order: number;
};

export type Work = {
  id: string;
  title: string;
  slug: string;
  /** → Category.id */
  category: string;
  cover: string;
  client?: string;
  year?: string;
  summary?: string;
  /** rich text / MDX */
  content?: string;
  liveLink?: string;
  /** homepage shows only the ones flagged here */
  showOnHomepage: boolean;
  order: number;
  /** when present the card plays this instead of showing `cover` */
  previewVideo?: string;
  /** its MIME type with the codec, when known, for an exact <source type> */
  previewVideoType?: string;
  /** an MP4 of the same video, for browsers that cannot play the WebM */
  previewVideoFallback?: string;
};

export type Plan = {
  id: string;
  name: string;
  blurb: string;
  /** monthly retainer; omit for the enquiry-only plan */
  monthlyPrice?: number;
  trial?: {
    label: string;
    price: number;
    /** taken off the trial price when the switch is on */
    discount: number;
  };
  features: string[];
  badge?: string;
  /** the 48px line icon above the name */
  icon?: string;
  /** href falls back to the site-wide Message / Intro Call link when empty */
  cta: { label: string; href?: string; icon: BrandIcon };
};

export type Testimonial = {
  quote: string;
  name: string;
  role: string;
  avatar: string;
};

export type Faq = {
  question: string;
  answer: string;
};

export type BrandIcon = "none" | "telegram" | "whatsapp" | "googleMeet";
