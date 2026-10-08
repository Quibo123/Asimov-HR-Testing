/// <reference types='codeceptjs' />

type steps_file = typeof import('./tests/support/steps').default

/**
 * CodeceptJS 4 typings:
 *  - a Scenario callback receives `CodeceptJS.SupportObject`
 *  - `SupportObject.I` is declared as an empty interface
 *  - helper methods live in *classes* (`CodeceptJS.Playwright`, `CodeceptJS.REST`)
 *    rather than the per-helper interfaces used by CodeceptJS 3
 *
 * So the augmentation below maps those class instance types onto `I`.
 */
declare namespace CodeceptJS {
  /** Instance-side methods of the Playwright helper (public API only). */
  type PlaywrightHelperMethods = Omit<CodeceptJS.Playwright, keyof CodeceptJS.Helper>

  /** Instance-side methods of the REST helper (public API only). */
  type RESTHelperMethods = Omit<CodeceptJS.REST, keyof CodeceptJS.Helper>

  interface I extends ActorStatic, PlaywrightHelperMethods, RESTHelperMethods, ReturnType<steps_file> {}

  interface Methods extends ActorStatic, PlaywrightHelperMethods, RESTHelperMethods {}

  interface SupportObject {
    I: CodeceptJS.I
    current: any
  }

  namespace Translation {
    interface Actions {}
  }
}
