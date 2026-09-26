"use client";

import { useSearchParams } from "next/navigation";
import { all, env, mediaUrl, useDatabase } from "@/lib/db";
import { deleteWork, saveWork } from "../actions";
import { FormGuard } from "../FormGuard";
import { More } from "../List";
import { FormModal } from "../Modal";
import { MediaField } from "../MediaField";
import {
  Actions,
  Check,
  DeleteButton,
  Field,
  PageHead,
  SaveButton,
  Select,
  TextArea,
  adminStyles as s,
} from "../ui";

import { WorksBoard, type BoardItem } from "./WorksBoard";

type Row = {
  id: string;
  title: string;
  slug: string;
  category_id: string | null;
  cover: string | null;
  preview_video: string | null;
  client: string | null;
  year: string | null;
  summary: string | null;
  live_link: string | null;
  show_on_homepage: number;
  position: number;
};

export default function WorksPage() {
  useDatabase();
  const add = useSearchParams().get("add") ?? undefined;

  const [works, categories, e] = [
    all<Row>("SELECT * FROM works ORDER BY position"),
    all<{ id: string; title: string }>(
      "SELECT id, title FROM categories ORDER BY position",
    ),
    env(),
  ] as const;
  const base = e.MEDIA_BASE_URL || undefined;

  const categoryOptions = [
    { value: "", label: "None" },
    ...categories.map((c) => ({ value: c.id, label: c.title })),
  ];

  const form = (w?: Row) => (
    <form action={saveWork}>
      {w && <input type="hidden" name="id" value={w.id} />}

      <Field label="Title" name="title" defaultValue={w?.title} required />
      <div style={{ height: 14 }} />

      <div className={s.mediaRow}>
        <MediaField
          label="Cover"
          name="cover"
          defaultValue={w?.cover}
          max={2400}
          hint="Shown in the grid. Converted to WebP."
        />
        <MediaField
          label="Video (optional)"
          name="preview_video"
          defaultValue={w?.preview_video}
          accept="video/mp4,video/webm,video/quicktime"
          hint="Plays instead of the cover. Converted to WebM + MP4 in this browser before upload. Use Chrome."
        />
      </div>

      <div style={{ height: 14 }} />
      <div className={s.grid2}>
        <Select
          label="Category"
          name="category_id"
          defaultValue={w?.category_id}
          options={categoryOptions}
        />
        {w ? (
          <div />
        ) : (
          <Select
            label="Place it"
            name="place"
            defaultValue="top"
            options={[
              { value: "top", label: "At the top of the list" },
              { value: "end", label: "At the end of the list" },
            ]}
            hint="You can drag it anywhere afterwards"
          />
        )}
      </div>

      <div style={{ height: 14 }} />
      <TextArea label="Summary" name="summary" defaultValue={w?.summary} />

      <More>
        <div className={s.grid2}>
          <Field label="Client" name="client" defaultValue={w?.client} />
          <Field label="Year" name="year" defaultValue={w?.year} />
          <Field label="Live link" name="live_link" defaultValue={w?.live_link} />
          {w && (
            <Field
              label="URL slug"
              name="slug"
              defaultValue={w.slug}
              hint="Made from the title. Change it only if you need to"
            />
          )}
        </div>
      </More>

      <Actions>
        <FormGuard requireOneOf={["cover", "preview_video"]} message="Add a cover image or a video first." />
        <Check
          label="Show on homepage"
          name="show_on_homepage"
          defaultChecked={w ? w.show_on_homepage === 1 : false}
        />
        <div style={{ flex: 1 }} />
        <SaveButton label={w ? "Save" : "Add project"} />
        {w && <DeleteButton action={deleteWork} id={w.id} />}
      </Actions>
    </form>
  );

  // a resized copy for the thumbnails; GIFs and SVGs as they are
  const thumb = (key: string | null) => {
    const url = mediaUrl(key, base);
    return url && url.startsWith("/media/") && !/\.(gif|svg)$/i.test(url) ? `${url}?w=640` : url;
  };

  const items: BoardItem[] = works.map((w) => {
    const cat = categories.find((c) => c.id === w.category_id);
    return {
      id: w.id,
      title: w.title,
      categoryId: cat?.id ?? null,
      categoryTitle: cat?.title ?? null,
      image: w.cover ? thumb(w.cover) : null,
      video: !w.cover && w.preview_video ? mediaUrl(w.preview_video, base) : null,
      hasVideo: !!w.preview_video,
      onHomepage: w.show_on_homepage === 1,
      form: form(w),
    };
  });

  return (
    <>
      <PageHead
        title="Projects"
        note="Drag to set the order; switch Homepage on for the ones the homepage shows."
      >
        <FormModal label="Add project" title="Add a project" description="An image or a video, a title and a category is all it needs." done="Project added" defaultOpen={add === "1"}>
          {form()}
        </FormModal>
      </PageHead>

      <WorksBoard items={items} categories={categories} />
    </>
  );
}
