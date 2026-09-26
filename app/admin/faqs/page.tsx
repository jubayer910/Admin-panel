"use client";

import { all, useDatabase } from "@/lib/db";
import { deleteFaq, saveFaq } from "../actions";
import { Item, SortableRows } from "../List";
import { FormModal } from "../Modal";
import { Actions, DeleteButton, Field, PageHead, SaveButton, TextArea, adminStyles as s } from "../ui";

type Row = { id: string; question: string; answer: string; position: number };

export default function FaqsPage() {
  useDatabase();
  const rows = all<Row>("SELECT * FROM faqs ORDER BY position");

  const form = (f?: Row) => (
    <form action={saveFaq}>
      {f && <input type="hidden" name="id" value={f.id} />}
      <Field label="Question" name="question" defaultValue={f?.question} required />
      <div style={{ height: 14 }} />
      <TextArea label="Answer" name="answer" defaultValue={f?.answer} rows={5} />
      <Actions>
        <SaveButton label={f ? "Save" : "Add question"} />
        {f && <DeleteButton action={deleteFaq} id={f.id} />}
      </Actions>
    </form>
  );

  return (
    <>
      <PageHead title="FAQs"
        note="The accordion at the foot of the homepage. The first one is open by default. Move a question to the top to feature it.">
        <FormModal label="Add question" title="Add a question" done="Question added">
          {form()}
        </FormModal>
      </PageHead>
      {rows.length === 0 ? <p className={s.empty}>No questions yet.</p> : (
        <SortableRows table="faqs" ids={rows.map((r) => r.id)} label="questions">
          {rows.map((f) => (
            <Item key={f.id} table="faqs" id={f.id} title={f.question}
                  meta={f.answer.slice(0, 90)}>
              {form(f)}
            </Item>
          ))}
        </SortableRows>
      )}
    </>
  );
}
