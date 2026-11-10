// A Uigma document: the file a canvas tab edits, by name. Its bytes (.fig / .jam, OpenPencil's Figma-compatible
// format) are on disk, one file per revision, under the data folder; this row says which revision is current.
export default {
    async up(ctx: Context) {
        await ctx.fns.procs.db.exec({
            sql: `create table if not exists uigma_docs (
                name       text primary key,
                type       text not null,                       -- design | board
                rev        integer not null default 0,
                size       integer not null default 0,
                summary    jsonb not null default '{}'::jsonb,  -- {pages: [{name, layers}]} as the editor counted them
                source     text,                                -- a .fig/.jam file the document started from
                updated_by text,
                created_at bigint not null,
                updated_at bigint not null
            )`,
        });
    },
    async down(ctx: Context) {
        await ctx.fns.procs.db.exec({ sql: `drop table if exists uigma_docs` });
    },
};
