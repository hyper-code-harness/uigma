/** A Uigma document as kept in uigma_docs: the current revision of a named design file or board. */
export type Doc = {
    /** Document name: letters, digits, - and _. */
    name: string;
    /** design (a Figma-like file) or board (FigJam-like). */
    type: "design" | "board";
    /** Current revision; 0 before the first save. */
    rev: number;
    /** Size of the current revision in bytes. */
    size: number;
    /** Pages as the editor counted them on the last save. */
    summary: { pages: Array<{ name: string; layers: number }> };
    /** A .fig/.jam file the document started from, if any. */
    source: string | null;
    /** Who saved last (user id), if known. */
    updatedBy: string | null;
    /** ms since epoch. */
    createdAt: number;
    /** ms since epoch. */
    updatedAt: number;
};
