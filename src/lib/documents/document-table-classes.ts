/**
 * Line-item tables inside narrow document cards (e.g. max-w-3xl) need a horizontal
 * scroll + minimum width so formatted money columns do not collapse together.
 */
export const documentLineTableScroll =
  "mt-8 overflow-x-auto print:overflow-visible [-webkit-overflow-scrolling:touch]";

/**
 * Invoice GST grid: `table-fixed` + colgroup (on the page) keeps every column visible
 * inside a wide enough card without horizontal scrolling.
 */
export const documentInvoiceLineTable = "w-full table-fixed border-collapse text-xs sm:text-sm";

/** Quotes / bills / credit notes: fewer columns */
export const documentSimpleLineTable = "w-full min-w-[28rem] border-collapse text-sm sm:min-w-[32rem]";

export const documentLineTheadRow =
  "border-y border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400";

export const documentLineTheadRowBorderB =
  "border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400";

export const documentThDesc = "px-2 py-2.5 text-left sm:px-3";

export const documentThNum = "px-2 py-2.5 text-right whitespace-nowrap sm:px-3";

export const documentTdDesc = "px-2 py-2 align-top sm:px-3";

export const documentTdNum = "px-2 py-2 text-right whitespace-nowrap tabular-nums sm:px-3";

export const documentTdNumStrong =
  "px-2 py-2 text-right font-medium whitespace-nowrap tabular-nums sm:px-3";

/** First column (invoice fixed table): allow wrapping */
export const documentTdDescInvoice = `${documentTdDesc} min-w-0 break-words [word-break:break-word]`;

/** Tighter invoice GST header/body cells so eight columns fit without scroll */
export const documentThDescInvoice =
  "px-1 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:px-2 sm:text-xs";

export const documentThNumInvoice =
  "px-1 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap dark:text-slate-400 sm:px-2 sm:text-xs";

export const documentTdNumInvoice =
  "px-1 py-2 text-right text-[11px] whitespace-nowrap tabular-nums sm:px-2 sm:text-sm";

export const documentTdNumInvoiceStrong =
  "px-1 py-2 text-right text-[11px] font-semibold whitespace-nowrap tabular-nums sm:px-2 sm:text-sm";
