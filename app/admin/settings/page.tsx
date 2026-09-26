"use client";

import { getSettings } from "@/lib/content";
import { useDatabase } from "@/lib/db";
import { saveSettings } from "../actions";
import { MediaField } from "../MediaField";
import { SectionNav } from "../Sections";
import { StickySave } from "../StickySave";
import {
  Card,
  Field,
  PageHead,
  Select,
  TextArea,
  adminStyles as s,
} from "../ui";

export default function SettingsPage() {
  useDatabase();
  const v = getSettings();

  return (
    <>
      <PageHead
        title="Text & labels"
        note="The one-off strings across the site. Avatar, section headings, the sidebar copy, where the buttons point and the ad pixels."
      />

      <SectionNav items={[
        { id: "brand", label: "Brand" },
        { id: "hero", label: "Hero" },
        { id: "buttons", label: "Buttons" },
        { id: "cta", label: "Call to action" },
        { id: "footer", label: "Footer" },
        { id: "seo", label: "Search & sharing" },
        { id: "tracking", label: "Tracking" },
        { id: "sidebar", label: "Sidebar blocks" },
        { id: "headings", label: "Section headings" },
      ]} />

      <form action={saveSettings}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Card title="Brand" id="brand">
            <div className={s.grid2}>
              <MediaField
                label="Avatar"
                name="brand.avatar"
                defaultValue={v["brand.avatar"]}
                shape="square"
                max={256}
                hint="The round photo at the top of every page. Converted to WebP."
              />
            </div>
          </Card>

          <Card title="Hero" id="hero">
            <TextArea label="Headline" name="hero.title" defaultValue={v["hero.title"]} rows={2} />
            <div style={{ height: 14 }} />
            <TextArea label="Intro" name="hero.intro" defaultValue={v["hero.intro"]} rows={3}
                      hint="The first lines under the headline" />
            <div style={{ height: 14 }} />
            <Field label="About link text" name="hero.aboutLabel" defaultValue={v["hero.aboutLabel"]}
                   placeholder="More About Me" hint="Under the intro; opens the About page" />
            <div style={{ height: 14 }} />
            <TextArea label="Paragraph" name="hero.paragraph1" defaultValue={v["hero.paragraph1"]} rows={4} />
            {/* the design has one paragraph: the old second one was folded into
                this field, and saving clears what is left of it */}
            <input type="hidden" name="hero.paragraph2" value="" />
          </Card>

          <Card title="Buttons" id="buttons">
            <div className={s.grid2}>
              <Select
                label="Message button goes to"
                name="cta.messageIcon"
                defaultValue={v["cta.messageIcon"] || "whatsapp"}
                options={[
                  { value: "whatsapp", label: "WhatsApp" },
                  { value: "telegram", label: "Telegram" },
                ]}
                hint="Sets the icon on the light button, in the sidebar and on /work"
              />
              <Field
                label="Message link"
                name="cta.messageHref"
                defaultValue={v["cta.messageHref"]}
                placeholder="https://wa.me/8801XXXXXXXXX"
                hint="WhatsApp: https://wa.me/ + number with country code · Telegram: https://t.me/username"
              />
              <Field
                label="Message label"
                name="cta.messageLabel"
                defaultValue={v["cta.messageLabel"]}
                placeholder="Message"
              />
              <div />
              <Field
                label="Intro Call label"
                name="cta.callLabel"
                defaultValue={v["cta.callLabel"]}
                placeholder="Intro Call"
              />
              <Field
                label="Intro Call link"
                name="cta.callHref"
                defaultValue={v["cta.callHref"]}
                placeholder="/book"
                hint="Empty sends the dark button to the site's own booking page (/book, set up under Bookings). Pricing cards without their own link use it too."
              />
            </div>
          </Card>

          <Card title="Call to action" id="cta">
            <TextArea label="Heading" name="cta.title" defaultValue={v["cta.title"]} rows={2}
                      hint="One line per row. The buttons are the Message and Intro Call ones above." />
          </Card>

          <Card title="Footer" id="footer">
            <div className={s.grid2}>
              <Field label="Copyright" name="footer.copyright" defaultValue={v["footer.copyright"]} />
              <Field label="Email" name="footer.email" defaultValue={v["footer.email"]} />
              <Field label="LinkedIn" name="footer.linkedin" defaultValue={v["footer.linkedin"]} placeholder="https://www.linkedin.com/in/…" />
              <Field label="Behance" name="footer.behance" defaultValue={v["footer.behance"]} placeholder="https://www.behance.net/…" />
            </div>
          </Card>

          <Card title="Search & sharing" id="seo">
            <Field
              label="Page title"
              name="seo.title"
              defaultValue={v["seo.title"]}
              hint="The home page's title in Google and on shared links, about 60 characters. Other pages use “Page | your name”."
            />
            <div style={{ height: 14 }} />
            <TextArea
              label="Description"
              name="seo.description"
              defaultValue={v["seo.description"]}
              rows={3}
              hint="About 150 characters. The share image is public/og-image.jpg (1200 × 630)."
            />
          </Card>

          <Card title="Tracking" id="tracking">
            <div className={s.grid2}>
              <Field
                label="Meta Pixel ID"
                name="tracking.metaPixelId"
                defaultValue={v["tracking.metaPixelId"]}
                placeholder="123456789012345"
                hint="Digits only, from Events Manager › Data sources. Every button click is sent as Schedule (booking) or Contact (WhatsApp / Telegram), plus a CTAClick event with the plan name."
              />
              <Field
                label="Google Analytics 4 ID"
                name="tracking.ga4Id"
                defaultValue={v["tracking.ga4Id"]}
                placeholder="G-XXXXXXXXXX"
                hint="Optional. Clicks arrive as a cta_click event with the plan name."
              />
            </div>
          </Card>

          <Card title="Sidebar blocks" id="sidebar">
            <div className={s.grid2}>
              <Field label="Clients label" name="clients.label" defaultValue={v["clients.label"]} />
              <Field
                label="After the first logo row"
                name="clients.more"
                defaultValue={v["clients.more"]}
                placeholder="50+ more"
                hint="The small pill after the last logo. Empty hides it."
              />
              <Field label="Photo row label" name="creativeCore.label" defaultValue={v["creativeCore.label"]} />
              <Field label="Pricing label" name="pricing.label" defaultValue={v["pricing.label"]} />
              <Field label="Perks label" name="perks.label" defaultValue={v["perks.label"]} />
            </div>
            <div style={{ height: 14 }} />
            <TextArea label="Pricing body" name="pricing.body" defaultValue={v["pricing.body"]} />
            <div style={{ height: 14 }} />
            <div className={s.grid2}>
              <Field label="Pricing link label" name="pricing.linkLabel" defaultValue={v["pricing.linkLabel"]} />
              <Field label="Pricing link target" name="pricing.linkHref" defaultValue={v["pricing.linkHref"]} />
            </div>
            <div style={{ height: 14 }} />
            <TextArea label="Perks body" name="perks.body" defaultValue={v["perks.body"]} />
          </Card>

          <Card title="Section headings" id="headings">
            <div className={s.grid2}>
              <Field label="Work heading" name="work.title" defaultValue={v["work.title"]} />
              <Field label="Offers eyebrow" name="offers.eyebrow" defaultValue={v["offers.eyebrow"]} />
              <Field label="Offers heading" name="offers.title" defaultValue={v["offers.title"]} />
              <Field label="Testimonials heading" name="testimonials.title" defaultValue={v["testimonials.title"]} />
              <Field label="FAQ heading" name="faqs.title" defaultValue={v["faqs.title"]} />
            </div>
          </Card>
        </div>

        <StickySave />
      </form>
    </>
  );
}
