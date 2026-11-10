// The process stops: the editor's static server goes with it.
export default async function (ctx: Context) {
    (ctx.state as any).uigma?.server?.stop?.();
}
