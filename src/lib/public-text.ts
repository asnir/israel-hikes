/** Remove internal review dates while preserving closure dates and safety caveats. */
export function publicText(value: string): string {
 return value.replace("(הדף נבדק 9.10.2026, לא ברור אם נפתח מחדש)", "(לא ברור אם נפתח מחדש)").replace(" (הדף נבדק 9.10.2026)", "").replace("Checked on 9 October 2026; reopening was unclear.", "Reopening was unclear.").replace("Page checked on 9 October 2026; check with KKL-JNF.", "Check with KKL-JNF.");
}
