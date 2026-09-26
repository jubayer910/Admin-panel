"use client";

import { all, env, mediaUrl, useDatabase } from "@/lib/db";
import { deleteCategory, saveCategory } from "../actions";
import { Item, More, SortableRows } from "../List";
import { FormModal } from "../Modal";
import { MediaField } from "../MediaField";
import { Actions, DeleteButton, Field, PageHead, SaveButton, adminStyles as s } from "../ui";

type Row = {
  id: string; title: string; slug: string;
  icon: string | null; icon_animated: string | null; icon_active: string | null;
  position: number;
};

export default function CategoriesPage() {
  useDatabase();
  const [rows, e] = [
    all<Row>("SELECT * FROM categories ORDER BY position"),
    env(),
  ] as const;
  const base = e.MEDIA_BASE_URL || undefined;

  const form = (c?: Row) => (
    <form action={saveCategory}>
      {c && <input type="hidden" name="id" value={c.id} />}

      <Field label="Name" name="title" defaultValue={c?.title} required />
      <div style={{ height: 14 }} />

      <div className={s.mediaRow}>
        <MediaField label="Icon: idle" name="icon" defaultValue={c?.icon}
                    shape="square" max={60} hint="Still image" />
        <MediaField label="Icon: hover" name="icon_animated" defaultValue={c?.icon_animated}
                    shape="square" max={60} hint="GIF, plays on hover. Stays a GIF, scaled down to 60px" />
        <MediaField label="Icon: active" name="icon_active" defaultValue={c?.icon_active}
                    shape="square" max={60} hint="GIF, plays while selected. Stays a GIF, scaled down to 60px" />
      </div>

      {c && (
        <More>
          <Field label="URL slug" name="slug" defaultValue={c.slug}
                 hint="Made from the name. Change it only if you need to" />
        </More>
      )}

      <Actions>
        <SaveButton label={c ? "Save" : "Add category"} />
        {c && <DeleteButton action={deleteCategory} id={c.id} />}
      </Actions>
    </form>
  );

  return (
    <>
      <PageHead title="Categories"
        note="The filter tabs on the work page. Each can have three icons: idle, hover and selected.">
        <FormModal label="Add category" title="Add a category" done="Category added">
          {form()}
        </FormModal>
      </PageHead>
      {rows.length === 0 ? <p className={s.empty}>No categories yet.</p> : (
        <SortableRows table="categories" ids={rows.map((r) => r.id)} label="categories">
          {rows.map((c) => (
            <Item key={c.id} table="categories" id={c.id} title={c.title}
                  thumb={mediaUrl(c.icon_active ?? c.icon_animated ?? c.icon, base)}>
              {form(c)}
            </Item>
          ))}
        </SortableRows>
      )}
    </>
  );
}
