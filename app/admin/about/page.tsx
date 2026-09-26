"use client";

import { AUTHOR_URL } from "../demo";
import { getSettings } from "@/lib/content";
import { all, env, mediaUrl, useDatabase } from "@/lib/db";
import { deleteAward, deleteRole, saveAward, saveRole, saveSettings } from "../actions";
import { Item, SortableRows } from "../List";
import { FormModal } from "../Modal";
import { SectionHead, SectionNav } from "../Sections";
import { StickySave } from "../StickySave";
import { MediaField } from "../MediaField";
import { Actions, Card, DeleteButton, Field, PageHead, SaveButton, TextArea, adminStyles as s } from "../ui";

type Role = { id: string; role: string; company: string; period: string; position: number };
type Award = { id: string; name: string; count: string; badge: string | null; href: string | null; position: number };

/** Everything on /about: the text in one form, then the two lists. */
export default function AboutAdmin() {
  useDatabase();
  const [v, roles, awards, e] = [
    getSettings(),
    all<Role>("SELECT * FROM experience ORDER BY position"),
    all<Award>("SELECT * FROM awards ORDER BY position"),
    env(),
  ] as const;
  const base = e.MEDIA_BASE_URL || undefined;

  const roleForm = (x?: Role) => (
    <form action={saveRole}>
      {x && <input type="hidden" name="id" value={x.id} />}
      <div className={s.grid2}>
        <Field label="Role" name="role" defaultValue={x?.role} required />
        <Field label="Company" name="company" defaultValue={x?.company} />
        <Field label="Dates" name="period" defaultValue={x?.period} placeholder="Jan 2024 - Present" />
      </div>
      <Actions>
        <SaveButton label={x ? "Save" : "Add role"} />
        {x && <DeleteButton action={deleteRole} id={x.id} />}
      </Actions>
    </form>
  );

  const awardForm = (x?: Award) => (
    <form action={saveAward}>
      {x && <input type="hidden" name="id" value={x.id} />}
      <div className={s.grid2}>
        <MediaField label="Badge" name="badge" defaultValue={x?.badge} shape="square" max={120}
                    accept="image/png,image/webp,image/svg+xml" hint="The ribbon, 31 × 57 on the page. Upload it at twice that" />
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="Gallery" name="name" defaultValue={x?.name} placeholder="UI/UX" required />
          <Field label="Times featured" name="count" defaultValue={x?.count} placeholder="Featured 7x" />
          <Field label="Link" name="href" defaultValue={x?.href} placeholder="https://www.behance.net/…" />
        </div>
      </div>
      <Actions>
        <SaveButton label={x ? "Save" : "Add award"} />
        {x && <DeleteButton action={deleteAward} id={x.id} />}
      </Actions>
    </form>
  );

  return (
    <>
      <PageHead title="About page" note="The page linked from “More About Me” and the footer. Its avatar and buttons come from Text & labels; the lists below save as you change them.">
        <a className={s.btn} href={`${AUTHOR_URL}/about`} target="_blank" rel="noreferrer" title="The live site's About page">
          View live page
        </a>
      </PageHead>
      <SectionNav items={[
        { id: "left", label: "Left column" },
        { id: "story", label: "My story" },
        { id: "headings", label: "Section headings" },
        { id: "experience", label: "Experience" },
        { id: "awards", label: "Behance awards" },
      ]} />

      <form action={saveSettings}>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <Card title="Left column" id="left">
            <TextArea label="Headline" name="about.title" defaultValue={v["about.title"]} rows={2} />
            <div style={{ height: 14 }} />
            <TextArea label="Intro" name="about.subtitle" defaultValue={v["about.subtitle"]} rows={3} />
            <div style={{ height: 14 }} />
            <div className={s.grid2}>
              <Field label="Recognition label" name="about.recognitionLabel" defaultValue={v["about.recognitionLabel"]} placeholder="Recognition:" />
              <Field label="Experience label" name="about.experienceLabel" defaultValue={v["about.experienceLabel"]} placeholder="Experience:" />
              <TextArea label="Recognition" name="about.recognition" defaultValue={v["about.recognition"]} rows={2} />
              <TextArea label="Experience" name="about.experienceSummary" defaultValue={v["about.experienceSummary"]} rows={2} />
              <Field label="Recognition link text" name="about.recognitionLinkLabel" defaultValue={v["about.recognitionLinkLabel"]} placeholder="View Behance" />
              <Field label="Recognition link" name="about.recognitionLinkHref" defaultValue={v["about.recognitionLinkHref"]}
                     hint="Empty hides the link" />
            </div>
          </Card>

          <Card title="My story" id="story">
            <Field label="Heading" name="about.storyTitle" defaultValue={v["about.storyTitle"]} />
            <div style={{ height: 14 }} />
            <TextArea label="Story" name="about.story" defaultValue={v["about.story"]} rows={10}
                      hint="Leave an empty line between paragraphs" />
          </Card>

          <Card title="Section headings" id="headings">
            <div className={s.grid2}>
              <Field label="Experience heading" name="about.experienceTitle" defaultValue={v["about.experienceTitle"]} />
              <Field label="Experience line" name="about.experienceNote" defaultValue={v["about.experienceNote"]} />
              <Field label="Awards heading" name="about.awardsTitle" defaultValue={v["about.awardsTitle"]} />
              <Field label="Awards line" name="about.awardsNote" defaultValue={v["about.awardsNote"]} />
              <Field label="Profile link text" name="about.awardsLinkLabel" defaultValue={v["about.awardsLinkLabel"]} />
              <Field label="Profile link" name="about.awardsLinkHref" defaultValue={v["about.awardsLinkHref"]} />
              <Field label="Gallery heading" name="about.galleryTitle" defaultValue={v["about.galleryTitle"]} />
              <Field label="Gallery line" name="about.galleryNote" defaultValue={v["about.galleryNote"]}
                     hint="The gallery uses the photos from Photos" />
            </div>
          </Card>
        </div>
        <StickySave label="Save text" />
      </form>

      <SectionHead id="experience" title="Experience" note="The roles on the page, top to bottom.">
        <FormModal label="Add role" title="Add a role" done="Role added">
          {roleForm()}
        </FormModal>
      </SectionHead>
      {roles.length === 0 ? <p className={s.empty}>No roles yet.</p> : (
        <SortableRows table="experience" ids={roles.map((x) => x.id)} label="roles">
          {roles.map((x) => (
            <Item key={x.id} id={x.id} title={x.role} meta={[x.company, x.period].filter(Boolean).join(" · ")}>
              {roleForm(x)}
            </Item>
          ))}
        </SortableRows>
      )}

      <SectionHead id="awards" title="Behance awards" note="The badges in the awards band, left to right.">
        <FormModal label="Add award" title="Add an award" done="Award added">
          {awardForm()}
        </FormModal>
      </SectionHead>
      {awards.length === 0 ? <p className={s.empty}>No awards yet.</p> : (
        <SortableRows table="awards" ids={awards.map((x) => x.id)} label="awards">
          {awards.map((x) => (
            <Item key={x.id} id={x.id} title={x.name} meta={x.count} thumb={mediaUrl(x.badge, base)}>
              {awardForm(x)}
            </Item>
          ))}
        </SortableRows>
      )}
    </>
  );
}
